'use strict';

const { Service } = require('egg');
const NovelAgentAdapter = require('./novelAgentAdapter');

/**
 * Agent 工具执行器
 * 提供 AI Agent tool calling 所需的全部数据操作
 * 使用适配器模式对齐 Toonflow 逻辑
 */
class NovelAgentToolsService extends Service {

  /**
   * 获取章节列表（元数据，不含正文）
   */
  async getChapterList(projectId) {
    const { ctx } = this;
    const chapters = await ctx.model.NovelChapter.findAll({
      where: { novel_project_id: projectId },
      order: [['chapter_index', 'ASC']],
      attributes: ['chapter_index', 'chapter_title', 'word_count'],
      raw: true,
    });

    if (chapters.length === 0) return '当前项目没有上传小说章节，请先上传小说。';

    const list = chapters.map(c =>
      `第${c.chapter_index}章 ${c.chapter_title || ''}（${c.word_count || 0}字）`
    );
    return `共 ${chapters.length} 个章节：\n${list.join('\n')}`;
  }

  /**
   * 获取指定章节的原文内容
   */
  async getChapter(projectId, chapterNumbers) {
    const { ctx } = this;
    const { Op } = ctx.app.Sequelize;

    const chapters = await ctx.model.NovelChapter.findAll({
      where: {
        novel_project_id: projectId,
        chapter_index: { [Op.in]: chapterNumbers },
      },
      order: [['chapter_index', 'ASC']],
      attributes: ['chapter_index', 'chapter_title', 'chapter_content'],
      raw: true,
    });

    if (chapters.length === 0) return '未找到指定章节';

    return chapters.map(c =>
      `\n【第${c.chapter_index}章 ${c.chapter_title || ''}】\n${c.chapter_content || ''}`
    ).join('\n\n---\n');
  }

  /**
   * 获取当前故事线
   */
  async getStoryline(projectId) {
    const { ctx } = this;
    const storyline = await ctx.model.NovelStoryline.findOne({
      where: { novel_project_id: projectId },
      raw: true,
    });

    if (!storyline || !storyline.content) return '当前项目还没有故事线。';
    return storyline.content;
  }

  /**
   * 获取故事线覆盖进度
   */
  async getStorylineCoverage(projectId) {
    const { ctx } = this;
    const storyline = await ctx.model.NovelStoryline.findOne({
      where: { novel_project_id: projectId },
      attributes: [ 'content' ],
      raw: true,
    });

    const chapters = await ctx.model.NovelChapter.findAll({
      where: { novel_project_id: projectId },
      attributes: [ 'chapter_index' ],
      order: [[ 'chapter_index', 'ASC' ]],
      raw: true,
    });

    const selectedMaxChapter = chapters.length > 0
      ? Math.max(...chapters.map(c => Number(c.chapter_index) || 0))
      : 0;
    const selectedCount = chapters.length;
    const content = storyline?.content || '';
    const coveredMaxChapter = this._extractStorylineMaxChapter(content);
    const hasStoryline = !!content.trim();
    const isComplete = hasStoryline && selectedMaxChapter > 0 && coveredMaxChapter >= selectedMaxChapter;

    return {
      hasStoryline,
      selectedCount,
      selectedMaxChapter,
      coveredMaxChapter,
      isComplete,
    };
  }

  /**
   * 保存/更新故事线（UPSERT，尊重锁定状态）
   */
  async saveStoryline(projectId, userId, content) {
    const { ctx } = this;
    const normalizedContent = String(content || '').trim();
    if (!normalizedContent) {
      return '未执行保存：故事线内容为空，请传入完整故事线全文。';
    }

    const existing = await ctx.model.NovelStoryline.findOne({
      where: { novel_project_id: projectId },
      raw: true,
    });

    const validation = this._validateStorylineForSave(normalizedContent, existing?.content || '');
    if (!validation.ok) {
      return `未执行保存：${validation.reason}`;
    }

    if (existing) {
      if (existing.is_locked) return '故事线已被用户锁定，无法覆盖。请先解锁后再修改。';
      await ctx.model.NovelStoryline.update(
        { content: normalizedContent },
        { where: { novel_project_id: projectId } }
      );
    } else {
      await ctx.model.NovelStoryline.create({
        novel_project_id: projectId,
        user_id: userId,
        content: normalizedContent,
      });
    }

    return '故事线保存成功';
  }

