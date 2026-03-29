'use strict';

const { Service } = require('egg');
const NovelAgentAdapter = require('./novelAgentAdapter');

const DEFAULT_STYLE = '日系动漫';
const DEFAULT_ASPECT_RATIO = '9:16';

class NovelStoryboardGenerateService extends Service {

  _safeJsonParse(value, fallback = null) {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch (_) {
      return fallback;
    }
  }

  _buildEpisodePayload(episode) {
    const payload = NovelAgentAdapter.fromDatabase(episode) || {};
    const existingData = this._safeJsonParse(episode.data, {});
    const storyboard = existingData?.storyboard && typeof existingData.storyboard === 'object'
      ? existingData.storyboard
      : {};
    const videoStoryboard = existingData?.videoStoryboard && typeof existingData.videoStoryboard === 'object'
      ? existingData.videoStoryboard
      : {};

    return {
      ...payload,
      storyboard,
      videoStoryboard,
    };
  }

  _extractTotalShots(storyboardData, dataKey) {
    if (!storyboardData) return 0;
    if (typeof storyboardData === 'object') {
      return Number(storyboardData?.episode_info?.total_shots || 0);
    }
    try {
      const parsed = JSON.parse(storyboardData);
      return Number(parsed?.episode_info?.total_shots || 0);
    } catch (_) {
      return 0;
    }
  }

  _buildStoryboardState(episode, project) {
    const payload = this._buildEpisodePayload(episode);
    const storyboard = payload.storyboard || {};
    const videoStoryboard = payload.videoStoryboard || {};
    return {
      style: storyboard.style || project?.art_style || DEFAULT_STYLE,
      aspectRatio: storyboard.aspectRatio || project?.aspect_ratio || DEFAULT_ASPECT_RATIO,
      status: Number(storyboard.status || 0),
      totalShots: Number(storyboard.totalShots || 0),
      storyboardData: storyboard.storyboardData || null,
      videoStatus: Number(videoStoryboard.status || 0),
      videoTotalShots: Number(videoStoryboard.totalShots || 0),
      videoStoryboardData: videoStoryboard.videoStoryboardData || null,
    };
  }

  async getEpisodeWithProject(episodeId, userId) {
    const { ctx } = this;
    const episode = await ctx.model.NovelEpisode.findOne({
      where: { id: episodeId, user_id: userId },
      raw: true,
    });
    if (!episode) {
      return { episode: null, project: null };
    }

    const project = await ctx.model.NovelProject.findOne({
      where: { id: episode.novel_project_id, user_id: userId },
      raw: true,
    });

    return { episode, project };
  }

  async updateStoryboardStatus(episodeId, status, storyboardData = null, options = {}) {
    const { ctx } = this;
    const episode = await ctx.model.NovelEpisode.findByPk(episodeId, { raw: true });
    if (!episode) return;

    const payload = this._buildEpisodePayload(episode);
    const storyboard = payload.storyboard || {};
    const nextStyle = options.style || storyboard.style || DEFAULT_STYLE;
    const nextAspectRatio = options.aspectRatio || storyboard.aspectRatio || DEFAULT_ASPECT_RATIO;

    payload.storyboard = {
      ...storyboard,
      style: nextStyle,
      aspectRatio: nextAspectRatio,
      status,
      totalShots: storyboardData !== null
        ? this._extractTotalShots(storyboardData, 'storyboardData')
        : Number(options.totalShots !== undefined ? options.totalShots : (storyboard.totalShots || 0)),
      storyboardData: storyboardData !== null ? this._safeJsonParse(storyboardData, storyboardData) : (storyboard.storyboardData || null),
    };

    if (options.resetVideo) {
      payload.videoStoryboard = {
        ...(payload.videoStoryboard || {}),
        style: nextStyle,
        aspectRatio: nextAspectRatio,
        status: 0,
        totalShots: 0,
        videoStoryboardData: null,
      };
    }

    await ctx.model.NovelEpisode.update({
      data: JSON.stringify(payload),
    }, {
      where: { id: episodeId },
    });
  }

  async updateVideoStoryboardStatus(episodeId, status, videoStoryboardData = null, options = {}) {
    const { ctx } = this;
    const episode = await ctx.model.NovelEpisode.findByPk(episodeId, { raw: true });
    if (!episode) return;

    const payload = this._buildEpisodePayload(episode);
    const storyboard = payload.storyboard || {};
    const videoStoryboard = payload.videoStoryboard || {};

    payload.videoStoryboard = {
      ...videoStoryboard,
      style: options.style || videoStoryboard.style || storyboard.style || DEFAULT_STYLE,
      aspectRatio: options.aspectRatio || videoStoryboard.aspectRatio || storyboard.aspectRatio || DEFAULT_ASPECT_RATIO,
      status,
      totalShots: videoStoryboardData !== null
        ? this._extractTotalShots(videoStoryboardData, 'videoStoryboardData')
        : Number(options.totalShots !== undefined ? options.totalShots : (videoStoryboard.totalShots || 0)),
      videoStoryboardData: videoStoryboardData !== null
        ? this._safeJsonParse(videoStoryboardData, videoStoryboardData)
        : (videoStoryboard.videoStoryboardData || null),
    };

    await ctx.model.NovelEpisode.update({
      data: JSON.stringify(payload),
    }, {
      where: { id: episodeId },
    });
  }

  async saveStoryboard(episodeId, storyboardData, style, aspectRatio) {
    await this.updateStoryboardStatus(episodeId, 2, storyboardData, {
      style,
      aspectRatio,
    });
  }

  async saveVideoStoryboard(episodeId, videoStoryboardData, style, aspectRatio) {
    await this.updateVideoStoryboardStatus(episodeId, 2, videoStoryboardData, {
      style,
      aspectRatio,
    });
  }

  async batchGetStoryboards(projectId, userId) {
    const { ctx } = this;
    const project = await ctx.model.NovelProject.findOne({
      where: { id: projectId, user_id: userId },
      raw: true,
    });
    if (!project) {
      ctx.throw(404, '项目不存在');
    }

    const episodes = await ctx.model.NovelEpisode.findAll({
      where: { novel_project_id: projectId, user_id: userId },
      order: [['episode_number', 'ASC']],
      raw: true,
    });

    return episodes.map(episode => {
      const state = this._buildStoryboardState(episode, project);
      return {
        episodeId: ctx.helper.encodeId(episode.id),
        style: state.style,
        aspectRatio: state.aspectRatio,
        status: state.status,
        totalShots: state.totalShots,
        storyboardData: state.storyboardData,
        videoStatus: state.videoStatus,
        videoTotalShots: state.videoTotalShots,
        videoStoryboardData: state.videoStoryboardData,
      };
    });
  }
}

module.exports = NovelStoryboardGenerateService;
