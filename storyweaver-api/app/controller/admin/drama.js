'use strict';

const Controller = require('egg').Controller;

/**
 * 管理后台 - 短剧控制器
 */
class DramaController extends Controller {

  /**
   * GET /api/admin/drama - 短剧列表（分页）
   */
  async index() {
    const { ctx } = this;
    const { page = 1, pageSize = 10, title, status, grade } = ctx.query;

    try {
      const result = await ctx.service.admin.drama.list({
        page, pageSize, title, status, grade,
      });
      ctx.body = ctx.helper.paginate(result, page, pageSize);
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  /**
   * GET /api/admin/drama/:id - 短剧详情
   */
  async show() {
    const { ctx } = this;

    try {
      /* 解码混淆ID */
      const id = ctx.helper.decodeId(ctx.params.id);
      if (!id) {
        ctx.body = ctx.helper.fail('无效的短剧ID');
        return;
      }
      const result = await ctx.service.admin.drama.detail(id);
      ctx.body = ctx.helper.success(result);
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  /**
   * POST /api/admin/drama - 创建短剧
   */
  async create() {
    const { ctx } = this;

    ctx.validate({
      title: { type: 'string', required: true, message: '标题不能为空' },
    });

    try {
      const result = await ctx.service.admin.drama.create(ctx.request.body);
      ctx.body = ctx.helper.success(result, '创建成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  /**
   * PUT /api/admin/drama/:id - 更新短剧
   */
  async update() {
    const { ctx } = this;

    try {
      /* 解码混淆ID */
      const id = ctx.helper.decodeId(ctx.params.id);
      if (!id) {
        ctx.body = ctx.helper.fail('无效的短剧ID');
        return;
      }
      await ctx.service.admin.drama.update(id, ctx.request.body);
      ctx.body = ctx.helper.success(null, '更新成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  /**
   * DELETE /api/admin/drama/:id - 删除短剧
   */
  async destroy() {
    const { ctx } = this;

    try {
      /* 解码混淆ID */
      const id = ctx.helper.decodeId(ctx.params.id);
      if (!id) {
        ctx.body = ctx.helper.fail('无效的短剧ID');
        return;
      }
      await ctx.service.admin.drama.destroy(id);
      ctx.body = ctx.helper.success(null, '删除成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  /**
   * POST /api/admin/drama/batch-status - 批量更新状态
   */
  async batchStatus() {
    const { ctx } = this;

    ctx.validate({
      ids: { type: 'array', required: true },
      status: { type: 'number', required: true },
    });

    const { ids, status } = ctx.request.body;

    try {
      /* 批量解码混淆ID */
      const realIds = ids.map(id => ctx.helper.decodeId(id)).filter(Boolean);
      if (realIds.length === 0) {
        ctx.body = ctx.helper.fail('无效的短剧ID');
        return;
      }
      await ctx.service.admin.drama.batchUpdateStatus(realIds, status);
      ctx.body = ctx.helper.success(null, '批量操作成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }
}

module.exports = DramaController;
