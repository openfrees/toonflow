'use strict';

const Service = require('egg').Service;
const dayjs = require('dayjs');

/**
 * 管理后台 - 用户管理服务
 * 提供注册统计和用户列表查询（关联代理人名称、VIP等级名称）
 */
class UserService extends Service {

  /**
   * 获取注册统计
   * 今日 / 7天 / 30天 / 累计 注册人数
   * @returns {Promise<object>}
   */
  async getStats() {
    const { ctx } = this;
    const { Op } = ctx.model.Sequelize;

    const [todayCount, weekCount, monthCount, totalCount] = await Promise.all([
      /* 今日注册 */
      ctx.model.User.count({
        where: {
          created_at: { [Op.gte]: dayjs().startOf('day').toDate() },
        },
      }),
      /* 近7日注册 */
      ctx.model.User.count({
        where: {
          created_at: { [Op.gte]: dayjs().subtract(7, 'day').startOf('day').toDate() },
        },
      }),
      /* 近30日注册 */
      ctx.model.User.count({
        where: {
          created_at: { [Op.gte]: dayjs().subtract(30, 'day').startOf('day').toDate() },
        },
      }),
      /* 累计注册 */
      ctx.model.User.count(),
    ]);

    return {
      todayCount,
      weekCount,
      monthCount,
      totalCount,
    };
  }