  /**
   * 获取已有大纲列表（简化版，仅ID和集数）
   * 对标 Toonflow getOutline(simplified: true)
   */
  async getOutlineSimplified(projectId) {
    const { ctx } = this;
    const records = await ctx.model.NovelEpisode.findAll({
      where: { novel_project_id: projectId },
      order: [['episode_number', 'ASC']],
      raw: true,
    });

    if (records.length === 0) return '当前项目还没有分集大纲。';

    /* 使用适配器转换 */
    const episodes = records.map(r => {
      const episodeData = NovelAgentAdapter.fromDatabase(r);
      return { id: r.id, episodeIndex: episodeData.episodeIndex };
    });

    const list = episodes.map(ep => `第 ${ep.episodeIndex} 集 (id=${ep.id})`).join('\n');
    return `项目大纲 (共 ${episodes.length} 集):\n${list}`;
  }

  /**
   * 获取已有大纲列表（完全对齐 Toonflow）
   * 对标 Toonflow getOutlineText :301-319
   * @param {number} projectId - 项目ID
   * @param {number} [episodeNumber] - 可选，指定集数时只返回该集大纲（避免长列表导致AI阅读错位）
   */
  async getOutline(projectId, episodeNumber) {
    const { ctx } = this;
    const where = { novel_project_id: projectId };
    if (episodeNumber) {
      where.episode_number = episodeNumber;
    }
    const records = await ctx.model.NovelEpisode.findAll({
      where,
      order: [['episode_number', 'ASC']],
      raw: true,
    });

    if (records.length === 0) {
      return episodeNumber
        ? `未找到第${episodeNumber}集的大纲。`
        : '当前项目还没有分集大纲。';
    }

    /* 使用适配器转换（对齐 Toonflow safeParseJson） */
    const episodes = records.map(r => ({
      id: r.id,
      episode: r.episode_number,
      ...NovelAgentAdapter.fromDatabase(r),
    }));

    /* 格式化输出（对齐 Toonflow formatOutlineDetail） */
    const totalCount = episodeNumber
      ? (await ctx.model.NovelEpisode.count({ where: { novel_project_id: projectId } }))
      : episodes.length;
    const header = episodeNumber
      ? `第${episodeNumber}集大纲（项目共 ${totalCount} 集）\n`
      : `项目大纲 (共 ${episodes.length} 集)\n`;
    const details = episodes.map(ep => this._formatOutlineDetail(ep)).join('\n\n');
    return header + '\n' + details;
  }

  /**
   * 获取大纲覆盖进度（基于已保存的 chapterRange）
   */
  async getOutlineCoverage(projectId) {
    const { ctx } = this;
    const records = await ctx.model.NovelEpisode.findAll({
      where: { novel_project_id: projectId },
      order: [[ 'episode_number', 'ASC' ]],
      attributes: [ 'id', 'episode_number', 'chapter_range', 'data', 'outline_detail' ],
      raw: true,
    });

    if (!records.length) {
      return {
        totalEpisodes: 0,
        lastEpisodeNumber: 0,
        maxChapter: 0,
        nextChapter: 1,
      };
    }

    let maxChapter = 0;
    let lastEpisodeNumber = 0;
    for (const record of records) {
      const episodeData = NovelAgentAdapter.fromDatabase(record);
      const range = this._normalizeChapterRange(episodeData.chapterRange || record.chapter_range);
      if (range.length > 0) {
        maxChapter = Math.max(maxChapter, range[range.length - 1]);
      }
      const epNo = Number(record.episode_number) || 0;
      if (epNo > lastEpisodeNumber) lastEpisodeNumber = epNo;
    }

    return {
      totalEpisodes: records.length,
      lastEpisodeNumber,
      maxChapter,
      nextChapter: maxChapter > 0 ? maxChapter + 1 : 1,
    };
  }

