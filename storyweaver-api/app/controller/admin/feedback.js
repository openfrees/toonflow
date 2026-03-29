'use strict';

const Controller = require('egg').Controller;

/**
 * 管理后台 - 反馈管理控制器
 */
class FeedbackController extends Controller {

  /**
   * GET /admin/feedback - 反馈列表（分页）
   */
  async index() {
    const { ctx } = this;
    const { page = 1, pageSize = 20, type, module, status, keyword } = ctx.query;

    try {
      const result = await ctx.service.admin.feedback.list({
        page, pageSize, type, module, status, keyword,
      });
      ctx.body = ctx.helper.paginate(result, page, pageSize);
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  /**
   * GET /admin/feedback/:id - 反馈详情
   */
  async show() {
    const { ctx } = this;

    try {
      const result = await ctx.service.admin.feedback.detail(ctx.params.id);
      ctx.body = ctx.helper.success(result);
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  /**
   * POST /admin/feedback/:id/reply - 管理员回复
   */
  async reply() {
    const { ctx } = this;

    ctx.validate({
      reply: { type: 'string', required: true, message: '回复内容不能为空' },
    });

    try {
      await ctx.service.admin.feedback.reply(ctx.params.id, ctx.request.body.reply);
      ctx.body = ctx.helper.success(null, '回复成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  /**
   * PUT /admin/feedback/:id/status - 更新状态
   */
  async updateStatus() {
    const { ctx } = this;

    ctx.validate({
      status: { type: 'number', required: true, message: '状态不能为空' },
    });

    try {
      await ctx.service.admin.feedback.updateStatus(ctx.params.id, ctx.request.body.status);
      ctx.body = ctx.helper.success(null, '状态更新成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  /**
   * GET /admin/feedback/stats - 反馈统计
   */
  async stats() {
    const { ctx } = this;

    try {
      const result = await ctx.service.admin.feedback.stats();
      ctx.body = ctx.helper.success(result);
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }
}

module.exports = FeedbackController;
