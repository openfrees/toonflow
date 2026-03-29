'use strict';

const { Controller } = require('egg');

/**
 * 剧本控制器（C端）
 * 处理剧本的创建、查询、更新接口
 */
class ScriptController extends Controller {

  /**
   * 创建剧本
   * POST /api/script
   */
  async create() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const {
      title, totalEpisodes, duration, gender,
      aspectRatio, artStyle,
      maxRoles, maxScenes, maxWords, dialogueRatio,
      genreIds, customGenres, userIdea,
    } = ctx.request.body;

    const result = await ctx.service.api.script.create({
      title, totalEpisodes, duration, gender,
      aspectRatio, artStyle,
      maxRoles, maxScenes, maxWords, dialogueRatio,
      genreIds, customGenres, userIdea,
    }, userId);

    ctx.body = ctx.helper.success(result, '创建成功');
  }

  /**
   * 剧本详情
   * GET /api/script/:id
   */
  async detail() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    /* 解码混淆ID */
    const id = ctx.helper.decodeId(ctx.params.id);
    if (!id) {
      ctx.body = ctx.helper.fail('无效的剧本ID');
      return;
    }

    const result = await ctx.service.api.script.detail(id, userId);
    ctx.body = ctx.helper.success(result);
  }

  /**
   * 剧本列表
   * GET /api/script
   */
  async list() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const { page, pageSize } = ctx.query;

    const result = await ctx.service.api.script.list(userId, { page, pageSize });
    ctx.body = ctx.helper.paginate(result, page || 1, pageSize || 20);
  }

  /**
   * 更新剧本
   * PUT /api/script/:id
   */
  async update() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    /* 解码混淆ID */
    const id = ctx.helper.decodeId(ctx.params.id);
    if (!id) {
      ctx.body = ctx.helper.fail('无效的剧本ID');
      return;
    }

    await ctx.service.api.script.update(id, userId, ctx.request.body);
    ctx.body = ctx.helper.success(null, '更新成功');
  }

  /**
   * 核心参数重写（清空剧本内容，重新开始）
   * POST /api/script/:id/rewrite
   */
  async rewrite() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const id = ctx.helper.decodeId(ctx.params.id);
    if (!id) {
      ctx.body = ctx.helper.fail('无效的剧本ID');
      return;
    }

    const {
      totalEpisodes, duration, gender,
      aspectRatio, artStyle,
      maxRoles, maxScenes, maxWords, dialogueRatio,
      genreIds, customGenres, userIdea,
    } = ctx.request.body;

    await ctx.service.api.script.rewrite(id, userId, {
      totalEpisodes, duration, gender,
      aspectRatio, artStyle,
      maxRoles, maxScenes, maxWords, dialogueRatio,
      genreIds, customGenres, userIdea,
    });

    ctx.body = ctx.helper.success(null, '重写已就绪');
  }

  /**
   * 删除剧本
   * DELETE /api/script/:id
   */
  async destroy() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    /* 解码混淆ID */
    const id = ctx.helper.decodeId(ctx.params.id);
    if (!id) {
      ctx.body = ctx.helper.fail('无效的剧本ID');
      return;
    }

    await ctx.service.api.script.destroy(id, userId);
    ctx.body = ctx.helper.success(null, '删除成功');
  }
}

module.exports = ScriptController;
