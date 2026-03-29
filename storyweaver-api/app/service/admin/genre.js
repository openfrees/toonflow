'use strict';

const Service = require('egg').Service;
const { Op } = require('sequelize');

/**
 * 管理后台 - 题材类型服务
 */
class GenreService extends Service {

  /**
   * 查询题材列表（按分类分组）
   * @param {object} query - 查询参数
   * @returns {Promise<Array>}
   */
  async list(query = {}) {
    const { ctx } = this;
    const { is_enabled, category } = query;

    const where = {};
    if (is_enabled !== undefined && is_enabled !== '') where.is_enabled = Number(is_enabled);
    if (category) where.category = category;

    const genres = await ctx.model.Genre.findAll({
      where,
      order: [['sort_order', 'DESC'], ['id', 'ASC']],
      raw: true,
    });

    return genres.map(item => ({
      ...item,
      id: String(item.id),
    }));
  }

  /**
   * 创建题材
   * @param {object} data - 题材数据
   * @returns {Promise<object>}
   */
  async create(data) {
    const { ctx } = this;

    /* 检查同分类下名称是否重复 */
    const exist = await ctx.model.Genre.findOne({
      where: { name: data.name, category: data.category },
      raw: true,
    });
    if (exist) {
      throw new Error(`「${data.category}」分类下已存在「${data.name}」`);
    }

    const genre = await ctx.model.Genre.create(data);
    return { id: String(genre.id) };
  }

  /**
   * 更新题材
   * @param {string|number} id - 题材ID
   * @param {object} data - 更新数据
   */
  async update(id, data) {
    const { ctx } = this;

    const genre = await ctx.model.Genre.findByPk(id);
    if (!genre) {
      throw new Error('题材不存在');
    }

    /* 检查同分类下名称是否重复（排除自身） */
    if (data.name || data.category) {
      const checkName = data.name || genre.name;
      const checkCategory = data.category || genre.category;
      const exist = await ctx.model.Genre.findOne({
        where: { name: checkName, category: checkCategory, id: { [Op.ne]: id } },
        raw: true,
      });
      if (exist) {
        throw new Error(`「${checkCategory}」分类下已存在「${checkName}」`);
      }
    }

    await ctx.model.Genre.update(data, { where: { id } });
  }

  /**
   * 删除题材
   * @param {string|number} id - 题材ID
   */
  async destroy(id) {
    const { ctx } = this;

    const genre = await ctx.model.Genre.findByPk(id);
    if (!genre) {
      throw new Error('题材不存在');
    }

    await ctx.model.Genre.destroy({ where: { id } });
  }
}

module.exports = GenreService;
