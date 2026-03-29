'use strict';

const { Controller } = require('egg');

/**
 * 剧本分集控制器（C端）
 * 处理分集剧情大纲的批量保存
 */
class ScriptEpisodeController extends Controller {

  /**
   * 批量保存分集大纲
   * POST /api/script-episode/batch-save
   * Body: { scriptId, episodes: [{ episodeNumber, title, content }] }
   */
  async batchSave() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const { scriptId, episodes } = ctx.request.body;

    /* 参数校验 */
    if (!scriptId) {
      ctx.body = ctx.helper.fail('缺少剧本ID', 400);
      return;
    }
    if (!Array.isArray(episodes) || episodes.length === 0) {
      ctx.body = ctx.helper.fail('分集数据不能为空', 400);
      return;
    }

    /* 解码混淆的scriptId */
    const realScriptId = ctx.helper.decodeId(scriptId);
    if (!realScriptId) {
      ctx.body = ctx.helper.fail('无效的剧本ID', 400);
      return;
    }

    const savedEpisodes = await ctx.service.api.scriptEpisode.batchSave(realScriptId, userId, episodes);
    ctx.body = ctx.helper.success(savedEpisodes, '保存成功');
  }
}

module.exports = ScriptEpisodeController;