  /**
   * 格式化单集大纲详情（对齐 Toonflow formatOutlineDetail :261-299）
   */
  _formatOutlineDetail(ep) {
    const formatList = (items, formatter) =>
      items?.map((item, i) => `  ${i + 1}. ${formatter(item)}`).join('\n') || '  无';

    // keyEvents 按顺序显示：起、承、转、合
    const keyEventsLabels = ['起', '承', '转', '合'];
    const formatKeyEvents = (events) =>
      events?.map((e, i) => `  【${keyEventsLabels[i] || i + 1}】${e}`).join('\n') || '  无';

    return `
大纲ID: ${ep.id}
第 ${ep.episodeIndex || ep.episode} 集: ${ep.title || ''}
${'='.repeat(50)}
章节范围: ${ep.chapterRange?.join(', ') || ''}
单集时长: ${ep.episodeDuration ? `${ep.episodeDuration}分钟` : '未标注'}
核心矛盾: ${ep.coreConflict || ''}

【剧情主干】(最高优先级，剧本生成的唯一权威):
${ep.outline || '无'}

【开场镜头】(必须作为剧本第一个镜头):
${ep.openingHook || '无'}

【剧情节点】(严格按顺序：起→承→转→合):
${formatKeyEvents(ep.keyEvents)}

情绪曲线: ${ep.emotionalCurve || ''}

【视觉重点】(按剧情主干顺序排列):
${formatList(ep.visualHighlights, v => v)}

【结尾悬念】:
${ep.endingHook || '无'}

【经典台词】:
${formatList(ep.classicQuotes, q => q)}

角色(按出场顺序): ${ep.characters?.map(c => `${c.name}(${c.description})`).join('; ') || '无'}
场景(按出场顺序): ${ep.scenes?.map(s => `${s.name}(${s.description})`).join('; ') || '无'}
道具(按出场顺序): ${ep.props?.map(p => `${p.name}(${p.description})`).join('; ') || '无'}`;
  }

  /**
   * 批量保存大纲（完全对齐 Toonflow）
   * 对标 Toonflow saveOutlineData :219-241
   * @param {number} projectId - 项目ID
   * @param {number} userId - 用户ID
   * @param {Array} episodes - 大纲数据数组（完整 EpisodeData）
   * @param {boolean} overwrite - 是否覆盖模式
  * @param {number} startEpisode - 追加模式下的起始集数
  */
  async saveOutline(projectId, userId, episodes, overwrite, startEpisode) {
    const { ctx } = this;

    if (!Array.isArray(episodes) || episodes.length === 0) {
      return '未执行保存：未提供有效的大纲数据';
    }
    if (episodes.length > 1) {
      return '未执行保存：为避免超长输出与保存失败，saveOutline 当前仅支持单次保存1集，请逐集调用。';
    }

    const existingCount = await ctx.model.NovelEpisode.count({
      where: { novel_project_id: projectId },
    });
    const existingCoverage = await this.getOutlineCoverage(projectId);

    if (existingCount > 0 && overwrite === undefined) {
      return `未执行保存：当前已有 ${existingCount} 集大纲。请先确认保存方式：覆盖现有大纲（overwrite=true）或追加到末尾（overwrite=false）。`;
    }

    const shouldOverwrite = overwrite === undefined ? true : overwrite;

    const project = await ctx.model.NovelProject.findOne({
      where: { id: projectId },
      attributes: ['duration'],
      raw: true,
    });
    const projectDuration = Number(project?.duration || 0) || null;

    if (shouldOverwrite) {
      /* 覆盖模式：清空所有未锁定的大纲（对齐 Toonflow clearOutlinesAndScripts） */
      await ctx.model.NovelEpisode.destroy({
        where: { novel_project_id: projectId, outline_locked: 0 },
      });
    }

    /* 计算起始集数（对齐 Toonflow actualStart 逻辑） */
    let actualStart = startEpisode;
    if (!actualStart) {
      if (shouldOverwrite) {
        actualStart = 1;
      } else {
        // 追加模式：获取当前最大集数 + 1
        const maxResult = await ctx.model.NovelEpisode.findAll({
          where: { novel_project_id: projectId },
          attributes: [[ctx.model.Sequelize.fn('MAX', ctx.model.Sequelize.col('episode_number')), 'maxEpisode']],
          raw: true,
        });
        actualStart = (maxResult[0]?.maxEpisode || 0) + 1;
      }
    }

    const normalizedEpisodes = episodes.map(ep => {
      const episodeDuration = Number(ep.episodeDuration || ep.duration || projectDuration || 0) || null;

      return {
        ...ep,
        episodeDuration,
        outline: ep.outline || '',
      };
    });

    if (normalizedEpisodes.length === 0) {
      return '未执行保存：未提供有效的大纲数据';
    }

    const normalizedRanges = [];
    for (let i = 0; i < normalizedEpisodes.length; i++) {
      const range = this._normalizeChapterRange(normalizedEpisodes[i].chapterRange);
      if (!range.length) {
        return `未执行保存：第${i + 1}条大纲缺少有效的 chapterRange。`;
      }
      if (!this._isContinuousRange(range)) {
        return `未执行保存：第${i + 1}条大纲 chapterRange 必须连续递增（如 [7,8,9]）。`;
      }
      normalizedRanges.push(range);
    }

    const expectedFirstChapter = shouldOverwrite ? 1 : existingCoverage.nextChapter;
    const actualFirstChapter = normalizedRanges[0][0];
    if (actualFirstChapter !== expectedFirstChapter) {
      return `未执行保存：当前大纲已覆盖到第${existingCoverage.maxChapter}章，新增大纲必须从第${expectedFirstChapter}章开始，收到的是第${actualFirstChapter}章。`;
    }

    let expectedChapter = expectedFirstChapter;
    for (let i = 0; i < normalizedRanges.length; i++) {
      const range = normalizedRanges[i];
      if (range[0] !== expectedChapter) {
        return `未执行保存：第${i + 1}条大纲起始章节应为第${expectedChapter}章，实际为第${range[0]}章。`;
      }
      expectedChapter = range[range.length - 1] + 1;
      normalizedEpisodes[i].chapterRange = range;
    }

    /* 批量插入大纲（使用适配器转换） */
    const insertList = normalizedEpisodes.map((ep, idx) => {
      const episodeData = { ...ep, episodeIndex: actualStart + idx };
      const dbFields = NovelAgentAdapter.toDatabase(episodeData);
      return {
        novel_project_id: projectId,
        user_id: userId,
        episode_number: actualStart + idx,
        ...dbFields,
      };
    });

    await ctx.model.NovelEpisode.bulkCreate(insertList);

    /* 根据 chapterRange 标记对应章节为"已被大纲覆盖" */
    await this._syncChapterSelectedByProject(projectId);

    return `大纲保存成功：插入 ${insertList.length} 集大纲`;
  }

