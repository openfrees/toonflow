'use strict';

const { Service } = require('egg');

/**
 * 小说项目服务
 * 处理小说项目的创建、查询、更新等业务逻辑
 */
class NovelProjectService extends Service {

  /**
   * 统一规范题材字段
   * 支持 genres 数组、genres 字符串、genre 单字符串
   */
  normalizeGenres(input, fallback = []) {
    const { ctx } = this;
    const source = input !== undefined ? input : fallback;
    if (Array.isArray(source)) {
      return source.map(item => String(item || '').trim()).filter(Boolean);
    }
    if (typeof source === 'string') {
      const parsed = ctx.helper.parseJsonArray(source, null);
      if (Array.isArray(parsed)) {
        return parsed.map(item => String(item || '').trim()).filter(Boolean);
      }
      return source
        .split(/[、,，/|]/)
        .map(item => item.trim())
        .filter(Boolean);
    }
    return [];
  }

  /**
   * 创建小说项目 + 批量写入章节
   * @param {object} data - 项目数据 + chapters 章节数组
   * @param {number} userId - 用户ID
   * @param {string} clientIp - 客户端IP
   */
  async create(data, userId, clientIp = '') {
    const { ctx } = this;
    const genres = this.normalizeGenres(data.genres !== undefined ? data.genres : data.genre);
    const chapters = Array.isArray(data.chapters) ? data.chapters : [];
    const copyrightConfirmText = String(data.copyrightConfirmText || '').trim() || '我已获得授权或内容为本人原创';
    const copyrightConfirmVersion = String(data.copyrightConfirmVersion || '').trim() || '2026-03-14-v1';

    await ctx.service.api.membership.ensureNovelSaveAllowed(userId, chapters);
    if (!data.copyrightConfirmAccepted) {
      ctx.throw(400, '请先确认已获得授权或内容为本人原创');
    }

    /* 校正集数：集数不可超过导入章节数（最小10，步进5） */
    let totalEpisodes = Number(data.totalEpisodes) || 80;
    if (chapters.length > 0 && chapters.length < totalEpisodes) {
      totalEpisodes = Math.max(10, Math.floor(chapters.length / 5) * 5);
    }

    const transaction = await ctx.model.transaction();

    try {
      const project = await ctx.model.NovelProject.create({
        user_id: userId,
        title: data.title || '',
        total_episodes: totalEpisodes,
        duration: data.duration || 2,
        gender: data.gender || '男频',
        genres,
        art_style: data.artStyle || '日系动漫',
        aspect_ratio: data.aspectRatio || '9:16',
        status: 0,
        copyright_confirmed: 1,
        copyright_confirm_text: copyrightConfirmText,
        copyright_confirm_version: copyrightConfirmVersion,
        copyright_confirmed_ip: String(clientIp || '').slice(0, 64),
        copyright_confirmed_at: new Date(),
      }, { transaction });

      /* 批量写入章节 */
      const chapterRows = chapters.map((ch, idx) => ({
        novel_project_id: project.id,
        user_id: userId,
        chapter_index: ch.chapterIndex || (idx + 1),
        chapter_title: ch.title || `第${idx + 1}章`,
        chapter_content: ch.content || '',
        word_count: (ch.content || '').length,
        is_selected: 0,
      }));

      if (chapterRows.length > 0) {
        await ctx.model.NovelChapter.bulkCreate(chapterRows, { transaction });
      }

      await transaction.commit();
      return { id: ctx.helper.encodeId(project.id) };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  /**
   * 查询小说项目详情（含章节列表、故事线、分集大纲）
   */
  async detail(id, userId) {
    const { ctx } = this;

    const project = await ctx.model.NovelProject.findOne({
      where: { id, user_id: userId },
      raw: true,
    });
    if (!project) ctx.throw(404, '项目不存在');

    /* 章节列表（元数据，不带正文） */
    const chapters = await ctx.model.NovelChapter.findAll({
      where: { novel_project_id: id },
      order: [['chapter_index', 'ASC']],
      attributes: ['id', 'chapter_index', 'chapter_title', 'word_count', 'is_selected'],
      raw: true,
    });

    /* 故事线 */
    const storyline = await ctx.model.NovelStoryline.findOne({
      where: { novel_project_id: id },
      raw: true,
    });

    /* 分集大纲 */
    const episodes = await ctx.model.NovelEpisode.findAll({
      where: { novel_project_id: id },
      order: [['episode_number', 'ASC']],
      raw: true,
    });

    const totalWords = chapters.reduce((sum, c) => sum + (c.word_count || 0), 0);
    const projectGenres = this.normalizeGenres(project.genres);

    return {
      ...project,
      id: ctx.helper.encodeId(project.id),
      user_id: String(project.user_id),
      genres: projectGenres,
      totalChapters: chapters.length,
      totalWords,
      chapters: chapters.map(c => ({
        ...c,
        id: ctx.helper.encodeId(c.id),
      })),
      storyline: storyline ? {
        id: ctx.helper.encodeId(storyline.id),
        content: storyline.content || '',
        is_locked: storyline.is_locked || 0,
      } : null,
      episodes: episodes.map(ep => {
        const chapterRange = ctx.helper.parseJsonArray(ep.chapter_range, []);
        const outlineDetail = ctx.helper.parseJsonObject(ep.outline_detail, null);
        return {
          ...(episodeData => {
          const storyboard = episodeData?.storyboard && typeof episodeData.storyboard === 'object'
            ? episodeData.storyboard
            : {};
          const videoStoryboard = episodeData?.videoStoryboard && typeof episodeData.videoStoryboard === 'object'
            ? episodeData.videoStoryboard
            : {};
          return {
            storyboardData: storyboard.storyboardData || null,
            storyboardStatus: Number(storyboard.status || 0),
            storyboardTotalShots: Number(storyboard.totalShots || 0),
            storyboardStyle: storyboard.style || project.art_style || '日系动漫',
            storyboardAspectRatio: storyboard.aspectRatio || project.aspect_ratio || '9:16',
            videoStoryboardData: videoStoryboard.videoStoryboardData || null,
            videoStoryboardStatus: Number(videoStoryboard.status || 0),
            videoStoryboardTotalShots: Number(videoStoryboard.totalShots || 0),
          };
          })(this._safeJsonParse(ep.data, {})),
          id: ctx.helper.encodeId(ep.id),
          episodeNumber: ep.episode_number,
          title: ep.title || '',
          chapterRange,
          episodeDuration: outlineDetail?.episodeDuration || null,
          outline: ep.outline || '',
          outlineDetail,
          outlineLocked: ep.outline_locked || 0,
          scriptContent: ep.script_content || '',
          scriptStatus: ep.script_status || 0,
          scriptLocked: ep.script_locked || 0,
        };
      }),
    };
  }

  /**
   * 小说项目列表
   */
  async list(userId, query = {}) {
    const { ctx } = this;
    const { page = 1, pageSize = 20 } = query;
    const offset = (Number(page) - 1) * Number(pageSize);
    const limit = Number(pageSize);

    const count = await ctx.model.NovelProject.count({ where: { user_id: userId } });

    const rows = await ctx.model.NovelProject.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
      offset,
      limit,
      raw: true,
    });

    return {
      rows: rows.map(r => ({
        ...r,
        id: ctx.helper.encodeId(r.id),
        genres: this.normalizeGenres(r.genres),
        user_id: String(r.user_id),
      })),
      count,
    };
  }

