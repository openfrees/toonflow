'use strict';

const { Service } = require('egg');

/**
 * 剧本分集服务
 * 处理分集剧情大纲的批量保存（upsert逻辑）
 */
class ScriptEpisodeService extends Service {

  /**
   * 批量保存分集大纲
   * 按 script_id + user_id + episode_number 做 upsert
   * @param {string|number} scriptId - 剧本ID
   * @param {number} userId - 用户ID
   * @param {Array<{episodeNumber: number, title: string, content: string, isLocked: number}>} episodes - 分集数据
   * @returns {Array<{episodeNumber: number, id: string}>} 返回保存后的集数和对应的ID
   */
  async batchSave(scriptId, userId, episodes) {
    const { ctx } = this;

    /* 校验剧本归属 */
    const script = await ctx.model.Script.findOne({
      where: { id: scriptId, user_id: userId },
      attributes: ['id'],
      raw: true,
    });
    if (!script) {
      ctx.throw(404, '剧本不存在');
    }

    /* 逐集 upsert，收集返回的 id */
    const savedEpisodes = [];

    for (const ep of episodes) {
      const episodeNumber = Number(ep.episodeNumber);
      if (!episodeNumber || episodeNumber < 1) continue;

      const existing = await ctx.model.ScriptEpisode.findOne({
        where: {
          script_id: scriptId,
          user_id: userId,
          episode_number: episodeNumber,
        },
        raw: true,
      });

      const wordCount = (ep.content || '').replace(/\s/g, '').length;

      if (existing) {
        /* 更新已有记录 */
        const updateData = {
          title: ep.title || '',
          content: ep.content || '',
          word_count: wordCount,
        };
        /* 锁定状态：前端传了才更新 */
        if (ep.isLocked !== undefined) {
          updateData.is_locked = ep.isLocked ? 1 : 0;
        }
        await ctx.model.ScriptEpisode.update(updateData, {
          where: {
            script_id: scriptId,
            user_id: userId,
            episode_number: episodeNumber,
          },
        });
        savedEpisodes.push({
          episodeNumber,
          id: ctx.helper.encodeId(existing.id),
        });
      } else {
        /* 插入新记录 */
        const newRecord = await ctx.model.ScriptEpisode.create({
          script_id: scriptId,
          user_id: userId,
          episode_number: episodeNumber,
          title: ep.title || '',
          content: ep.content || '',
          word_count: wordCount,
          status: 0,
          is_locked: ep.isLocked ? 1 : 0,
        });
        savedEpisodes.push({
          episodeNumber,
          id: ctx.helper.encodeId(newRecord.id),
        });
      }
    }

    return savedEpisodes;
  }
}

module.exports = ScriptEpisodeService;
