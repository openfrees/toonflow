'use strict';

const Controller = require('egg').Controller;

/**
 * 管理后台 - 兑换码控制器
 * 兑换码生成、列表查询、状态管理、兑换记录查询
 */
class RedeemController extends Controller {

  /**
   * POST /admin/redeem/generate - 批量生成兑换码
   */
  async generate() {
    const { ctx } = this;

    ctx.validate({
      count: { type: 'number', required: false, min: 1, max: 100 },
      points: { type: 'number', required: true, min: 1 },
      max_uses: { type: 'number', required: false, min: 1 },
      expire_at: { type: 'string', required: true },
      remark: { type: 'string', required: false },
    });

    try {
      const adminId = ctx.state.adminUser.id;
      const result = await ctx.service.admin.redeem.generate(ctx.request.body, adminId);
      ctx.body = ctx.helper.success(result, '生成成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  /**
   * GET /admin/redeem - 兑换码列表
   */
  async index() {
    const { ctx } = this;

    try {
      const result = await ctx.service.admin.redeem.list(ctx.query);
      ctx.body = ctx.helper.success(result);
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  /**
   * PUT /admin/redeem/:id/status - 更新兑换码状态
   */
  async updateStatus() {
    const { ctx } = this;

    ctx.validate({
      status: { type: 'number', required: true },
    });

    try {
      await ctx.service.admin.redeem.updateStatus(ctx.params.id, ctx.request.body.status);
      ctx.body = ctx.helper.success(null, '更新成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  /**
   * DELETE /admin/redeem/:id - 删除兑换码
   */
  async destroy() {
    const { ctx } = this;

    try {
      await ctx.service.admin.redeem.destroy(ctx.params.id);
      ctx.body = ctx.helper.success(null, '删除成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  /**
   * GET /admin/redeem/log - 兑换记录列表
   */
  async logList() {
    const { ctx } = this;

    try {
      const result = await ctx.service.admin.redeem.logList(ctx.query);
      ctx.body = ctx.helper.success(result);
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }
}

module.exports = RedeemController;
