'use strict';

const { Service } = require('egg');
const fs = require('fs');
const path = require('path');
const NovelAgentAdapter = require('./novelAgentAdapter');

const getEpisodeScriptPrompt = () => {
  const promptPath = path.join(__dirname, '../../prompts/episode_script.txt');
  return fs.readFileSync(promptPath, 'utf-8');
};

class NovelScriptGenerateService extends Service {

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

  normalizeGenres(genres) {
    const { ctx } = this;
    if (Array.isArray(genres)) {
      return genres.map(item => String(item || '').trim()).filter(Boolean);
    }
    if (typeof genres === 'string') {
      const parsed = ctx.helper.parseJsonArray(genres, null);
      if (Array.isArray(parsed)) {
        return parsed.map(item => String(item || '').trim()).filter(Boolean);
      }
      return genres
        .split(/[、,，/|]/)
        .map(item => item.trim())
        .filter(Boolean);
    }
    return [];
  }

  renderEpisodeScriptPrompt(projectData) {
    let template = getEpisodeScriptPrompt();
    const genreList = this.normalizeGenres(projectData.genres);
    const replacements = {
      duration: String(projectData.duration || 2.0),
      max_scenes: '3',
      dialogue_ratio: '50',
      genres: genreList.length > 0 ? genreList.join('、') : '都市',
      gender: projectData.gender || '通用',
    };

    for (const [key, value] of Object.entries(replacements)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      template = template.replace(regex, value);
    }

    return template;
  }