  /**
   * 获取用户列表
   * 使用原生SQL查询，并关联 vip_tier 展示会员信息
   * @param {object} params - 查询参数
   * @param {number} params.page - 页码
   * @param {number} params.pageSize - 每页条数
   * @param {number} [params.status] - 状态筛选
   * @param {string} [params.loginType] - 注册方式筛选
   * @param {string} [params.vipTierId] - VIP等级筛选
   * @param {string} [params.keyword] - 关键词搜索(手机号/昵称)
   * @returns {Promise<object>}
   */
  async getList(params) {
    const { ctx } = this;
    const { page = 1, pageSize = 20, status, loginType, vipTierId, keyword } = params;

    /* 构建WHERE条件 */
    const conditions = [];
    const replacements = [];

    /* 状态筛选 */
    if (status !== undefined && status !== '' && status !== null) {
      conditions.push('u.status = ?');
      replacements.push(Number(status));
    }

    /* 注册方式筛选 */
    if (loginType) {
      conditions.push('u.login_type = ?');
      replacements.push(loginType);
    }

    /* VIP等级筛选：0表示普通用户(无VIP)，其他为具体tier_id */
    /* 使用 JS 生成当前时间字符串，兼容 MySQL 和 SQLite（避免 NOW() 在 SQLite 中不可用） */
    if (vipTierId !== undefined && vipTierId !== '' && vipTierId !== null) {
      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
      if (vipTierId === '0') {
        conditions.push('(u.vip_tier_id IS NULL OR u.vip_expires_at < ?)');
        replacements.push(nowStr);
      } else {
        conditions.push('u.vip_tier_id = ? AND u.vip_expires_at >= ?');
        replacements.push(Number(vipTierId), nowStr);
      }
    }

    /* 关键词搜索（手机号/昵称） */
    if (keyword) {
      conditions.push('(u.phone LIKE ? OR u.nickname LIKE ?)');
      replacements.push(`%${keyword}%`, `%${keyword}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    /* 查询总数 */
    const countSql = `
      SELECT COUNT(*) AS total
      FROM user u
      ${whereClause}
    `;
    const [countResult] = await ctx.model.query(countSql, {
      replacements,
      type: ctx.model.Sequelize.QueryTypes.SELECT,
    });

    /* 查询列表（LEFT JOIN vip_tier） */
    const listSql = `
      SELECT
        CAST(u.id AS CHAR) AS id,
        u.user_no,
        u.phone,
        u.nickname,
        u.avatar,
        u.login_type,
        u.status,
        CAST(u.vip_tier_id AS CHAR) AS vip_tier_id,
        u.vip_expires_at,
        u.last_login_at,
        u.created_at,
        vt.name AS vip_tier_name,
        vt.badge AS vip_tier_badge
      FROM user u
      LEFT JOIN vip_tier vt ON u.vip_tier_id = vt.id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const listReplacements = [...replacements, Number(pageSize), (page - 1) * Number(pageSize)];
    const rows = await ctx.model.query(listSql, {
      replacements: listReplacements,
      type: ctx.model.Sequelize.QueryTypes.SELECT,
    });

    return { rows, count: countResult.total };
  }

  /**
   * 更新用户状态
   * @param {string|number} id - 用户ID
   * @param {number} status - 状态值: 0禁用 1正常
   */
  async updateStatus(id, status) {
    const { ctx } = this;
    const user = await ctx.model.User.findByPk(id);
    if (!user) {
      throw new Error('用户不存在');
    }
    await user.update({ status });
  }

  /**
   * 智能搜索用户（用于订单筛选的用户选择器）
   * 根据关键词类型自动判断搜索方式：
   * - 纯数字 <= 10位 → 按用户ID或用户编号精确查询
   * - 纯数字 = 11位 → 按手机号精确查询
   * - 其他 → 按昵称模糊查询
   * @param {string} keyword - 搜索关键词
   * @returns {Promise<Array>} 用户列表
   */
  async searchUsers(keyword) {
    const { ctx } = this;
    const { Op } = ctx.model.Sequelize;

    if (!keyword || keyword.trim() === '') {
      return [];
    }

    const trimmedKeyword = keyword.trim();
    const where = {};

    /* 判断搜索类型 */
    const isNumeric = /^\d+$/.test(trimmedKeyword);

    if (isNumeric) {
      if (trimmedKeyword.length <= 10) {
        /* 按用户ID或用户编号精确查询（OR条件） */
        where[Op.or] = [
          { id: Number(trimmedKeyword) },
          { user_no: trimmedKeyword },
        ];
      } else if (trimmedKeyword.length === 11) {
        /* 按手机号精确查询 */
        where.phone = trimmedKeyword;
      } else {
        /* 数字位数不符合，按昵称模糊查询 */
        where.nickname = { [Op.like]: `%${trimmedKeyword}%` };
      }
    } else {
      /* 非纯数字，按昵称模糊查询 */
      where.nickname = { [Op.like]: `%${trimmedKeyword}%` };
    }

    const users = await ctx.model.User.findAll({
      where,
      attributes: ['id', 'user_no', 'phone', 'nickname', 'avatar'],
      limit: 10, // 最多返回10条
      order: [['created_at', 'DESC']],
      raw: true,
    });

    return users.map(user => ({
      id: String(user.id),
      user_no: user.user_no || '',
      phone: user.phone || '',
      nickname: user.nickname || '未设置昵称',
      avatar: user.avatar || '',
    }));
  }

  /**
   * 一键删除用户所有数据（临时测试功能）
   * 使用事务保证原子性，按外键依赖顺序从子表到父表逐层删除
   * @param {string|number} id - 用户ID
   * @returns {Promise<object>} 各表删除的行数统计
   */
  async destroyUser(id) {
    const { ctx } = this;

    /* 先确认用户存在 */
    const user = await ctx.model.User.findByPk(id, { raw: true });
    if (!user) {
      throw new Error('用户不存在');
    }

    /* 查出该用户的所有剧本ID，用于删除剧本子表 */
    const scripts = await ctx.model.query(
      'SELECT id FROM script WHERE user_id = ?',
      { replacements: [id], type: ctx.model.Sequelize.QueryTypes.SELECT }
    );
    const scriptIds = scripts.map(s => s.id);

    /* 查出该用户的所有小说项目ID，用于删除小说项目子表与资产 */
    const novelProjects = await ctx.model.query(
      'SELECT id FROM novel_project WHERE user_id = ?',
      { replacements: [id], type: ctx.model.Sequelize.QueryTypes.SELECT }
    );
    const novelProjectIds = novelProjects.map(item => item.id);

    /* 提前记录小说资产关联的上传文件，事务提交成功后再清理磁盘 */
    let novelAssetFiles = [];
    if (novelProjectIds.length > 0) {
      const placeholders = novelProjectIds.map(() => '?').join(',');
      const assetRows = await ctx.model.query(
        `SELECT prompt FROM novel_asset WHERE novel_project_id IN (${placeholders})`,
        { replacements: novelProjectIds, type: ctx.model.Sequelize.QueryTypes.SELECT }
      );
      novelAssetFiles = Array.from(new Set(assetRows.flatMap(row => {
        const parsed = ctx.helper.parseJsonObject(row.prompt, null);
        if (!parsed || typeof parsed !== 'object') return [];
        return [ parsed.avatar, parsed.image ].filter(Boolean);
      })));
    }

    /* 开启事务 */
    const transaction = await ctx.model.transaction();
    const deleted = {};

    try {
      /* 1. 分镜数据（依赖 script + episode） */
      const [, sbResult] = await ctx.model.query(
        'DELETE FROM episode_storyboard WHERE user_id = ?',
        { replacements: [id], transaction }
      );
      deleted.episode_storyboard = sbResult.affectedRows || 0;

      /* 2-4. 剧本子表（依赖 script_id） */
      if (scriptIds.length > 0) {
        const placeholders = scriptIds.map(() => '?').join(',');

        const [, scResult] = await ctx.model.query(
          `DELETE FROM script_character WHERE script_id IN (${placeholders})`,
          { replacements: scriptIds, transaction }
        );
        deleted.script_character = scResult.affectedRows || 0;

        const [, sgResult] = await ctx.model.query(
          `DELETE FROM script_genre WHERE script_id IN (${placeholders})`,
          { replacements: scriptIds, transaction }
        );
        deleted.script_genre = sgResult.affectedRows || 0;

        const [, seResult] = await ctx.model.query(
          `DELETE FROM script_episode WHERE script_id IN (${placeholders})`,
          { replacements: scriptIds, transaction }
        );
        deleted.script_episode = seResult.affectedRows || 0;
      } else {
        deleted.script_character = 0;
        deleted.script_genre = 0;
        deleted.script_episode = 0;
      }

      /* 5. AI聊天记录 */
      const [, chatResult] = await ctx.model.query(
        'DELETE FROM ai_chat_record WHERE user_id = ?',
        { replacements: [id], transaction }
      );
      deleted.ai_chat_record = chatResult.affectedRows || 0;

      /* 6. 剧本主表 */
      const [, scriptResult] = await ctx.model.query(
        'DELETE FROM script WHERE user_id = ?',
        { replacements: [id], transaction }
      );
      deleted.script = scriptResult.affectedRows || 0;

      /* 7-12. 小说项目相关数据（依赖 novel_project_id） */
      if (novelProjectIds.length > 0) {
        const placeholders = novelProjectIds.map(() => '?').join(',');

        const [, assetResult] = await ctx.model.query(
          `DELETE FROM novel_asset WHERE novel_project_id IN (${placeholders})`,
          { replacements: novelProjectIds, transaction }
        );
        deleted.novel_asset = assetResult.affectedRows || 0;

        const [, historyResult] = await ctx.model.query(
          `DELETE FROM novel_chat_history WHERE novel_project_id IN (${placeholders})`,
          { replacements: novelProjectIds, transaction }
        );
        deleted.novel_chat_history = historyResult.affectedRows || 0;

        const [, episodeResult] = await ctx.model.query(
          `DELETE FROM novel_episode WHERE novel_project_id IN (${placeholders})`,
          { replacements: novelProjectIds, transaction }
        );
        deleted.novel_episode = episodeResult.affectedRows || 0;

        const [, storylineResult] = await ctx.model.query(
          `DELETE FROM novel_storyline WHERE novel_project_id IN (${placeholders})`,
          { replacements: novelProjectIds, transaction }
        );
        deleted.novel_storyline = storylineResult.affectedRows || 0;

        const [, chapterResult] = await ctx.model.query(
          `DELETE FROM novel_chapter WHERE novel_project_id IN (${placeholders})`,
          { replacements: novelProjectIds, transaction }
        );
        deleted.novel_chapter = chapterResult.affectedRows || 0;
      } else {
        deleted.novel_asset = 0;
        deleted.novel_chat_history = 0;
        deleted.novel_episode = 0;
        deleted.novel_storyline = 0;
        deleted.novel_chapter = 0;
      }

      const [, projectResult] = await ctx.model.query(
        'DELETE FROM novel_project WHERE user_id = ?',
        { replacements: [id], transaction }
      );
      deleted.novel_project = projectResult.affectedRows || 0;

      /* 13. 充值订单 */
      const [, orderResult] = await ctx.model.query(
        'DELETE FROM recharge_order WHERE user_id = ?',
        { replacements: [id], transaction }
      );
      deleted.recharge_order = orderResult.affectedRows || 0;

      /* 14. 兑换记录 */
      const [, redeemResult] = await ctx.model.query(
        'DELETE FROM redeem_log WHERE user_id = ?',
        { replacements: [id], transaction }
      );
      deleted.redeem_log = redeemResult.affectedRows || 0;

      /* 15. 反馈 */
      const [, fbResult] = await ctx.model.query(
        'DELETE FROM feedback WHERE user_id = ?',
        { replacements: [id], transaction }
      );
      deleted.feedback = fbResult.affectedRows || 0;

      /* 16. 用户主表（最后删） */
      const [, userResult] = await ctx.model.query(
        'DELETE FROM user WHERE id = ?',
        { replacements: [id], transaction }
      );
      deleted.user = userResult.affectedRows || 0;

      await transaction.commit();

      for (const filePath of novelAssetFiles) {
        ctx.helper.removeUploadedFile(filePath);
      }

      ctx.logger.info('[用户删除] 成功 userId=%s, nickname=%s, 删除统计: %j', id, user.nickname, deleted);
      return deleted;
    } catch (err) {
      await transaction.rollback();
      ctx.logger.error('[用户删除] 事务回滚 userId=%s, error:', id, err);
      throw new Error('删除失败，已回滚: ' + err.message);
    }
  }
}

module.exports = UserService;