  /**
   * 更新小说项目
   */
  async update(id, userId, data) {
    const { ctx } = this;
    const project = await ctx.model.NovelProject.findOne({
      where: { id, user_id: userId },
      raw: true,
    });
    if (!project) ctx.throw(404, '项目不存在');

    /* 支持前端驼峰和数据库下划线两种命名 */
    const fieldMapping = {
      title: 'title',
      cover: 'cover',
      coverPrompt: 'cover_prompt', cover_prompt: 'cover_prompt',
      totalEpisodes: 'total_episodes', total_episodes: 'total_episodes',
      duration: 'duration',
      gender: 'gender',
      genres: 'genres',
      genre: 'genres',
      artStyle: 'art_style', art_style: 'art_style',
      aspectRatio: 'aspect_ratio', aspect_ratio: 'aspect_ratio',
      characters: 'characters',
      charactersLocked: 'characters_locked', characters_locked: 'characters_locked',
      status: 'status',
    };

    const updateData = {};
    for (const [inputKey, dbKey] of Object.entries(fieldMapping)) {
      if (data[inputKey] === undefined) continue;
      updateData[dbKey] = dbKey === 'genres'
        ? this.normalizeGenres(data[inputKey], project.genres)
        : data[inputKey];
    }

    if (Object.keys(updateData).length === 0) return;
    await ctx.model.NovelProject.update(updateData, { where: { id, user_id: userId } });
  }