  cleanText(text) {
    return String(text || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
  }

  splitTextSegments(text) {
    return this.cleanText(text)
      .split(/\n{2,}|(?<=[。！？；])/)
      .map(item => item.trim())
      .filter(Boolean);
  }

  clipText(text, maxLength) {
    const cleaned = this.cleanText(text);
    if (!cleaned) return '';
    return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}...` : cleaned;
  }

  buildEpisodeFocusedStorylineSummary(storyline, episodeData, maxLength = 1800) {
    const text = this.cleanText(storyline);
    if (!text) return '';
    if (text.length <= maxLength) return text;

    const episode = NovelAgentAdapter.fromDatabase(episodeData);
    const keywords = [
      episode.title,
      episode.coreConflict,
      episode.openingHook,
      episode.endingHook,
      episode.emotionalCurve,
      ...(episode.keyEvents || []),
      ...(episode.visualHighlights || []),
      ...(episode.classicQuotes || []),
      ...(episode.characters || []).map(item => item.name),
      ...(episode.scenes || []).map(item => item.name),
      ...(episode.props || []).map(item => item.name),
    ]
      .map(item => this.cleanText(item))
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);

    const relationKeywords = [
      '主角', '女主', '男主', '反派', '关系', '秘密', '背叛', '误会',
      '复仇', '婚约', '结婚', '离婚', '家族', '血脉', '爱', '恨',
      '危机', '反击', '真相', '身份',
    ];

    const segments = this.splitTextSegments(text);
    const scored = segments.map((segment, index) => {
      let score = 0;
      if (index === 0) score += 10;
      if (index < 3) score += 4;
      if (segment.length <= 120) score += 1;

      for (const keyword of relationKeywords) {
        if (segment.includes(keyword)) score += 2;
      }
      for (const keyword of keywords) {
        if (keyword && segment.includes(keyword)) score += 6;
      }

      return { segment, index, score };
    });

    const chosen = [];
    const used = new Set();
    let totalLength = 0;

    for (const item of scored) {
      if (item.index > 1) continue;
      chosen.push(item);
      used.add(item.index);
      totalLength += item.segment.length + 1;
      if (totalLength >= maxLength) break;
    }

    const sortedByScore = [...scored].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    });

    for (const item of sortedByScore) {
      if (used.has(item.index) || item.score <= 0) continue;
      if (totalLength + item.segment.length + 1 > maxLength) continue;
      chosen.push(item);
      used.add(item.index);
      totalLength += item.segment.length + 1;
      if (totalLength >= maxLength - 120) break;
    }

    const summary = chosen
      .sort((a, b) => a.index - b.index)
      .map(item => item.segment)
      .join('\n');

    return summary.length > maxLength ? summary.slice(0, maxLength) : summary;
  }

  buildRelevantCharacterContext(assetCharacters, fallbackText, episodeData, maxLength = 1600) {
    const episode = NovelAgentAdapter.fromDatabase(episodeData);
    const episodeNames = (episode.characters || [])
      .map(item => this.cleanText(item.name))
      .filter(Boolean);

    const assetMap = new Map(
      (assetCharacters || [])
        .map(item => [this.cleanText(item.name), item])
        .filter(([key]) => key)
    );

    const lines = [];
    for (const name of episodeNames) {
      const item = assetMap.get(name);
      if (!item) continue;
      const traits = (item.personality || [])
        .map(part => `${part.keyword}${part.desc ? `：${part.desc}` : ''}`)
        .filter(Boolean)
        .join('；');
      const appearance = (item.appearance || [])
        .map(part => `${part.keyword}${part.desc ? `：${part.desc}` : ''}`)
        .filter(Boolean)
        .join('；');
      const meta = [item.roleType || '', item.gender || '', item.age || ''].filter(Boolean).join(' / ');
      const lineParts = [
        `角色：${item.name}${meta ? `（${meta}）` : ''}`,
        traits ? `性格：${traits}` : '',
        appearance ? `外貌：${appearance}` : '',
        item.relationship ? `关系：${this.clipText(item.relationship, 80)}` : '',
        item.background ? `经历：${this.clipText(item.background, 120)}` : '',
      ].filter(Boolean);
      lines.push(lineParts.join('\n'));
    }

    const uniqueLines = [...new Set(lines)];
    const joined = uniqueLines.join('\n\n');
    if (joined) return this.clipText(joined, maxLength);

    const fallback = this.cleanText(fallbackText);
    if (!fallback) return '';

    if (!episodeNames.length) {
      return this.clipText(fallback, maxLength);
    }

    const segments = this.splitTextSegments(fallback);
    const chosen = [];
    let totalLength = 0;
    for (const segment of segments) {
      if (!episodeNames.some(name => segment.includes(name))) continue;
      if (totalLength + segment.length + 1 > maxLength) break;
      chosen.push(segment);
      totalLength += segment.length + 1;
    }

    if (chosen.length > 0) return chosen.join('\n');
    return this.clipText(fallback, maxLength);
  }

  formatEpisodeStructuredDetail(episodeData) {
    const episode = NovelAgentAdapter.fromDatabase(episodeData);
    const keyEventsLabels = ['起', '承', '转', '合'];
    const formatList = (items, formatter) => (
      Array.isArray(items) && items.length
        ? items.map((item, index) => `- ${formatter(item, index)}`).join('\n')
        : '无'
    );

    return [
      `【核心矛盾】\n${episode.coreConflict || '无'}`,
      `【开场钩子】\n${episode.openingHook || '无'}`,
      `【关键事件】\n${formatList(episode.keyEvents, (item, index) => `【${keyEventsLabels[index] || index + 1}】${item}`)}`,
      `【情感曲线】\n${episode.emotionalCurve || '无'}`,
      `【视觉亮点】\n${formatList(episode.visualHighlights, item => item)}`,
      `【经典台词】\n${formatList(episode.classicQuotes, item => item)}`,
      `【结尾钩子】\n${episode.endingHook || '无'}`,
      `【本集出场角色】\n${formatList(episode.characters, item => `${item.name}：${item.description || '未补充'}`)}`,
      `【本集场景】\n${formatList(episode.scenes, item => `${item.name}：${item.description || '未补充'}`)}`,
      `【本集关键道具】\n${formatList(episode.props, item => `${item.name}：${item.description || '未补充'}`)}`,
    ].join('\n\n');
  }

  async getPreviousEpisodeEnding(projectId, episodeNumber) {
    const { ctx } = this;
    if (episodeNumber <= 1) return null;

    const prevEpisode = await ctx.model.NovelEpisode.findOne({
      where: { novel_project_id: projectId, episode_number: episodeNumber - 1 },
      attributes: ['script_content', 'outline', 'outline_detail'],
      raw: true,
    });
    if (!prevEpisode) return null;

    if (prevEpisode.script_content && prevEpisode.script_content.trim()) {
      const text = prevEpisode.script_content.trim();
      return text.length > 220 ? text.slice(-220) : text;
    }

    const outlineDetail = ctx.helper.parseJsonObject(prevEpisode.outline_detail, {});
    const parts = [
      prevEpisode.outline ? this.clipText(prevEpisode.outline, 180) : '',
      outlineDetail.endingHook ? `结尾钩子：${outlineDetail.endingHook}` : '',
    ].filter(Boolean);

    return parts.length > 0 ? parts.join('\n') : null;
  }

  async buildEpisodeScriptMessages(projectData, episodeData) {
    const { ctx } = this;
    const systemContent = this.renderEpisodeScriptPrompt(projectData);
    const assets = await ctx.service.api.novelProject.assets(projectData.id, episodeData.user_id);
    const totalEpisodes = projectData.total_episodes || 80;
    const storyPhase = this.getStoryPhase(episodeData.episode_number, totalEpisodes);
    const chapterRange = ctx.helper.parseJsonArray(episodeData.chapter_range, []);
    const storylineSummary = this.buildEpisodeFocusedStorylineSummary(projectData.storyline || '', episodeData);
    const characterContext = this.buildRelevantCharacterContext(
      assets.characters,
      projectData.characters,
      episodeData
    );
    const episodeInfo = [
      '【本集信息】',
      `第${episodeData.episode_number}集/共${totalEpisodes}集`,
      episodeData.title ? `集标题：${episodeData.title}` : '',
      chapterRange.length
        ? `覆盖章节：第${chapterRange.join('、')}章`
        : '',
      `叙事阶段：${storyPhase}`,
    ].filter(Boolean).join('\n');
    const parts = [
      `【项目参数】\n单集时长：${projectData.duration || 2}分钟\n题材：${this.normalizeGenres(projectData.genres).join('、') || '都市'}\n受众：${projectData.gender || '通用'}`,
      storylineSummary ? `【全局故事线摘要】\n${storylineSummary}` : '',
      characterContext ? `【相关角色设定】\n${characterContext}` : '',
      episodeInfo,
      `【本集剧情主干】\n${(episodeData.outline || '').trim() || '无'}`,
      this.formatEpisodeStructuredDetail(episodeData),
    ].filter(Boolean);

    const prevEnding = await this.getPreviousEpisodeEnding(episodeData.novel_project_id, episodeData.episode_number);
    if (prevEnding) {
      parts.push(`【上集结尾】\n${prevEnding}`);
    }

    parts.push([
      '【执行要求】',
      '1. 若全局故事线摘要与本集剧情主干存在表述差异，以【本集剧情主干】和【本集结构化约束】为准。',
      '2. 必须严格按照本集剧情主干和关键事件顺序展开，不得擅自改写核心设定。',
      '3. 开场钩子必须作为第一个镜头，结尾钩子必须作为收尾悬念。',
      '4. 本集出场角色、场景、关键道具必须全部使用，并与对应描述保持一致。',
      '5. 经典台词若有，必须自然落入高潮段落原文呈现。',
      '6. 请根据以上信息，将本集大纲扩写为完整的详细台本。',
    ].join('\n'));

    const userContent = parts.join('\n\n');
    ctx.logger.info(
      '[NovelScriptGenerate] 消息构建完成 => 第%d集, system:%d字, user:%d字',
      episodeData.episode_number, systemContent.length, userContent.length
    );

    return [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent },
    ];
  }

  async updateScriptStatus(episodeId, status, scriptContent = null) {
    const { ctx } = this;
    const updateData = { script_status: status };
    if (scriptContent !== null) {
      updateData.script_content = scriptContent;
    }
    await ctx.model.NovelEpisode.update(updateData, {
      where: { id: episodeId },
    });
  }
}

module.exports = NovelScriptGenerateService;