  /**
   * 删除指定大纲（按ID精确删除）及其关联的剧本、资产等数据
   * 对标 Toonflow deleteOutlineData :255-259
   * 仅主Agent可调用，子Agent无权限
   */
  async deleteOutline(projectId, ids) {
    const { ctx } = this;
    if (!ids || ids.length === 0) return '未指定要删除的大纲ID';

    const { Op } = ctx.app.Sequelize;
    const episodes = await ctx.model.NovelEpisode.findAll({
      where: { id: { [Op.in]: ids }, novel_project_id: projectId },
      raw: true,
    });

    if (episodes.length === 0) return '未找到指定的大纲记录，可能已被删除';

    const lockedEps = episodes.filter(e => e.outline_locked);
    if (lockedEps.length > 0) {
      const lockedNumbers = lockedEps.map(e => e.episode_number);
      return `第${lockedNumbers.join('、')}集大纲已锁定，无法删除。请先解锁后再操作。`;
    }

    const deletedNumbers = episodes.map(e => e.episode_number);

    await ctx.model.NovelEpisode.destroy({
      where: { id: { [Op.in]: ids }, novel_project_id: projectId },
    });

    /* 重新计算章节覆盖状态 */
    await this._syncChapterSelectedByProject(projectId);

    return `已删除 ${episodes.length} 集大纲（第${deletedNumbers.join('、')}集），关联数据已同步清理`;
  }

  /**
   * 删除当前项目的故事线
   * 仅主Agent可调用，子Agent无权限
   */
  async deleteStoryline(projectId) {
    const { ctx } = this;
    const existing = await ctx.model.NovelStoryline.findOne({
      where: { novel_project_id: projectId },
      raw: true,
    });

    if (!existing) return '当前项目没有故事线，无需删除';
    if (existing.is_locked) return '故事线已被用户锁定，无法删除。请先解锁。';

    await ctx.model.NovelStoryline.destroy({
      where: { novel_project_id: projectId },
    });

    return '故事线已删除';
  }