  /**
   * 批量保存小说分集大纲
   * 按 novel_project_id + user_id + episode_number 做 upsert
   */
  async batchSaveEpisodes(projectId, userId, episodes) {
    const { ctx } = this;
    await this._verifyProject(projectId, userId);

    const savedEpisodes = [];

    for (const ep of episodes) {
      const episodeNumber = Number(ep.episodeNumber);
      if (!episodeNumber || episodeNumber < 1) continue;

      const existing = await ctx.model.NovelEpisode.findOne({
        where: {
          novel_project_id: projectId,
          user_id: userId,
          episode_number: episodeNumber,
        },
        raw: true,
      });

      const updateData = {
        title: ep.title || '',
        outline: ep.content || '',
      };
      if (ep.isLocked !== undefined) {
        updateData.outline_locked = ep.isLocked ? 1 : 0;
      }

      if (existing) {
        await ctx.model.NovelEpisode.update(updateData, {
          where: {
            novel_project_id: projectId,
            user_id: userId,
            episode_number: episodeNumber,
          },
        });
        savedEpisodes.push({
          episodeNumber,
          id: ctx.helper.encodeId(existing.id),
        });
      } else {
        const record = await ctx.model.NovelEpisode.create({
          novel_project_id: projectId,
          user_id: userId,
          episode_number: episodeNumber,
          ...updateData,
        });
        savedEpisodes.push({
          episodeNumber,
          id: ctx.helper.encodeId(record.id),
        });
      }
    }

    return savedEpisodes;
  }

  /**
   * 获取小说项目资产
   */
  async assets(id, userId) {
    const { ctx } = this;
    const project = await ctx.model.NovelProject.findOne({
      where: { id, user_id: userId },
      attributes: [ 'id' ],
      raw: true,
    });
    if (!project) ctx.throw(404, '项目不存在');

    const rows = await ctx.model.NovelAsset.findAll({
      where: { novel_project_id: id },
      order: [[ 'type', 'ASC' ], [ 'id', 'ASC' ]],
      raw: true,
    });

    const characters = [];
    const scenes = [];
    for (const row of rows) {
      if (row.type === '角色') {
        characters.push(this._formatCharacterAsset(row));
      } else if (row.type === '场景') {
        scenes.push(this._formatSceneAsset(row));
      }
    }

    return { characters, scenes };
  }

