'use strict';

const { Service } = require('egg');
const fs = require('fs');
const path = require('path');

/**
 * 分镜头生成服务
 * 将台本内容通过AI生成结构化的分镜头提示词
 */

/* 实时读取分镜生成提示词模板 */
const getStoryboardPrompt = () => {
  const promptPath = path.join(__dirname, '../../prompts/storyboard_generator.txt');
  return fs.readFileSync(promptPath, 'utf-8');
};

/* 实时读取场景结构规划提示词模板 */
const getStructurePrompt = () => {
  const promptPath = path.join(__dirname, '../../prompts/storyboard_structure.txt');
  return fs.readFileSync(promptPath, 'utf-8');
};

/* 实时读取视频分镜生成提示词模板 */
const getVideoStoryboardPrompt = () => {
  const promptPath = path.join(__dirname, '../../prompts/video_storyboard_generator.txt');
  return fs.readFileSync(promptPath, 'utf-8');
};

/* 风格标签映射（中文→中文提示词标签） */
const STYLE_TAGS_MAP = {
  '日系动漫': '日系动漫风格，赛璐璐上色，鲜艳色彩，2D美学',
  '国风水墨': '中国水墨画风格，空灵，极简，传统国画',
  '赛博朋克': '赛博朋克风格，霓虹灯光，高对比度，未来科技',
  '电影写实': '电影级写实风格，胶片质感，戏剧性光影',
  '3D渲染': '3D渲染风格，体积光，光线追踪，高精度建模',
  '仙侠古风': '仙侠古风风格，中国古代奇幻，神秘空灵，2D电影感',
  '欧美卡通': '欧美卡通风格，粗线条，夸张特征',
  '韩漫风格': '韩漫风格，柔和阴影，精致眼部，浪漫氛围',
};

class StoryboardGenerateService extends Service {

  /**
   * 渲染分镜生成的 System Prompt（单场景版本）
   * 替换模板中的占位符，包含场景特定参数
   */
  async renderStoryboardPrompt(scriptData, style, aspectRatio, sceneParams = {}) {
    const { ctx } = this;

    let template = getStoryboardPrompt();

    /* 查询题材名称 */
    const genresStr = await this._getGenresStr(scriptData);

    /* 获取风格标签 */
    const styleTagsEn = STYLE_TAGS_MAP[style] || STYLE_TAGS_MAP['日系动漫'];

    /* 替换占位符 */
    const replacements = {
      genres: genresStr,
      gender: scriptData.gender || '通用',
      style: style || '日系动漫',
      aspect_ratio: aspectRatio || '16:9',
      style_tags: styleTagsEn,
      scene_number: sceneParams.scene_number || 1,
      total_scenes: sceneParams.total_scenes || 1,
      shot_start: sceneParams.shot_start || 1,
      planned_shots: sceneParams.planned_shots || 5,
    };

    for (const [key, value] of Object.entries(replacements)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      template = template.replace(regex, String(value));
    }

    return template;
  }

  /**
   * 渲染场景结构规划的 System Prompt
   */
  async renderStructurePrompt(scriptData, style, aspectRatio) {
    let template = getStructurePrompt();

    const genresStr = await this._getGenresStr(scriptData);
    const styleTagsEn = STYLE_TAGS_MAP[style] || STYLE_TAGS_MAP['日系动漫'];

    const replacements = {
      genres: genresStr,
      gender: scriptData.gender || '通用',
      style: style || '日系动漫',
      aspect_ratio: aspectRatio || '16:9',
      style_tags: styleTagsEn,
    };

    for (const [key, value] of Object.entries(replacements)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      template = template.replace(regex, String(value));
    }

    return template;
  }

  /**
   * 提取题材名称字符串（复用逻辑）
   */
  async _getGenresStr(scriptData) {
    const { ctx } = this;
    if (Array.isArray(scriptData?.genres)) {
      const genres = scriptData.genres
        .map(item => String(item || '').trim())
        .filter(Boolean);
      return genres.length > 0 ? genres.join('、') : '都市';
    }
    if (typeof scriptData?.genres === 'string') {
      const genres = scriptData.genres
        .split(/[、,，/|]/)
        .map(item => item.trim())
        .filter(Boolean);
      return genres.length > 0 ? genres.join('、') : '都市';
    }
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
    return allGenres.length > 0 ? allGenres.join('、') : '都市';
  }