  /**
   * 从大纲中提取并生成资产（角色、道具、场景）
   * 完全对齐 Toonflow generateAssetsFromOutlines :373-396
   */
  async generateAssets(projectId) {
    const { ctx } = this;

    // 获取所有大纲数据
    const outlines = await ctx.model.NovelEpisode.findAll({
      where: { novel_project_id: projectId },
      raw: true,
    });

    if (!outlines.length) return '当前项目没有大纲数据，无法生成资产';

    // 提取资产（使用适配器转换）
    const { characters, props, scenes } = this._extractAssetsFromOutlines(outlines);

    // 只做新增和更新，不做删除（对齐 Toonflow）
    const stats = { inserted: 0, updated: 0, skipped: 0 };

    // 处理角色
    for (const item of characters) {
      const result = await this._upsertAsset(projectId, '角色', item);
      stats[result]++;
    }

    // 处理道具
    for (const item of props) {
      const result = await this._upsertAsset(projectId, '道具', item);
      stats[result]++;
    }

    // 处理场景
    for (const item of scenes) {
      const result = await this._upsertAsset(projectId, '场景', item);
      stats[result]++;
    }

    return `资产生成完成：新增 ${stats.inserted}，更新 ${stats.updated}，保持 ${stats.skipped}`;
  }

  /**
   * 从大纲数组中提取资产（对齐 Toonflow extractAssetsFromOutlines :352-371）
   */
  _extractAssetsFromOutlines(outlines) {
    const result = { characters: [], props: [], scenes: [] };

    for (const outline of outlines) {
      // 使用适配器转换
      const data = NovelAgentAdapter.fromDatabase(outline);

      if (data.characters) result.characters.push(...data.characters);
      if (data.props) result.props.push(...data.props);
      if (data.scenes) result.scenes.push(...data.scenes);
    }

    // 去重（对齐 Toonflow uniqueByName）
    return {
      characters: this._uniqueByName(result.characters),
      props: this._uniqueByName(result.props),
      scenes: this._uniqueByName(result.scenes),
    };
  }

  /**
   * 按 name 去重（对齐 Toonflow uniqueByName :116-118）
   */
  _uniqueByName(items) {
    const map = new Map();
    for (const item of items) {
      if (item.name && !map.has(item.name)) {
        map.set(item.name, item);
      }
    }
    return Array.from(map.values());
  }

  /**
   * 插入或更新资产（对齐 Toonflow upsertAsset :327-350）
   */
  async _upsertAsset(projectId, type, item) {
    const { ctx } = this;

    // 查找已存在的资产
    const existing = await ctx.model.NovelAsset.findOne({
      where: { novel_project_id: projectId, type, name: item.name },
      raw: true,
    });

    if (!existing) {
      // 新增
      await ctx.model.NovelAsset.create({
        novel_project_id: projectId,
        type,
        name: item.name,
        intro: item.description,
        prompt: item.description,
      });
      return 'inserted';
    }

    // 如果描述有变化，则更新
    if (existing.intro !== item.description) {
      await ctx.model.NovelAsset.update(
        { intro: item.description, prompt: item.description },
        { where: { id: existing.id } }
      );
      return 'updated';
    }

    return 'skipped';
  }

  /**
   * 根据大纲ID更新单集大纲（完全对齐 Toonflow）
   * 对标 Toonflow updateOutlineData :243-253
   */
  async updateOutlineById(projectId, id, data) {
    const { ctx } = this;
    const episode = await ctx.model.NovelEpisode.findOne({
      where: { id, novel_project_id: projectId },
      raw: true,
    });

    if (!episode) return `未找到ID为${id}的大纲`;
    if (episode.outline_locked) return `大纲ID ${id} 已锁定，无法修改。请先解锁。`;

    /* 使用适配器转换后更新 */
    const dbFields = NovelAgentAdapter.toDatabase(data);
    await ctx.model.NovelEpisode.update(dbFields, { where: { id } });

    /* chapterRange 可能变化，同步章节覆盖状态 */
    if (data.chapterRange) {
      await this._syncChapterSelectedByProject(projectId);
    }

    return `大纲ID ${id} 更新成功`;
  }

