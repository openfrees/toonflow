'use strict';

const Service = require('egg').Service;
const { Op } = require('sequelize');

/**
 * 管理后台 - 短剧服务
 */
class DramaService extends Service {

  /**
   * 分页查询短剧列表（优化版：关联统计已创建剧集数）
   * @param {object} query - 查询参数
   * @returns {Promise<{ rows: Array, count: number }>}
   */
  async list(query) {
    const { ctx } = this;
    const { page = 1, pageSize = 10, title, status, grade } = query;

    /* 构建WHERE条件 */
    const whereConditions = [];
    const replacements = {};

    if (title) {
      whereConditions.push('d.title LIKE :title');
      replacements.title = `%${title}%`;
    }
    if (status !== undefined && status !== '') {
      whereConditions.push('d.status = :status');
      replacements.status = Number(status);
    }
    if (grade) {
      whereConditions.push('d.grade = :grade');
      replacements.grade = grade;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    /* 查询总数 */
    const countSql = `
      SELECT COUNT(DISTINCT d.id) as total
      FROM drama d
      ${whereClause}
    `;
    const [ countResult ] = await ctx.model.query(countSql, {
      replacements,
      type: ctx.model.QueryTypes.SELECT,
    });
    const count = countResult.total;

    /* 查询列表数据（关联统计已创建剧集数） */
    const offset = (Number(page) - 1) * Number(pageSize);
    const limit = Number(pageSize);
    replacements.limit = limit;
    replacements.offset = offset;

    const listSql = `
      SELECT
        d.*,
        CAST(d.id AS CHAR) as id_str,
        COUNT(de.id) as created_episodes
      FROM drama d
      LEFT JOIN drama_episode de ON d.id = de.drama_id
      ${whereClause}
      GROUP BY d.id
      ORDER BY d.created_at DESC
      LIMIT :limit OFFSET :offset
    `;

    const rows = await ctx.model.query(listSql, {
      replacements,
      type: ctx.model.QueryTypes.SELECT,
    });

    /* ID混淆编码 + 字段映射（转驼峰） */
    const formattedRows = rows.map(item => ({
      ...item,
      id: ctx.helper.encodeId(item.id),
      createdEpisodes: Number(item.created_episodes) || 0, // 已创建集数（驼峰格式）
    }));


    return {
      rows: formattedRows,
      count,
    };
  }

  /**
   * 查询短剧详情
   * @param {string|number} id - 短剧ID
   * @returns {Promise<object>}
   */
  async detail(id) {
    const { ctx } = this;

    const drama = await ctx.model.Drama.findOne({
      where: { id },
      raw: true,
    });

    if (!drama) {
      throw new Error('短剧不存在');
    }

    return {
      ...drama,
      id: ctx.helper.encodeId(drama.id),
    };
  }

  /**
   * 创建短剧
   * @param {object} data - 短剧数据
   * @returns {Promise<object>}
   */
  async create(data) {
    const { ctx } = this;

    /* 创建短剧 */
    const drama = await ctx.model.Drama.create(data);

    return { id: ctx.helper.encodeId(drama.id) };
  }

  /**
   * 更新短剧
   * @param {string|number} id - 短剧ID
   * @param {object} data - 更新数据
   */
  async update(id, data) {
    const { ctx } = this;

    const drama = await ctx.model.Drama.findByPk(id);
    if (!drama) {
      throw new Error('短剧不存在');
    }

    /* 更新短剧基础信息 */
    await ctx.model.Drama.update(data, { where: { id } });
  }

  /**
   * 删除短剧
   * @param {string|number} id - 短剧ID
   */
  async destroy(id) {
    const { ctx } = this;

    const drama = await ctx.model.Drama.findByPk(id);
    if (!drama) {
      throw new Error('短剧不存在');
    }

    /* 删除关联数据 */
    await ctx.model.DramaEpisode.destroy({ where: { drama_id: id } });
    await ctx.model.Drama.destroy({ where: { id } });
  }

  /**
   * 批量更新状态
   * @param {Array<string>} ids - 短剧ID数组
   * @param {number} status - 目标状态
   */
  async batchUpdateStatus(ids, status) {
    const { ctx } = this;
    await ctx.model.Drama.update(
      { status },
      { where: { id: { [Op.in]: ids } } }
    );
  }
}

module.exports = DramaService;
