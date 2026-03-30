'use strict';

const Service = require('egg').Service;

/**
 * 反馈服务层
 * 处理用户反馈的业务逻辑
 */
class FeedbackService extends Service {

  /**
   * 提交反馈
   * @param {object} data - 反馈数据
   * @param {string} data.type - 反馈类型: suggestion/bug
   * @param {string} data.module - 所属功能: write_script/novel_to_script/model_settings/other（兼容旧值 buy_vip/review_script）
   * @param {string} data.content - 反馈内容
   * @param {array} data.images - 截图URL数组
   * @param {string} data.contact - 联系方式
   * @returns {Promise<object>} 提交结果
   */
  async submit(data) {
    const { ctx } = this;

    try {
      /* 获取用户ID（如果已登录） */
      const userId = ctx.state.user?.id || null;

      /* 获取客户端IP地址 */
      const ip = ctx.ip;

      /* 构建数据库记录 */
      const feedbackData = {
        user_id: userId,
        type: data.type,
        module: data.module,
        content: data.content,
        images: data.images && data.images.length > 0 ? data.images : null,
        contact: data.contact || null,
        status: 0, // 默认待处理
        ip,
      };

      /* 保存到数据库 */
      await ctx.model.Feedback.create(feedbackData);

      return { success: true };

    } catch (err) {
      throw new Error('提交失败，请稍后重试');
    }
  }

  /**
   * 获取反馈列表（管理后台用）
   * @param {object} query - 查询参数
   * @param {number} query.page - 页码
   * @param {number} query.pageSize - 每页条数
   * @param {string} query.type - 反馈类型筛选
   * @param {string} query.module - 功能模块筛选
   * @param {number} query.status - 状态筛选
   * @returns {Promise<object>} 分页列表
   */
  async list(query) {
    const { ctx } = this;

    const page = Math.max(1, parseInt(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize) || 20));
    const offset = (page - 1) * pageSize;

    /* 构建查询条件 */
    const where = {};
    if (query.type) where.type = query.type;
    if (query.module) where.module = query.module;
    if (query.status !== undefined && query.status !== '') where.status = parseInt(query.status);

    /* 查询数据 */
    const result = await ctx.model.Feedback.findAndCountAll({
      where,
      order: [[ 'created_at', 'DESC' ]],
      limit: pageSize,
      offset,
      raw: true, // 返回纯JSON，不包装成实例
    });

    return {
      rows: result.rows,
      count: result.count,
    };
  }
}

module.exports = FeedbackService;
