'use strict';

const Controller = require('egg').Controller;

/**
 * 管理后台 - 题材类型控制器
 */
class GenreController extends Controller {

  /**
   * GET /admin/genre - 题材列表
   */
  async index() {
    const { ctx } = this;

    try {
      const result = await ctx.service.admin.genre.list(ctx.query);
      ctx.body = ctx.helper.success(result);
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  /**
   * POST /admin/genre - 创建题材
   */
  async create() {
    const { ctx } = this;

    ctx.validate({
      name: { type: 'string', required: true, message: '题材名称不能为空' },
      category: { type: 'string', required: true, message: '所属分类不能为空' },
    });

    try {
      const result = await ctx.service.admin.genre.create(ctx.request.body);
      ctx.body = ctx.helper.success(result, '创建成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  /**
   * PUT /admin/genre/:id - 更新题材
   */
  async update() {
    const { ctx } = this;

    try {
      await ctx.service.admin.genre.update(ctx.params.id, ctx.request.body);
      ctx.body = ctx.helper.success(null, '更新成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  /**
   * DELETE /admin/genre/:id - 删除题材
   */
  async destroy() {
    const { ctx } = this;

    try {
      await ctx.service.admin.genre.destroy(ctx.params.id);
      ctx.body = ctx.helper.success(null, '删除成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }
}

module.exports = GenreController;