  /**
   * 在指定集数位置插入/替换单集大纲（跳过连续性检查）
   * 用于"重新生成第X集"场景，当该集已被删除时直接创建
   * 如果该集已存在则更新，不存在则创建
   */
  async insertEpisodeOutline(projectId, userId, episodeNumber, episodeData) {
    const { ctx } = this;

    if (!episodeNumber || episodeNumber <= 0) {
      return '未执行保存：集数必须大于0';
    }
    if (!episodeData) {
      return '未执行保存：未提供大纲数据';
    }

    const existing = await ctx.model.NovelEpisode.findOne({
      where: { novel_project_id: projectId, episode_number: episodeNumber },
      raw: true,
    });

    const dbFields = NovelAgentAdapter.toDatabase({
      ...episodeData,
      episodeIndex: episodeNumber,
    });

    if (existing) {
      if (existing.outline_locked) {
        return `第${episodeNumber}集大纲已锁定，无法修改。请先解锁。`;
      }
      await ctx.model.NovelEpisode.update(dbFields, { where: { id: existing.id } });
      return `第${episodeNumber}集大纲更新成功（大纲ID: ${existing.id}）`;
    }

    const record = await ctx.model.NovelEpisode.create({
      novel_project_id: projectId,
      user_id: userId,
      episode_number: episodeNumber,
      ...dbFields,
    });

    /* 同步章节覆盖状态 */
    await this._syncChapterSelectedByProject(projectId);

    return `第${episodeNumber}集大纲创建成功（大纲ID: ${record.id}）`;
  }

  /**
   * 根据项目所有大纲的 chapterRange 重新计算章节的 is_selected 状态
   * 先全部置 0，再把被大纲覆盖的章节置 1
   */
  async _syncChapterSelectedByProject(projectId) {
    const { ctx } = this;
    const { Op } = ctx.app.Sequelize;

    /* 1. 全部重置为 0 */
    await ctx.model.NovelChapter.update(
      { is_selected: 0 },
      { where: { novel_project_id: projectId } }
    );

    /* 2. 收集所有大纲的 chapterRange */
    const episodes = await ctx.model.NovelEpisode.findAll({
      where: { novel_project_id: projectId },
      attributes: ['chapter_range', 'data', 'outline_detail'],
      raw: true,
    });

    const coveredChapters = new Set();
    for (const ep of episodes) {
      const epData = NovelAgentAdapter.fromDatabase(ep);
      const range = this._normalizeChapterRange(epData.chapterRange || ep.chapter_range);
      range.forEach(n => coveredChapters.add(n));
    }

    /* 3. 批量标记被覆盖的章节 */
    if (coveredChapters.size > 0) {
      await ctx.model.NovelChapter.update(
        { is_selected: 1 },
        { where: { novel_project_id: projectId, chapter_index: { [Op.in]: [...coveredChapters] } } }
      );
    }
  }

  /**
   * 归一化章节数组
   */
  _normalizeChapterRange(chapterRange) {
    let source = chapterRange;
    if (typeof source === 'string') {
      try {
        source = JSON.parse(source);
      } catch (_) {
        source = [];
      }
    }
    if (!Array.isArray(source)) return [];

    const numbers = source
      .map(n => Number(n))
      .filter(n => Number.isInteger(n) && n > 0)
      .sort((a, b) => a - b);

    return Array.from(new Set(numbers));
  }

  /**
   * 判断章节范围是否连续
   */
  _isContinuousRange(range) {
    if (!Array.isArray(range) || !range.length) return false;
    for (let i = 1; i < range.length; i++) {
      if (range[i] !== range[i - 1] + 1) return false;
    }
    return true;
  }

  /**
   * 从故事线文本中提取覆盖到的最大章节
   */
  _extractStorylineMaxChapter(content = '') {
    if (!content) return 0;
    let maxChapter = 0;

    const rangeRegex = /第\s*(\d+)\s*[-~—到至]\s*(\d+)\s*章/g;
    let match;
    while ((match = rangeRegex.exec(content)) !== null) {
      const end = Number(match[2]) || 0;
      if (end > maxChapter) maxChapter = end;
    }

    const singleRegex = /第\s*(\d+)\s*章/g;
    while ((match = singleRegex.exec(content)) !== null) {
      const value = Number(match[1]) || 0;
      if (value > maxChapter) maxChapter = value;
    }

    return maxChapter;
  }

