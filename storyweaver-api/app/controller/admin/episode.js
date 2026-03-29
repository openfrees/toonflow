'use strict';

const Controller = require('egg').Controller;

/**
 * 管理后台 - 分集控制器
 */
class EpisodeController extends Controller {

  /**
   * GET /api/admin/episode?drama_id=xxx - 分集列表
   */
  async index() {
    const { ctx } = this;
    const { drama_id } = ctx.query;

    if (!drama_id) {
      ctx.body = ctx.helper.fail('drama_id不能为空');
      return;
    }

    try {
      /* 解码混淆的drama_id */
      const realDramaId = ctx.helper.decodeId(drama_id);
      if (!realDramaId) {
        ctx.body = ctx.helper.fail('无效的drama_id');
        return;
      }
      const result = await ctx.service.admin.episode.list(realDramaId);
      ctx.body = ctx.helper.success(result);
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  /**
   * POST /api/admin/episode - 创建分集
   */
  async create() {
    const { ctx } = this;

    ctx.validate({
      drama_id: { type: 'string', required: true },
      episode_number: { type: 'number', required: true },
    });

    try {
      /* 解码混淆的drama_id，还原为真实ID传给service */
      const body = { ...ctx.request.body };
      const realDramaId = ctx.helper.decodeId(body.drama_id);
      if (!realDramaId) {
        ctx.body = ctx.helper.fail('无效的drama_id');
        return;
      }
      body.drama_id = realDramaId;

      const result = await ctx.service.admin.episode.create(body);
      ctx.body = ctx.helper.success(result, '创建成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  /**
   * PUT /api/admin/episode/:id - 更新分集
   */
  async update() {
    const { ctx } = this;

    try {
      /* 解码混淆ID */
      const id = ctx.helper.decodeId(ctx.params.id);
      if (!id) {
        ctx.body = ctx.helper.fail('无效的分集ID');
        return;
      }
      await ctx.service.admin.episode.update(id, ctx.request.body);
      ctx.body = ctx.helper.success(null, '更新成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  /**
   * DELETE /api/admin/episode/:id - 删除分集
   */
  async destroy() {
    const { ctx } = this;

    try {
      /* 解码混淆ID */
      const id = ctx.helper.decodeId(ctx.params.id);
      if (!id) {
        ctx.body = ctx.helper.fail('无效的分集ID');
        return;
      }
      await ctx.service.admin.episode.destroy(id);
      ctx.body = ctx.helper.success(null, '删除成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }
}

module.exports = EpisodeController;