  /**
   * 构建场景结构规划的消息列表
   */
  async buildStructureMessages(scriptData, episodeData, style, aspectRatio) {
    const { ctx } = this;

    const systemContent = await this.renderStructurePrompt(scriptData, style, aspectRatio);

    const parts = [];
    if (scriptData.characters && scriptData.characters.trim()) {
      parts.push(`【人物信息】\n${scriptData.characters.trim()}`);
    }

    const totalEpisodes = scriptData.total_episodes || 80;
    parts.push(`【本集信息】\n第${episodeData.episode_number}集/共${totalEpisodes}集${episodeData.title ? `\n集标题：${episodeData.title}` : ''}`);
    parts.push(`【画风风格】${style || '日系动漫'}`);
    parts.push(`【画面比例】${aspectRatio || '16:9'}`);

    if (episodeData.script_content && episodeData.script_content.trim()) {
      parts.push(`【本集台本】\n${episodeData.script_content.trim()}`);
    }

    parts.push('请分析以上台本内容，规划出完整的场景结构JSON。只输出场景结构，不要输出具体镜头。严格按照系统提示词中定义的JSON结构输出。');

    const messages = [
      { role: 'system', content: systemContent },
      { role: 'user', content: parts.join('\n\n') },
    ];

    ctx.logger.info('[StoryboardGenerate] 场景结构消息构建 => 第%d集, system:%d字, user:%d字',
      episodeData.episode_number, systemContent.length, parts.join('\n\n').length);

    return messages;
  }

  /**
   * 构建单场景分镜生成的消息列表
   * @param {object} scriptData - 剧本主表数据
   * @param {object} episodeData - 剧集数据
   * @param {object} sceneInfo - 当前场景信息（来自结构规划结果）
   * @param {object} structureData - 完整的场景结构规划结果
   * @param {object|null} prevLastShot - 上一场景最后一个镜头（用于衔接）
   * @param {string} style - 画风
   * @param {string} aspectRatio - 比例
   * @param {number} shotStart - 当前场景 shot_number 起始值
   */
  async buildSceneStoryboardMessages(scriptData, episodeData, sceneInfo, structureData, prevLastShot, style, aspectRatio, shotStart) {
    const { ctx } = this;

    const sceneParams = {
      scene_number: sceneInfo.scene_number,
      total_scenes: structureData.scenes.length,
      shot_start: shotStart,
      planned_shots: sceneInfo.planned_shots || 5,
    };

    const systemContent = await this.renderStoryboardPrompt(scriptData, style, aspectRatio, sceneParams);

    const parts = [];

    /* 人物信息 */
    if (structureData.characters && structureData.characters.length > 0) {
      const charText = structureData.characters.map(c => `${c.name}：${c.appearance}`).join('\n');
      parts.push(`【人物信息】\n${charText}`);
    } else if (scriptData.characters && scriptData.characters.trim()) {
      parts.push(`【人物信息】\n${scriptData.characters.trim()}`);
    }

    /* 本集台本 */
    if (episodeData.script_content && episodeData.script_content.trim()) {
      parts.push(`【本集台本】\n${episodeData.script_content.trim()}`);
    }

    /* 场景结构概要（让AI了解全局） */
    const sceneSummaries = structureData.scenes.map(s =>
      `场景${s.scene_number}「${s.scene_name}」${s.scene_time}/${s.scene_location} - ${s.scene_mood} - ${s.planned_shots}个镜头 - ${s.scene_summary || ''}`
    ).join('\n');
    parts.push(`【全集场景结构】\n${sceneSummaries}`);

    /* 当前场景详情 */
    parts.push(`【当前场景】\n场景${sceneInfo.scene_number}「${sceneInfo.scene_name}」\n时间：${sceneInfo.scene_time}\n地点：${sceneInfo.scene_location}\n情绪：${sceneInfo.scene_mood}\n概要：${sceneInfo.scene_summary || ''}\n出场角色：${(sceneInfo.characters_in_scene || []).join('、')}\n规划镜头数：${sceneInfo.planned_shots}\nshot_number起始：${shotStart}`);

    /* 上一场景最后一个镜头（衔接用） */
    if (prevLastShot) {
      parts.push(`【上一场景最后一个镜头（用于衔接过渡）】\n${JSON.stringify(prevLastShot)}`);
    }

    parts.push(`请为当前场景生成 ${sceneInfo.planned_shots} 个镜头的分镜JSON。shot_number 从 ${shotStart} 开始。严格按照系统提示词中定义的JSON结构输出，不要有任何额外文字或markdown标记。`);

    const messages = [
      { role: 'system', content: systemContent },
      { role: 'user', content: parts.join('\n\n') },
    ];

    ctx.logger.info('[StoryboardGenerate] 场景分镜消息构建 => 第%d集, 场景%d/%d, 镜头%d起, system:%d字, user:%d字',
      episodeData.episode_number, sceneInfo.scene_number, structureData.scenes.length,
      shotStart, systemContent.length, parts.join('\n\n').length);

    return messages;
  }

