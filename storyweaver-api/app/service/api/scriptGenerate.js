'use strict';

const { Service } = require('egg');
const fs = require('fs');
const path = require('path');

/**
 * 台本生成服务
 * 将分集大纲（300-400字）扩写为详细台本（2000-3000字）
 */

/* 实时读取台本扩写提示词模板 */
const getEpisodeScriptPrompt = () => {
  const promptPath = path.join(__dirname, '../../prompts/episode_script.txt');
  return fs.readFileSync(promptPath, 'utf-8');
};

class ScriptGenerateService extends Service {

  /**
   * 根据集数和总集数判断当前叙事阶段
   * 基于七点叙事结构自动推断
   */
  getStoryPhase(episodeNumber, totalEpisodes) {
    const ratio = episodeNumber / totalEpisodes;
    if (ratio <= 0.05) return '钩子期——开篇即冲突，瞬间抓住观众';
    if (ratio <= 0.15) return '第一转折点/危机——主角生活被彻底打破';
    if (ratio <= 0.30) return '第一个小高潮——主角获得反击契机，小试牛刀';
    if (ratio <= 0.50) return '中点反转——全剧最大叙事转折';
    if (ratio <= 0.75) return '至暗时刻——主角失去一切，被逼到绝境';
    if (ratio <= 0.90) return '终极反击/高潮——触底反弹，酣畅淋漓的反击';
    return '结局——收束所有剧情线，留有余味';
  }

  /**
   * 读取 episode_script.txt 模板并替换参数占位符
   * @param {object} scriptData - script 表原始数据
   * @returns {Promise<string>} 替换后的 system prompt
   */
  async renderEpisodeScriptPrompt(scriptData) {
    const { ctx } = this;

    let template = getEpisodeScriptPrompt();

    /* 查询题材名称 */
    const genreRelations = await ctx.model.ScriptGenre.findAll({
      where: { script_id: scriptData.id },
      raw: true,
    });
    let genreNames = [];
    if (genreRelations.length > 0) {
      const genreIds = genreRelations.map(r => r.genre_id);
      const genres = await ctx.model.Genre.findAll({
        where: { id: genreIds },
        raw: true,
      });
      genreNames = genres.map(g => g.name);
    }
    const customGenres = scriptData.custom_genres
      ? scriptData.custom_genres.split('/').filter(Boolean)
      : [];
    const allGenres = [...genreNames, ...customGenres];
    const genresStr = allGenres.length > 0 ? allGenres.join('、') : '都市';

    /* 替换占位符 */
    const replacements = {
      duration: String(scriptData.duration || 2.0),
      max_scenes: String(scriptData.max_scenes || 3),
      dialogue_ratio: String(scriptData.dialogue_ratio || 50),
      genres: genresStr,
      gender: scriptData.gender || '通用',
    };

    for (const [key, value] of Object.entries(replacements)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      template = template.replace(regex, value);
    }

    return template;
  }

  /**
   * 获取上一集的结尾内容，用于集与集之间的衔接
   * 优先取上一集台本最后200字，降级取大纲最后100字
   */
  async getPreviousEpisodeEnding(scriptId, episodeNumber) {
    if (episodeNumber <= 1) return null;

    const { ctx } = this;
    const prevEpisode = await ctx.model.ScriptEpisode.findOne({
      where: { script_id: scriptId, episode_number: episodeNumber - 1 },
      attributes: ['script_content', 'content'],
      raw: true,
    });

    if (!prevEpisode) return null;

    /* 优先用台本最后200字 */
    if (prevEpisode.script_content && prevEpisode.script_content.trim()) {
      const text = prevEpisode.script_content.trim();
      return text.length > 200 ? text.slice(-200) : text;
    }

    /* 降级用大纲最后100字 */
    if (prevEpisode.content && prevEpisode.content.trim()) {
      const text = prevEpisode.content.trim();
      return text.length > 100 ? text.slice(-100) : text;
    }

    return null;
  }

  /**
   * 构建台本生成的完整消息列表
   * @param {object} scriptData - script 表原始数据
   * @param {object} episodeData - script_episode 表原始数据
   * @returns {Promise<Array>} messages 数组
   */
  async buildEpisodeScriptMessages(scriptData, episodeData) {
    const { ctx } = this;

    /* 1. System Prompt：episode_script.txt + 参数替换 */
    const systemContent = await this.renderEpisodeScriptPrompt(scriptData);

    /* 2. 拼装 User Prompt */
    const parts = [];

    /* 人物信息 */
    if (scriptData.characters && scriptData.characters.trim()) {
      parts.push(`【人物信息】\n${scriptData.characters.trim()}`);
    }

    /* 剧情线 */
    if (scriptData.plot_lines && scriptData.plot_lines.trim()) {
      parts.push(`【剧情线】\n${scriptData.plot_lines.trim()}`);
    }

    /* 本集信息 */
    const totalEpisodes = scriptData.total_episodes || 80;
    const storyPhase = this.getStoryPhase(episodeData.episode_number, totalEpisodes);
    const episodeInfo = [
      `【本集信息】`,
      `第${episodeData.episode_number}集/共${totalEpisodes}集`,
      episodeData.title ? `集标题：${episodeData.title}` : '',
      `叙事阶段：${storyPhase}`,
    ].filter(Boolean).join('\n');
    parts.push(episodeInfo);

    /* 本集大纲 */
    if (episodeData.content && episodeData.content.trim()) {
      parts.push(`【本集大纲】\n${episodeData.content.trim()}`);
    }

    /* 上集结尾 */
    const prevEnding = await this.getPreviousEpisodeEnding(
      episodeData.script_id, episodeData.episode_number
    );
    if (prevEnding) {
      parts.push(`【上集结尾】\n${prevEnding}`);
    }

    parts.push('请根据以上信息，将本集大纲扩写为完整的详细台本。');

    const userContent = parts.join('\n\n');

    /* 3. 组装消息列表 */
    const messages = [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent },
    ];

    ctx.logger.info(
      '[ScriptGenerate] 消息构建完成 => 第%d集, system:%d字, user:%d字',
      episodeData.episode_number, systemContent.length, userContent.length
    );

    return messages;
  }

  /**
   * 更新台本状态
   */
  async updateScriptStatus(episodeId, status, scriptContent = null) {
    const { ctx } = this;
    const updateData = { script_status: status };
    if (scriptContent !== null) {
      updateData.script_content = scriptContent;
    }
    await ctx.model.ScriptEpisode.update(updateData, {
      where: { id: episodeId },
    });
  }
}

module.exports = ScriptGenerateService;
