'use strict';

const Service = require('egg').Service;

/**
 * 管理后台 - 分集服务
 */
class EpisodeService extends Service {

  /**
   * 查询某短剧的分集列表
   * @param {string|number} dramaId - 短剧ID
   * @returns {Promise<Array>}
   */
  async list(dramaId) {
    const { ctx } = this;

    const episodes = await ctx.model.DramaEpisode.findAll({
      where: { drama_id: dramaId },
      order: [['episode_number', 'ASC']],
      raw: true,
    });

    return episodes.map(ep => ({
      ...ep,
      id: ctx.helper.encodeId(ep.id),
      drama_id: ctx.helper.encodeId(ep.drama_id),
    }));
  }

  /**
   * 创建分集
   * @param {object} data - 分集数据
   * @returns {Promise<object>}
   */
  async create(data) {
    const { ctx } = this;

    /* 检查短剧是否存在 */
    const drama = await ctx.model.Drama.findByPk(data.drama_id);
    if (!drama) {
      throw new Error('短剧不存在');
    }

    const episode = await ctx.model.DramaEpisode.create(data);

    /* 更新短剧总集数 */
    const count = await ctx.model.DramaEpisode.count({
      where: { drama_id: data.drama_id },
    });
    await ctx.model.Drama.update(
      { total_episodes: count },
      { where: { id: data.drama_id } }
    );

    return { id: ctx.helper.encodeId(episode.id) };
  }

  /**
   * 更新分集
   * @param {string|number} id - 分集ID
   * @param {object} data - 更新数据
   */
  async update(id, data) {
    const { ctx } = this;

    const episode = await ctx.model.DramaEpisode.findByPk(id);
    if (!episode) {
      throw new Error('分集不存在');
    }

    await ctx.model.DramaEpisode.update(data, { where: { id } });
  }

  /**
   * 删除分集
   * @param {string|number} id - 分集ID
   */
  async destroy(id) {
    const { ctx } = this;

    const episode = await ctx.model.DramaEpisode.findByPk(id, { raw: true });
    if (!episode) {
      throw new Error('分集不存在');
    }

    await ctx.model.DramaEpisode.destroy({ where: { id } });

    /* 更新短剧总集数 */
    const count = await ctx.model.DramaEpisode.count({
      where: { drama_id: episode.drama_id },
    });
    await ctx.model.Drama.update(
      { total_episodes: count },
      { where: { id: episode.drama_id } }
    );
  }
}

module.exports = EpisodeService;