  /**
   * 构建分镜生成的完整消息列表
   * @param {object} scriptData - script 表原始数据
   * @param {object} episodeData - script_episode 表原始数据
   * @param {string} style - 画风风格
   * @param {string} aspectRatio - 画面比例
   * @returns {Promise<Array>} messages 数组
   */
  async buildStoryboardMessages(scriptData, episodeData, style, aspectRatio) {
    const { ctx } = this;

    /* 1. System Prompt */
    const systemContent = await this.renderStoryboardPrompt(scriptData, style, aspectRatio);

    /* 2. 拼装 User Prompt */
    const parts = [];

    /* 人物信息 */
    if (scriptData.characters && scriptData.characters.trim()) {
      parts.push(`【人物信息】\n${scriptData.characters.trim()}`);
    }

    /* 本集信息 */
    const totalEpisodes = scriptData.total_episodes || 80;
    const episodeInfo = [
      `【本集信息】`,
      `第${episodeData.episode_number}集/共${totalEpisodes}集`,
      episodeData.title ? `集标题：${episodeData.title}` : '',
    ].filter(Boolean).join('\n');
    parts.push(episodeInfo);

    /* 画风和比例 */
    parts.push(`【画风风格】${style || '日系动漫'}`);
    parts.push(`【画面比例】${aspectRatio || '16:9'}`);

    /* 本集台本（核心输入） */
    if (episodeData.script_content && episodeData.script_content.trim()) {
      parts.push(`【本集台本】\n${episodeData.script_content.trim()}`);
    }

    parts.push('请根据以上台本内容，生成完整的分镜头提示词JSON。严格按照系统提示词中定义的JSON结构输出，不要有任何额外文字。');

    const userContent = parts.join('\n\n');

    /* 3. 组装消息列表 */
    const messages = [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent },
    ];

    ctx.logger.info(
      '[StoryboardGenerate] 消息构建完成 => 第%d集, system:%d字, user:%d字',
      episodeData.episode_number, systemContent.length, userContent.length
    );