  _validateStorylineForSave(newContent, existingContent = '') {
    const content = String(newContent || '').trim();
    const oldContent = String(existingContent || '').trim();

    if (!/^《[^》]+》/.test(content)) {
      return { ok: false, reason: '检测到内容不是完整故事线开头（缺少《书名》标题）。请一次性提交完整故事线全文。' };
    }

    const missingSections = this._getStorylineMissingSections(content);

    if (missingSections.length > 0) {
      return {
        ok: false,
        reason: `检测到内容缺少关键板块：${missingSections.join('、')}。saveStoryline 仅接受完整故事线，不支持“第二部分/第三部分”分段覆盖。`,
      };
    }

    if (oldContent) {
      const oldMissingSections = this._getStorylineMissingSections(oldContent);
      const oldIsStructurallyComplete = oldMissingSections.length === 0;

      if (!oldIsStructurallyComplete) {
        return { ok: true, reason: '' };
      }

      const oldMax = this._extractStorylineMaxChapter(oldContent);
      const newMax = this._extractStorylineMaxChapter(content);

      if (newMax < oldMax) {
        return { ok: false, reason: `新内容章节覆盖回退（旧覆盖第${oldMax}章，新覆盖第${newMax}章），已阻止覆盖。` };
      }

      if (newMax === oldMax && content.length < Math.floor(oldContent.length * 0.8)) {
        return { ok: false, reason: '新内容长度显著变短且覆盖未提升，疑似分段片段，已阻止覆盖。' };
      }
    }

    return { ok: true, reason: '' };
  }

  _getStorylineMissingSections(content = '') {
    const text = String(content || '').trim();
    const missingSections = [];
    const hasStageSection = /【第[一二三四五六七八九十0-9]+阶段/.test(text) || text.includes('【分阶段叙述】');
    if (!text.includes('【总览】')) missingSections.push('【总览】');
    if (!hasStageSection) missingSections.push('【分阶段叙述】');
    if (!text.includes('【人物关系变化】')) missingSections.push('【人物关系变化】');
    if (!text.includes('【重要伏笔】')) missingSections.push('【重要伏笔】');
    if (!text.includes('【节奏与高潮】')) missingSections.push('【节奏与高潮】');
    if (!text.includes('【主题演变】')) missingSections.push('【主题演变】');
    return missingSections;
  }

  // ==================== 分集规划表相关 ====================

  /**
   * 获取分集规划表
   */
  async getEpisodePlan(projectId) {
    const { ctx } = this;
    const project = await ctx.model.NovelProject.findOne({
      where: { id: projectId },
      attributes: ['episode_plan', 'total_episodes'],
      raw: true,
    });

    if (!project) return '未找到项目';

    let plan = project.episode_plan;
    if (typeof plan === 'string') {
      try { plan = JSON.parse(plan); } catch (_) { plan = null; }
    }

    if (!plan || !Array.isArray(plan) || plan.length === 0) {
      return '当前项目还没有分集规划表。请先调用规划师生成。';
    }

    const lines = plan.map(item => {
      const chs = item.chapters || [];
      const chStr = chs.length === 1
        ? `第${chs[0]}章`
        : `第${chs[0]}-${chs[chs.length - 1]}章`;
      return `第${item.episode}集：${chStr}（共${chs.length}章）—— ${item.summary || ''}`;
    });

    return `分集规划表（共${plan.length}集，目标${project.total_episodes || '未设置'}集）：\n${lines.join('\n')}`;
  }