  /**
   * 保存小说项目资产
   */
  async saveAssets(id, userId, data = {}) {
    const { ctx } = this;
    const { Op } = ctx.app.Sequelize;
    const project = await ctx.model.NovelProject.findOne({
      where: { id, user_id: userId },
      attributes: [ 'id' ],
      raw: true,
    });
    if (!project) ctx.throw(404, '项目不存在');

    const characters = Array.isArray(data.characters) ? data.characters : [];
    const scenes = Array.isArray(data.scenes) ? data.scenes : [];

    /*
     * source 是"出生证明"：AI 创建的永远是 ai，手动创建的永远是 manual
     * 用 id 做 key（不用 name，因为用户可能改名），确保全量重建时 source 不丢
     */
    const existingAssets = await ctx.model.NovelAsset.findAll({
      where: { novel_project_id: id, type: '角色' },
      attributes: ['id', 'name', 'source'],
      raw: true,
    });
    const sourceByIdMap = new Map(existingAssets.map(a => [String(a.id), a.source || 'manual']));
    const sourceByNameMap = new Map(existingAssets.map(a => [a.name, a.source || 'manual']));
    const existingSceneAssets = await ctx.model.NovelAsset.findAll({
      where: { novel_project_id: id, type: '场景' },
      attributes: ['id', 'name', 'source', 'prompt'],
      raw: true,
    });
    const sceneAssetByIdMap = new Map(existingSceneAssets.map(a => [String(a.id), a]));
    const sceneAssetByNameMap = new Map(
      existingSceneAssets.map(a => [this._normalizeAssetName(a.name), a]).filter(([key]) => key)
    );

    const transaction = await ctx.model.transaction();

    try {
      const retainedSceneIds = new Set();
      const retainedSceneNames = new Set();
      const removedSceneImages = [];
      await ctx.model.NovelAsset.destroy({
        where: { novel_project_id: id, type: { [Op.in]: [ '角色', '场景' ] } },
        transaction,
      });

      const records = [];
      for (const item of characters) {
        if (!item?.name) continue;
        /* 优先用 id 查历史 source，其次用 name 兜底，最后才是 manual */
        const historicSource = (item.id && sourceByIdMap.get(String(item.id)))
          || sourceByNameMap.get(item.name)
          || 'manual';
        records.push({
          ...(item.id && Number(item.id) ? { id: Number(item.id) } : {}),
          novel_project_id: id,
          type: '角色',
          name: item.name,
          intro: item.background || '',
          prompt: JSON.stringify({
            roleType: item.roleType || 'other',
            gender: item.gender || '',
            age: item.age || '',
            personality: item.personality || [],
            appearance: item.appearance || [],
            relationship: item.relationship || '',
            background: item.background || '',
            avatar: item.avatar || '',
            avatarPrompt: item.avatarPrompt || '',
          }),
          source: historicSource,
        });
      }

      for (const item of scenes) {
        if (!item?.name) continue;
        const normalizedSceneName = this._normalizeAssetName(item.name);
        const matchedScene = (item.id && sceneAssetByIdMap.get(String(item.id)))
          || sceneAssetByNameMap.get(normalizedSceneName)
          || null;
        const matchedScenePrompt = this._safeJsonParse(matchedScene?.prompt, {});
        const matchedScenePayload = matchedScenePrompt && typeof matchedScenePrompt === 'object' && !Array.isArray(matchedScenePrompt)
          ? matchedScenePrompt
          : {};
        const sceneDescription = item.description || item.intro || '';
        const scenePayload = {
          description: sceneDescription,
          image: item.image || matchedScenePayload.image || '',
          imagePrompt: item.imagePrompt || matchedScenePayload.imagePrompt || '',
        };
        const sceneRecordId = (item.id && Number(item.id))
          || matchedScene?.id
          || null;
        const historicSceneSource = matchedScene?.source
          || item.source
          || 'manual';
        if (sceneRecordId) retainedSceneIds.add(String(sceneRecordId));
        if (normalizedSceneName) retainedSceneNames.add(normalizedSceneName);
        records.push({
          ...(sceneRecordId ? { id: Number(sceneRecordId) } : {}),
          novel_project_id: id,
          type: '场景',
          name: item.name,
          intro: sceneDescription,
          prompt: JSON.stringify(scenePayload),
          source: historicSceneSource,
        });
      }

      for (const asset of existingSceneAssets) {
        const assetId = String(asset.id);
        const assetName = this._normalizeAssetName(asset.name);
        const isRetained = retainedSceneIds.has(assetId) || (assetName && retainedSceneNames.has(assetName));
        if (isRetained) continue;
        const parsed = this._safeJsonParse(asset.prompt, {});
        if (parsed?.image) {
          removedSceneImages.push(parsed.image);
        }
      }

      if (records.length > 0) {
        await ctx.model.NovelAsset.bulkCreate(records, { transaction });
      }
      await transaction.commit();
      for (const imagePath of removedSceneImages) {
        ctx.helper.removeUploadedFile(imagePath);
      }
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  /**
   * 从分集大纲的 outlineDetail.characters 中本地提取角色列表（不用AI）
   * 同名角色合并，保留最长的 description
   * @param {Array} episodes - 分集大纲记录
   * @returns {Array<{name: string, description: string, episodeCount: number}>}
   */
  extractCharactersFromEpisodes(episodes) {
    const { ctx } = this;
    const charMap = new Map();
    const countMap = new Map();

    /* 过滤集合性角色的关键词 */
    const collectiveKeywords = new Set([
      '众人', '宾客', '家丁', '侍卫', '同学们', '路人', '群众',
      '百姓', '士兵', '仆人', '下人', '村民', '围观者',
    ]);

    for (const ep of episodes) {
      const detail = ctx.helper.parseJsonObject(ep.outline_detail || ep.outlineDetail, null);
      if (!detail || !Array.isArray(detail.characters)) continue;

      for (const c of detail.characters) {
        const name = String(c.name || '').trim();
        if (!name) continue;
        if (collectiveKeywords.has(name)) continue;

        const desc = String(c.description || '').trim();
        const existing = charMap.get(name);

        if (!existing || desc.length > existing.length) {
          charMap.set(name, desc);
        }
        countMap.set(name, (countMap.get(name) || 0) + 1);
      }
    }

    return Array.from(charMap.entries()).map(([name, description]) => ({
      name,
      description,
      episodeCount: countMap.get(name) || 1,
    }));
  }

  /**
   * 从已存在角色资产中提取角色列表
   * @param {Array} assets - 角色资产列表
   * @returns {Array<{id: string, name: string, source: string}>}
   */
  extractExistingCharacters(assets = []) {
    return assets
      .filter(item => item && item.name)
      .map(item => ({
        id: String(item.id || ''),
        name: String(item.name || '').trim(),
        source: item.source || 'manual',
      }))
      .filter(item => item.name);
  }

  /**
   * 将故事线压缩成人物导向摘要，减少无关剧情噪音
   * @param {string} storyline - 原始故事线
   * @param {Array} targetCharacters - 目标角色列表
   * @returns {string}
   */
  buildCharacterFocusedStorylineSummary(storyline, targetCharacters = []) {
    const text = String(storyline || '').replace(/\r/g, '').trim();
    if (!text) return '';

    const compactText = text.replace(/[ \t]+/g, ' ');
    if (compactText.length <= 1800) {
      return compactText;
    }

    const targetNames = targetCharacters
      .map(item => String(item?.name || '').trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    const relationKeywords = [
      '主角', '女主', '男主', '反派', '配角', '身份', '关系', '婚约', '结婚', '离婚',
      '复仇', '误会', '相爱', '相杀', '爱上', '恨', '争夺', '背叛', '血脉', '家族',
      '母亲', '父亲', '哥哥', '姐姐', '弟弟', '妹妹', '师父', '徒弟', '上司', '下属',
      '青梅竹马', '未婚夫', '未婚妻', '丈夫', '妻子', '仇人', '宿敌', '秘密',
    ];

    const rawSegments = compactText
      .split(/\n{2,}|(?<=[。！？；])/)
      .map(item => item.trim())
      .filter(Boolean);

    const scoredSegments = rawSegments.map((segment, index) => {
      let score = 0;
      if (index === 0) score += 8;
      if (index < 3) score += 4;
      if (segment.length <= 120) score += 2;

      for (const keyword of relationKeywords) {
        if (segment.includes(keyword)) score += 3;
      }
      for (const name of targetNames) {
        if (name && segment.includes(name)) score += 6;
      }
      return { segment, index, score };
    });

    const chosen = [];
    const used = new Set();
    const maxLength = 1800;
    let totalLength = 0;

    for (const item of scoredSegments) {
      if (item.index > 1) continue;
      chosen.push(item);
      used.add(item.index);
      totalLength += item.segment.length + 1;
    }

    const sortedByScore = [...scoredSegments].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    });

    for (const item of sortedByScore) {
      if (used.has(item.index) || item.score <= 0) continue;
      if (totalLength + item.segment.length + 1 > maxLength) continue;
      chosen.push(item);
      used.add(item.index);
      totalLength += item.segment.length + 1;
      if (totalLength >= maxLength - 160) break;
    }

    const orderedSegments = chosen
      .sort((a, b) => a.index - b.index)
      .map(item => item.segment);

    const summary = orderedSegments.join('\n');
    return summary.length > maxLength ? summary.slice(0, maxLength) : summary;
  }

  /**
   * 获取小说角色同步上下文（仅同步缺失角色，并压缩故事线）
   * @param {number} id - 项目ID
   * @param {number} userId - 用户ID
   * @returns {Promise<object>}
   */
  async getCharacterSyncContext(id, userId) {
    const { ctx } = this;
    const project = await ctx.model.NovelProject.findOne({
      where: { id, user_id: userId },
      raw: true,
    });
    if (!project) ctx.throw(404, '项目不存在');

    const storyline = await ctx.model.NovelStoryline.findOne({
      where: { novel_project_id: id },
      raw: true,
    });

    const episodes = await ctx.model.NovelEpisode.findAll({
      where: { novel_project_id: id },
      order: [['episode_number', 'ASC']],
      raw: true,
    });

    /* 本地提取角色列表（从 outlineDetail.characters 中去重合并） */
    const extractedCharacters = this.extractCharactersFromEpisodes(episodes);
    const assets = await this.assets(id, userId);
    const existingCharacters = this.extractExistingCharacters(assets.characters || []);
    const existingNameSet = new Set(
      existingCharacters.map(item => this._normalizeAssetName(item.name)).filter(Boolean)
    );
    const missingCharacters = extractedCharacters.filter(item => !existingNameSet.has(this._normalizeAssetName(item.name)));
    const storylineContent = storyline?.content || '';
    const storylineSummary = this.buildCharacterFocusedStorylineSummary(storylineContent, missingCharacters);

    return {
      project: {
        title: project.title || '',
        totalEpisodes: project.total_episodes || 0,
        duration: project.duration || 0,
        gender: project.gender || '',
        genres: this.normalizeGenres(project.genres),
        artStyle: project.art_style || '',
        aspectRatio: project.aspect_ratio || '',
      },
      storyline: storylineContent,
      storylineSummary,
      existingCharacters,
      extractedCharacters,
      missingCharacters,
    };
  }

  /**
   * 规范化角色卡载荷
   * @param {object} payload - 原始角色对象
   * @returns {object}
   */
  normalizeCharacterPayload(payload = {}) {
    const personality = Array.isArray(payload.personality) ? payload.personality : [];
    const appearance = Array.isArray(payload.appearance) ? payload.appearance : [];

    return {
      name: String(payload.name || '').trim(),
      roleType: this._normalizeRoleType(payload.roleType),
      gender: String(payload.gender || '').trim(),
      age: String(payload.age || '').trim(),
      personality: personality
        .map(item => ({
          keyword: String(item?.keyword || '').trim(),
          desc: String(item?.desc || '').trim(),
        }))
        .filter(item => item.keyword || item.desc)
        .slice(0, 5),
      appearance: appearance
        .map(item => ({
          keyword: String(item?.keyword || '').trim(),
          desc: String(item?.desc || '').trim(),
        }))
        .filter(item => item.keyword || item.desc)
        .slice(0, 5),
      relationship: String(payload.relationship || '').trim(),
      background: String(payload.background || '').trim(),
      avatar: String(payload.avatar || '').trim(),
      avatarPrompt: String(payload.avatarPrompt || '').trim(),
    };
  }

  /**
   * 单角色 upsert
   * @param {number} id - 项目ID
   * @param {number} userId - 用户ID
   * @param {object} payload - 角色载荷
   * @returns {Promise<{action: string, character: object}>}
   */
  async upsertCharacterAsset(id, userId, payload) {
    const { ctx } = this;
    await this._verifyProject(id, userId);

    const normalized = this.normalizeCharacterPayload(payload);
    if (!normalized.name) {
      ctx.throw(400, '角色名称不能为空');
    }

    const existed = await ctx.model.NovelAsset.findOne({
      where: { novel_project_id: id, type: '角色', name: normalized.name },
      raw: true,
    });

    if (existed) {
      /* 更新已有角色：保留形象图和来源标记 */
      const oldParsed = this._safeJsonParse(existed.prompt, {});
      if (oldParsed.avatar) normalized.avatar = oldParsed.avatar;
      if (oldParsed.avatarPrompt) normalized.avatarPrompt = oldParsed.avatarPrompt;

      await ctx.model.NovelAsset.update({
        intro: normalized.background || '',
        prompt: JSON.stringify(normalized),
      }, {
        where: { id: existed.id },
      });
    } else {
      await ctx.model.NovelAsset.create({
        novel_project_id: id,
        type: '角色',
        name: normalized.name,
        intro: normalized.background || '',
        prompt: JSON.stringify(normalized),
        source: 'ai',
      });
    }

    const latest = await ctx.model.NovelAsset.findOne({
      where: { novel_project_id: id, type: '角色', name: normalized.name },
      raw: true,
    });

    return {
      action: existed ? 'updated' : 'created',
      character: this._formatCharacterAsset(latest),
    };
  }

  /**
   * 清理过期的AI角色：本次AI同步未再生成的 source='ai' 角色视为已废弃，删除
   * 手动创建的角色（source='manual'）绝不删除
   * @param {number} id - 项目ID
   * @param {string[]} currentAiNames - 本次AI同步生成的角色名列表
   * @returns {Promise<number>} 删除数量
   */
  async cleanupStaleAiCharacters(id, currentAiNames) {
    const { ctx } = this;
    const { Op } = ctx.app.Sequelize;

    const where = {
      novel_project_id: id,
      type: '角色',
      source: 'ai',
    };

    if (currentAiNames.length > 0) {
      where.name = { [Op.notIn]: currentAiNames };
    }

    const count = await ctx.model.NovelAsset.destroy({ where });
    return count;
  }

  /**
   * 删除单个角色资产
   * @param {number} projectId - 项目ID
   * @param {number} userId - 用户ID
   * @param {number} characterId - 角色资产ID（novel_asset.id）
   * @returns {Promise<boolean>} 是否删除成功
   */
  async deleteCharacterAsset(projectId, userId, characterId) {
    const { ctx } = this;
    await this._verifyProject(projectId, userId);

    const asset = await ctx.model.NovelAsset.findOne({
      where: { id: characterId, novel_project_id: projectId, type: '角色' },
      raw: true,
    });
    if (!asset) return false;

    /* 清理磁盘上的形象图片 */
    const parsed = this._safeJsonParse(asset.prompt, {});
    if (parsed.avatar) {
      ctx.helper.removeUploadedFile(parsed.avatar);
    }

    await ctx.model.NovelAsset.destroy({ where: { id: characterId } });
    return true;
  }

  /**
   * 删除小说项目（级联清理所有关联数据）
   */
  async destroy(id, userId) {
    const { ctx } = this;
    const project = await ctx.model.NovelProject.findOne({
      where: { id, user_id: userId },
      raw: true,
    });
    if (!project) ctx.throw(404, '项目不存在');

    /* 先记录小说资产关联的上传文件，提交成功后再删磁盘文件 */
    const assetRows = await ctx.model.NovelAsset.findAll({
      where: { novel_project_id: id },
      attributes: ['prompt'],
      raw: true,
    });
    const uploadedFiles = this._collectNovelAssetFilePaths(assetRows);
    const transaction = await ctx.model.transaction();

    try {
      /* 显式按子表到父表顺序删除，避免依赖数据库级联 */
      await ctx.model.NovelAsset.destroy({ where: { novel_project_id: id }, transaction });
      await ctx.model.NovelChatHistory.destroy({ where: { novel_project_id: id }, transaction });
      await ctx.model.NovelEpisode.destroy({ where: { novel_project_id: id }, transaction });
      await ctx.model.NovelStoryline.destroy({ where: { novel_project_id: id }, transaction });
      await ctx.model.NovelChapter.destroy({ where: { novel_project_id: id }, transaction });
      await ctx.model.NovelProject.destroy({ where: { id, user_id: userId }, transaction });
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    this._removeUploadedFiles(uploadedFiles);
  }

  _formatCharacterAsset(row) {
    const parsed = this._safeJsonParse(row.prompt, null);
    return {
      id: String(row.id),
      roleType: parsed?.roleType || 'other',
      name: row.name,
      gender: parsed?.gender || '',
      age: parsed?.age || '',
      personality: parsed?.personality || [],
      appearance: parsed?.appearance || [],
      relationship: parsed?.relationship || '',
      background: parsed?.background || row.intro || '',
      avatar: parsed?.avatar || '',
      avatarPrompt: parsed?.avatarPrompt || '',
      source: row.source || 'manual',
    };
  }

  _formatSceneAsset(row) {
    const parsed = this._safeJsonParse(row.prompt, null);
    const isObjectPayload = parsed && typeof parsed === 'object' && !Array.isArray(parsed);
    return {
      id: String(row.id),
      name: row.name,
      description: isObjectPayload ? (parsed.description || row.intro || '') : (row.intro || ''),
      image: isObjectPayload ? (parsed.image || '') : '',
      imagePrompt: isObjectPayload ? (parsed.imagePrompt || '') : '',
      source: row.source || 'manual',
    };
  }

  _normalizeAssetName(name) {
    return String(name || '')
      .replace(/\s+/g, '')
      .trim()
      .toLowerCase();
  }

  _normalizeRoleType(roleType) {
    const allowList = new Set(['protagonist', 'antagonist', 'ally', 'lover', 'rival', 'other']);
    return allowList.has(roleType) ? roleType : 'other';
  }

  _safeJsonParse(str, defaultValue = null) {
    if (!str) return defaultValue;
    if (typeof str === 'object') return str;
    try {
      return JSON.parse(str);
    } catch (_) {
      return defaultValue;
    }
  }

  _collectNovelAssetFilePaths(assetRows = []) {
    const files = [];
    for (const row of assetRows) {
      const parsed = this._safeJsonParse(row?.prompt, null);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
      if (parsed.avatar) files.push(parsed.avatar);
      if (parsed.image) files.push(parsed.image);
    }
    return Array.from(new Set(files.filter(Boolean)));
  }

  _removeUploadedFiles(filePaths = []) {
    const { ctx } = this;
    for (const filePath of Array.from(new Set(filePaths.filter(Boolean)))) {
      ctx.helper.removeUploadedFile(filePath);
    }
  }

  /**
   * 获取角色资产记录（含权限校验）
   * @param {number} projectId - 项目ID
   * @param {number} userId - 用户ID
   * @param {number} characterId - 角色资产ID
   * @returns {Promise<{asset: object, parsed: object}>}
   */
  async getCharacterAsset(projectId, userId, characterId) {
    const { ctx } = this;
    await this._verifyProject(projectId, userId);

    const asset = await ctx.model.NovelAsset.findOne({
      where: { id: characterId, novel_project_id: projectId, type: '角色' },
      raw: true,
    });
    if (!asset) ctx.throw(404, '角色不存在');

    const parsed = this._safeJsonParse(asset.prompt, {});
    return { asset, parsed };
  }

  /**
   * 更新角色资产的 prompt JSON 中的指定字段
   * @param {number} characterId - 角色资产ID
   * @param {object} existingParsed - 当前已解析的 prompt 对象
   * @param {object} fields - 要更新的字段键值对
   */
  async updateCharacterAssetField(characterId, existingParsed, fields) {
    const { ctx } = this;
    const updated = { ...existingParsed, ...fields };
    await ctx.model.NovelAsset.update(
      { prompt: JSON.stringify(updated) },
      { where: { id: characterId } }
    );
  }

  async _verifyProject(id, userId) {
    const { ctx } = this;
    const project = await ctx.model.NovelProject.findOne({
      where: { id, user_id: userId },
      attributes: ['id'],
      raw: true,
    });
    if (!project) ctx.throw(404, '项目不存在');
  }
}

module.exports = NovelProjectService;