    return messages;
  }

  /**
   * 更新分镜状态
   */
  async updateStoryboardStatus(storyboardId, status, storyboardData = null) {
    const { ctx } = this;
    const updateData = { status };
    if (storyboardData !== null) {
      updateData.storyboard_data = storyboardData;
      /* 尝试解析JSON统计镜头数 */
      try {
        const parsed = JSON.parse(storyboardData);
        updateData.total_shots = parsed.episode_info?.total_shots || 0;
      } catch (e) {
        /* JSON解析失败不影响保存 */
      }
    }
    await ctx.model.EpisodeStoryboard.update(updateData, {
      where: { id: storyboardId },
    });
  }

  /**
   * 获取或创建分镜记录
   * 同一集只保留一条分镜记录，重新生成时覆盖
   */
  async getOrCreateStoryboard(episodeId, scriptId, userId, style, aspectRatio) {
    const { ctx } = this;

    /* 查找已有记录 */
    let storyboard = await ctx.model.EpisodeStoryboard.findOne({
      where: { episode_id: episodeId, user_id: userId },
      raw: true,
    });

    if (storyboard) {
      /* 更新风格和比例参数，同时清除视频分镜数据（首帧变了视频分镜就对不上了） */
      await ctx.model.EpisodeStoryboard.update(
        {
          style, aspect_ratio: aspectRatio,
          status: 1, storyboard_data: null, total_shots: 0,
          video_status: 0, video_storyboard_data: null, video_total_shots: 0,
        },
        { where: { id: storyboard.id } }
      );
      return storyboard.id;
    }

    /* 创建新记录 */
    const newRecord = await ctx.model.EpisodeStoryboard.create({
      script_id: scriptId,
      episode_id: episodeId,
      user_id: userId,
      style,
      aspect_ratio: aspectRatio,
      status: 1,
    });
    return newRecord.id;
  }

  /* ========================================
   * 视频分镜相关方法
   * ======================================== */

  /**
   * 渲染视频分镜生成的 System Prompt
   * 替换模板中的占位符
   */
  async renderVideoStoryboardPrompt(scriptData, style, aspectRatio) {
    let template = getVideoStoryboardPrompt();

    const genresStr = await this._getGenresStr(scriptData);
    const styleTags = STYLE_TAGS_MAP[style] || STYLE_TAGS_MAP['日系动漫'];

    const replacements = {
      genres: genresStr,
      gender: scriptData.gender || '通用',
      style: style || '日系动漫',
      aspect_ratio: aspectRatio || '16:9',
      style_tags: styleTags,
    };

    for (const [key, value] of Object.entries(replacements)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      template = template.replace(regex, value);
    }

    return template;
  }

  /**
   * 构建视频分镜生成的完整消息列表
   * @param {object} scriptData - script 表原始数据
   * @param {object} episodeData - script_episode 表原始数据
   * @param {object} storyboardData - 已有的静态分镜JSON数据
   * @param {string} style - 画风风格
   * @param {string} aspectRatio - 画面比例
   * @returns {Promise<Array>} messages 数组
   */
  async buildVideoStoryboardMessages(scriptData, episodeData, storyboardData, style, aspectRatio) {
    const { ctx } = this;

    /* 1. System Prompt */
    const systemContent = await this.renderVideoStoryboardPrompt(scriptData, style, aspectRatio);

    /* 2. 拼装 User Prompt */
    const parts = [];

    /* 人物信息 */
    if (scriptData.characters && scriptData.characters.trim()) {
      parts.push(`【人物信息】\n${scriptData.characters.trim()}`);
    }

    /* 本集信息 */
    const totalEpisodes = scriptData.total_episodes || 80;
    const episodeInfo = [
      '【本集信息】',
      `第${episodeData.episode_number}集/共${totalEpisodes}集`,
      episodeData.title ? `集标题：${episodeData.title}` : '',
    ].filter(Boolean).join('\n');
    parts.push(episodeInfo);

    /* 画风和比例 */
    parts.push(`【画风风格】${style || '日系动漫'}`);
    parts.push(`【画面比例】${aspectRatio || '16:9'}`);

    /* 本集台本（剧情上下文） */
    if (episodeData.script_content && episodeData.script_content.trim()) {
      parts.push(`【本集台本】\n${episodeData.script_content.trim()}`);
    }

    /* 静态分镜数据（核心输入） */
    const storyboardJson = typeof storyboardData === 'string'
      ? storyboardData
      : JSON.stringify(storyboardData, null, 2);
    parts.push(`【静态分镜数据】\n${storyboardJson}`);

    parts.push('请基于以上静态分镜数据，为每个镜头生成对应的视频分镜词JSON。镜头数量必须与静态分镜严格一一对应，不可增减。严格按照系统提示词中定义的JSON结构输出，不要有任何额外文字。');

    const userContent = parts.join('\n\n');

    /* 3. 组装消息列表 */
    const messages = [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent },
    ];

    ctx.logger.info(
      '[VideoStoryboard] 消息构建完成 => 第%d集, system:%d字, user:%d字',
      episodeData.episode_number, systemContent.length, userContent.length
    );

    return messages;
  }

  /**
   * 构建分批视频分镜生成的消息列表
   * 只传入指定范围的静态分镜shots，让AI只生成这几个镜头
   * @param {object} scriptData - script 表原始数据
   * @param {object} episodeData - script_episode 表原始数据
   * @param {Array} batchShots - 当前批次的静态分镜shots
   * @param {object|null} prevLastShot - 上一批最后一个视频分镜结果（保证转场连贯）
   * @param {string} style - 画风风格
   * @param {string} aspectRatio - 画面比例
   * @param {number} batchIndex - 当前批次序号（从1开始）
   * @param {number} totalBatches - 总批次数
   * @returns {Promise<Array>} messages 数组
   */
  async buildBatchVideoStoryboardMessages(scriptData, episodeData, batchShots, prevLastShot, style, aspectRatio, batchIndex, totalBatches) {
    const { ctx } = this;

    /* 1. System Prompt（复用完整模板） */
    const systemContent = await this.renderVideoStoryboardPrompt(scriptData, style, aspectRatio);

    /* 2. 拼装 User Prompt */
    const parts = [];

    /* 人物信息 */
    if (scriptData.characters && scriptData.characters.trim()) {
      parts.push(`【人物信息】\n${scriptData.characters.trim()}`);
    }

    /* 本集信息 */
    const totalEpisodes = scriptData.total_episodes || 80;
    parts.push(`【本集信息】\n第${episodeData.episode_number}集/共${totalEpisodes}集${episodeData.title ? `\n集标题：${episodeData.title}` : ''}`);

    /* 画风和比例 */
    parts.push(`【画风风格】${style || '日系动漫'}`);
    parts.push(`【画面比例】${aspectRatio || '16:9'}`);

    /* 本集台本（剧情上下文） */
    if (episodeData.script_content && episodeData.script_content.trim()) {
      parts.push(`【本集台本】\n${episodeData.script_content.trim()}`);
    }

    /* 当前批次的静态分镜数据 */
    const shotNumbers = batchShots.map(s => s.shot_number);
    parts.push(`【本批次需要生成的静态分镜数据】\n以下是第${shotNumbers[0]}-${shotNumbers[shotNumbers.length - 1]}个镜头的静态分镜：\n${JSON.stringify(batchShots, null, 2)}`);

    /* 上一批最后一个镜头（保证转场连贯） */
    if (prevLastShot) {
      parts.push(`【上一个镜头的视频分镜结果（用于衔接转场）】\n${JSON.stringify(prevLastShot, null, 2)}`);
    }

    /* 生成指令（和 system prompt 的输出格式保持一致，避免冲突） */
    parts.push(`请基于以上静态分镜数据，只为第${shotNumbers[0]}到第${shotNumbers[shotNumbers.length - 1]}个镜头生成视频分镜词。这是第${batchIndex}批/共${totalBatches}批。
输出格式严格按照系统提示词中定义的JSON结构，其中 episode_info.total_shots 填写本批次的镜头数量（${batchShots.length}），shots 数组只包含本批次的${batchShots.length}个镜头。
严格输出纯净JSON，直接以 { 开头，以 } 结尾，不要有任何markdown标记、代码块标记或额外说明文字。`);

    const userContent = parts.join('\n\n');

    const messages = [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent },
    ];

    ctx.logger.info(
      '[VideoStoryboard] 分批消息构建 => 第%d集, 批次%d/%d, 镜头%d-%d, system:%d字, user:%d字',
      episodeData.episode_number, batchIndex, totalBatches,
      shotNumbers[0], shotNumbers[shotNumbers.length - 1],
      systemContent.length, userContent.length
    );

    return messages;
  }

  /**
   * 更新视频分镜状态
   */
  async updateVideoStoryboardStatus(storyboardId, status, videoData = null) {
    const updateData = { video_status: status };
    if (videoData !== null) {
      updateData.video_storyboard_data = videoData;
      /* 尝试解析JSON统计镜头数 */
      try {
        const parsed = JSON.parse(videoData);
        updateData.video_total_shots = parsed.episode_info?.total_shots || 0;
      } catch (e) {
        /* JSON解析失败不影响保存 */
      }
    }
    await this.ctx.model.EpisodeStoryboard.update(updateData, {
      where: { id: storyboardId },
    });
  }

  /**
   * 初始化视频分镜生成状态（标记为生成中）
   * 复用已有的分镜记录，只更新视频分镜相关字段
   */
  async initVideoStoryboardGeneration(storyboardId) {
    await this.ctx.model.EpisodeStoryboard.update(
      { video_status: 1, video_storyboard_data: null, video_total_shots: 0 },
      { where: { id: storyboardId } }
    );
  }
}

module.exports = StoryboardGenerateService;
