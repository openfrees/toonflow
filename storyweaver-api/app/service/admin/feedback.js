'use strict';

const Service = require('egg').Service;
const { Op } = require('sequelize');

/**
 * 管理后台 - 反馈管理服务
 */
class FeedbackService extends Service {

  /**
   * 分页查询反馈列表
   * @param {object} query - 查询参数
   * @returns {Promise<{ rows: Array, count: number }>}
   */
  async list(query) {
    const { ctx } = this;
    const { page = 1, pageSize = 20, type, module, status, keyword } = query;

    /* 构建查询条件 */
    const where = {};
    if (type) where.type = type;
    if (module) where.module = module;
    if (status !== undefined && status !== '') where.status = Number(status);
    if (keyword) where.content = { [Op.like]: `%${keyword}%` };

    const result = await ctx.model.Feedback.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: Number(pageSize),
      offset: (Number(page) - 1) * Number(pageSize),
      raw: true,
    });

    /* ID转String + 时间字段映射（raw:true + underscored 时字段名为驼峰） */
    result.rows = result.rows.map(item => ({
      ...item,
      id: String(item.id),
      images: ctx.helper.parseJsonArray(item.images, []),
      user_id: item.user_id ? String(item.user_id) : null,
      created_at: item.created_at || item.createdAt || '',
      updated_at: item.updated_at || item.updatedAt || '',
    }));

    return result;
  }

  /**
   * 查询反馈详情
   * @param {string|number} id - 反馈ID
   * @returns {Promise<object>}
   */
  async detail(id) {
    const { ctx } = this;

    const feedback = await ctx.model.Feedback.findOne({
      where: { id },
      raw: true,
    });

    if (!feedback) {
      throw new Error('反馈不存在');
    }

    /* 如果有user_id，查询用户信息 */
    let userInfo = null;
    if (feedback.user_id) {
      const user = await ctx.model.User.findOne({
        where: { id: feedback.user_id },
        attributes: ['id', 'nickname', 'phone', 'avatar'],
        raw: true,
      });
      if (user) {
        userInfo = {
          id: String(user.id),
          nickname: user.nickname,
          phone: user.phone,
          avatar: user.avatar,
        };
      }
    }

    return {
      ...feedback,
      id: String(feedback.id),
      images: ctx.helper.parseJsonArray(feedback.images, []),
      user_id: feedback.user_id ? String(feedback.user_id) : null,
      created_at: feedback.created_at || feedback.createdAt || '',
      updated_at: feedback.updated_at || feedback.updatedAt || '',
      user: userInfo,
    };
  }

  /**
   * 管理员回复反馈
   * @param {string|number} id - 反馈ID
   * @param {string} reply - 回复内容
   */
  async reply(id, reply) {
    const { ctx } = this;

    const feedback = await ctx.model.Feedback.findByPk(id);
    if (!feedback) {
      throw new Error('反馈不存在');
    }

    await ctx.model.Feedback.update(
      { admin_reply: reply, status: 1 },
      { where: { id } }
    );
  }

  /**
   * 更新反馈状态
   * @param {string|number} id - 反馈ID
   * @param {number} status - 目标状态 0待处理 1已处理 2已关闭
   */
  async updateStatus(id, status) {
    const { ctx } = this;

    const feedback = await ctx.model.Feedback.findByPk(id);
    if (!feedback) {
      throw new Error('反馈不存在');
    }

    await ctx.model.Feedback.update(
      { status },
      { where: { id } }
    );
  }

  /**
   * 获取反馈统计数据
   * @returns {Promise<object>}
   */
  async stats() {
    const { ctx } = this;

    const total = await ctx.model.Feedback.count();
    const pending = await ctx.model.Feedback.count({ where: { status: 0 } });
    const processed = await ctx.model.Feedback.count({ where: { status: 1 } });
    const closed = await ctx.model.Feedback.count({ where: { status: 2 } });

    return { total, pending, processed, closed };
  }
}

module.exports = FeedbackService;