  /**
   * 保存分集规划表
   * @param {number} projectId - 项目ID
   * @param {Array} plan - 规划数组 [{episode, chapters, summary}]
   */
  async saveEpisodePlan(projectId, plan) {
    const { ctx } = this;

    if (!Array.isArray(plan) || plan.length === 0) {
      return '未执行保存：规划表数据为空';
    }

    const project = await ctx.model.NovelProject.findOne({
      where: { id: projectId },
      attributes: ['id', 'total_episodes'],
      raw: true,
    });
    if (!project) return '未执行保存：未找到项目';

    const totalEpisodes = Number(project.total_episodes) || 0;

    /* 校验：总集数必须等于目标集数 */
    if (totalEpisodes > 0 && plan.length !== totalEpisodes) {
      return `未执行保存：规划表共${plan.length}集，但目标集数是${totalEpisodes}集，必须完全一致。`;
    }

    /* 校验：章节连续性和完整性 */
    const totalChapters = await ctx.model.NovelChapter.count({
      where: { novel_project_id: projectId },
    });

    const allChapters = new Set();
    let lastChapter = 0;
    for (let i = 0; i < plan.length; i++) {
      const item = plan[i];
      const chapters = item.chapters || [];
      if (!chapters.length) {
        return `未执行保存：第${item.episode || i + 1}集没有分配章节。`;
      }
      for (const ch of chapters) {
        if (ch <= lastChapter) {
          return `未执行保存：章节${ch}不连续或重复（上一个章节是${lastChapter}）。`;
        }
        allChapters.add(ch);
        lastChapter = ch;
      }
    }

    if (totalChapters > 0 && allChapters.size !== totalChapters) {
      return `未执行保存：规划表覆盖${allChapters.size}章，但项目共${totalChapters}章，必须全部覆盖。`;
    }

    /* 保存到数据库 */
    const planJson = JSON.stringify(plan);
    await ctx.model.NovelProject.update(
      { episode_plan: planJson },
      { where: { id: projectId } }
    );

    return `分集规划表保存成功：共${plan.length}集，覆盖${allChapters.size}章`;
  }

  /**
   * 根据规划表获取指定集数的章节分配
   * 供 _decorateTaskWithCoverage 内部调用
   * @returns {object|null} { chapters: [1,2,3], summary: '...' } 或 null
   */
  async getEpisodePlanForEpisode(projectId, episodeNumber) {
    const { ctx } = this;
    const project = await ctx.model.NovelProject.findOne({
      where: { id: projectId },
      attributes: ['episode_plan'],
      raw: true,
    });

    let plan = project?.episode_plan;
    if (typeof plan === 'string') {
      try { plan = JSON.parse(plan); } catch (_) { return null; }
    }
    if (!Array.isArray(plan)) return null;

    return plan.find(item => item.episode === episodeNumber) || null;
  }

  /**
   * 统一执行工具调用
   * @param {string} toolName - 工具名
   * @param {object} args - 参数
   * @param {number} projectId - 项目ID
   * @param {number} userId - 用户ID
   * @returns {Promise<string>} 工具执行结果文本
   */
  async executeTool(toolName, args, projectId, userId) {
    // 兼容处理：下划线版本和驼峰版本都支持
    const toolNameMap = {
      'get_chapter': 'getChapter',
      'get_storyline': 'getStoryline',
      'save_storyline': 'saveStoryline',
      'delete_storyline': 'deleteStoryline',
      'get_outline': 'getOutline',
      'save_outline': 'saveOutline',
      'update_outline': 'updateOutline',
      'delete_outline': 'deleteOutline',
    };

    const normalizedName = toolNameMap[toolName] || toolName;

    switch (normalizedName) {
      case 'getChapterList':
        return this.getChapterList(projectId);
      case 'getChapter':
        return this.getChapter(projectId, args.chapterNumbers || []);
      case 'getStoryline':
        return this.getStoryline(projectId);
      case 'getStorylineCoverage':
        return this.getStorylineCoverage(projectId);
      case 'saveStoryline':
        return this.saveStoryline(projectId, userId, args.content || '');
      case 'deleteStoryline':
        return this.deleteStoryline(projectId);
      case 'getOutline':
        return this.getOutline(projectId, args.episodeNumber);
      case 'getOutlineCoverage':
        return this.getOutlineCoverage(projectId);
      case 'saveOutline':
        return this.saveOutline(projectId, userId, args.episodes || [], args.overwrite, args.startEpisode);
      case 'updateOutline':
        return this.updateOutlineById(projectId, args.id, args.data);
      case 'insertEpisodeOutline':
        return this.insertEpisodeOutline(projectId, userId, args.episodeNumber, args.data);
      case 'deleteOutline':
        return this.deleteOutline(projectId, args.ids || []);
      case 'generateAssets':
        return this.generateAssets(projectId);
      case 'getEpisodePlan':
        return this.getEpisodePlan(projectId);
      case 'saveEpisodePlan':
        return this.saveEpisodePlan(projectId, args.plan || []);
      default:
        return `未知工具: ${toolName}`;
    }
  }
}

module.exports = NovelAgentToolsService;
