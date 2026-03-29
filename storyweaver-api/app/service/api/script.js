'use strict';

const { Service } = require('egg');

/**
 * 剧本服务
 * 处理剧本的创建、查询、更新等业务逻辑
 */
class ScriptService extends Service {

  /**
   * 创建剧本
   * @param {object} data - 剧本数据
   * @param {number} userId - 用户ID
   * @returns {Promise<{id: string}>}
   */
  async create(data, userId) {
    const { ctx } = this;
    await ctx.service.api.membership.ensureCreationAllowed(userId);

    /* 创建剧本，所有参数独立存储 */
    const script = await ctx.model.Script.create({
      user_id: userId,
      title: data.title || '',
      total_episodes: data.totalEpisodes || 80,
      duration: data.duration || 2.0,
      gender: data.gender || '男频',
      aspect_ratio: data.aspectRatio || '9:16',
      style: data.artStyle || '日系动漫',
      max_roles: data.maxRoles || 10,
      max_scenes: data.maxScenes || 3,
      max_words: data.maxWords || 1200,
      dialogue_ratio: data.dialogueRatio || 50,
      custom_genres: data.customGenres || '',
      user_idea: data.userIdea || '',
      status: 0,
    });

    /* 写入题材关联表 */
    const genreIds = data.genreIds || [];
    if (genreIds.length > 0) {
      const relations = genreIds.map(gid => ({
        script_id: script.id,
        genre_id: Number(gid),
      }));
      await ctx.model.ScriptGenre.bulkCreate(relations);
    }

    return { id: ctx.helper.encodeId(script.id) };
  }

  /**
   * 查询剧本详情
   * @param {string|number} id - 剧本ID
   * @param {number} userId - 用户ID（鉴权用）
   * @returns {Promise<object>}
   */
  async detail(id, userId) {
    const { ctx } = this;

    const script = await ctx.model.Script.findOne({
      where: { id, user_id: userId },
      raw: true,
    });

    if (!script) {
      ctx.throw(404, '剧本不存在');
    }

    /* 查询关联的分集大纲，按集数排序 */
    const episodes = await ctx.model.ScriptEpisode.findAll({
      where: { script_id: id, user_id: userId },
      order: [['episode_number', 'ASC']],
      raw: true,
    });

    /* 查询关联的系统题材名称 */
    const genreRelations = await ctx.model.ScriptGenre.findAll({
      where: { script_id: id },
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

    /* 拼接自定义题材（"/"分隔的字符串） */
    const customGenres = script.custom_genres
      ? script.custom_genres.split('/').filter(Boolean)
      : [];

    return {
      ...script,
      id: ctx.helper.encodeId(script.id),
      user_id: String(script.user_id),
      /* 题材名称列表（系统 + 自定义） */
      genre_names: [ ...genreNames, ...customGenres ],
      /* 锁定状态 */
      title_locked: script.title_locked || 0,
      basic_info_locked: script.basic_info_locked || 0,
      synopsis_locked: script.synopsis_locked || 0,
      characters_locked: script.characters_locked || 0,
      emotion_points_locked: script.emotion_points_locked || 0,
      plot_lines_locked: script.plot_lines_locked || 0,
      episodes: episodes.map(ep => ({
        id: ctx.helper.encodeId(ep.id),
        episodeNumber: ep.episode_number,
        title: ep.title || '',
        content: ep.content || '',
        scriptContent: ep.script_content || '',
        scriptStatus: ep.script_status || 0,
        scriptLocked: ep.script_locked || 0,
        isLocked: ep.is_locked || 0,
      })),
    };
  }

  /**
   * 查询用户的剧本列表（优化版：统计已创建剧集数）
   * @param {number} userId - 用户ID
   * @param {object} query - 分页参数
   * @returns {Promise<{rows: Array, count: number}>}
   */
  async list(userId, query = {}) {
    const { ctx } = this;
    const { page = 1, pageSize = 20 } = query;

    /* 查询总数 */
    const count = await ctx.model.Script.count({
      where: { user_id: userId },
    });

    /* 使用原生SQL查询，关联统计已创建剧集数 */
    const offset = (Number(page) - 1) * Number(pageSize);
    const limit = Number(pageSize);

    const listSql = `
      SELECT
        s.*,
        CAST(s.id AS CHAR) as id_str,
        COUNT(se.id) as created_episodes
      FROM script s
      LEFT JOIN script_episode se ON s.id = se.script_id
      WHERE s.user_id = :userId
      GROUP BY s.id
      ORDER BY s.created_at DESC
      LIMIT :limit OFFSET :offset
    `;

    const rows = await ctx.model.query(listSql, {
      replacements: { userId, limit, offset },
      type: ctx.model.QueryTypes.SELECT,
    });

    /* 为每个剧本关联查询题材信息 + 格式化数据 */
    const formattedRows = await Promise.all(rows.map(async item => {
      /* 查询关联的系统题材名称 */
      const genreRelations = await ctx.model.ScriptGenre.findAll({
        where: { script_id: item.id },
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

      /* 拼接自定义题材（"/"分隔的字符串） */
      const customGenres = item.custom_genres
        ? item.custom_genres.split('/').filter(Boolean)
        : [];

      return {
        ...item,
        id: ctx.helper.encodeId(item.id),
        user_id: String(item.user_id),
        /* 题材名称列表（系统 + 自定义） */
        genre_names: [ ...genreNames, ...customGenres ],
        /* 已创建剧集数（驼峰格式） */
        created_episodes: Number(item.created_episodes) || 0,
        /* 时间字段转驼峰 */
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      };
    }));

    return {
      rows: formattedRows,
      count,
    };
  }

  /**
   * 更新剧本内容
   * @param {string|number} id - 剧本ID
   * @param {number} userId - 用户ID
   * @param {object} data - 更新数据
   */
  async update(id, userId, data) {
    const { ctx } = this;

    const script = await ctx.model.Script.findOne({
      where: { id, user_id: userId },
      raw: true,
    });

    if (!script) {
      ctx.throw(404, '剧本不存在');
    }

    const allowedFields = [
      'title', 'cover', 'cover_prompt', 'basic_info', 'characters',
      'emotion_points', 'plot_lines', 'synopsis',
      'total_episodes', 'duration', 'gender',
      'max_roles', 'max_scenes', 'max_words', 'dialogue_ratio',
      'custom_genres', 'style', 'aspect_ratio', 'params', 'status', 'user_idea',
      'title_locked', 'basic_info_locked', 'synopsis_locked',
      'characters_locked', 'emotion_points_locked', 'plot_lines_locked',
    ];

    const updateData = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    await ctx.model.Script.update(updateData, {
      where: { id, user_id: userId },
    });
  }

  /**
   * 核心参数重写：清空剧本内容，重新开始
   * @param {number} id - 剧本ID
   * @param {number} userId - 用户ID
   * @param {object} data - 新参数
   */
  async rewrite(id, userId, data) {
    const { ctx } = this;

    const script = await ctx.model.Script.findOne({
      where: { id, user_id: userId },
      raw: true,
    });
    if (!script) {
      ctx.throw(404, '剧本不存在');
    }

    const rawParams = script.params && typeof script.params === 'object'
      ? script.params
      : (() => {
          try {
            return JSON.parse(script.params || '{}');
          } catch (_) {
            return {};
          }
        })();
    const nextParams = { ...rawParams };
    delete nextParams.extractedScenes;

    /* 1. 更新参数 + 清空所有内容字段 + 解锁所有字段 */
    await ctx.model.Script.update({
      total_episodes: data.totalEpisodes || 80,
      duration: data.duration || 2.0,
      gender: data.gender || '男频',
      aspect_ratio: data.aspectRatio || '9:16',
      style: data.artStyle || '日系动漫',
      max_roles: data.maxRoles || 10,
      max_scenes: data.maxScenes || 3,
      max_words: data.maxWords || 1200,
      dialogue_ratio: data.dialogueRatio || 50,
      custom_genres: data.customGenres || '',
      user_idea: data.userIdea || '',
      /* 清空内容 */
      title: '',
      cover: '',
      cover_prompt: '',
      basic_info: '',
      synopsis: '',
      characters: '',
      emotion_points: '',
      plot_lines: '',
      /* 解锁所有字段 */
      title_locked: 0,
      basic_info_locked: 0,
      synopsis_locked: 0,
      characters_locked: 0,
      emotion_points_locked: 0,
      plot_lines_locked: 0,
      params: nextParams,
      status: 0,
    }, { where: { id, user_id: userId } });

    /* 2. 删除所有剧集 */
    await ctx.model.ScriptEpisode.destroy({ where: { script_id: id } });

    /* 3. 删除所有聊天记录 */
    await ctx.model.AiChatRecord.destroy({ where: { script_id: id } });

    /* 4. 删除所有结构化角色 */
    await ctx.model.ScriptCharacter.destroy({ where: { script_id: id } });

    /* 5. 更新题材关联 */
    await ctx.model.ScriptGenre.destroy({ where: { script_id: id } });
    const genreIds = data.genreIds || [];
    if (genreIds.length > 0) {
      const relations = genreIds.map(gid => ({
        script_id: id,
        genre_id: Number(gid),
      }));
      await ctx.model.ScriptGenre.bulkCreate(relations);
    }
  }

  /**
   * 删除剧本（级联删除关联的分集和聊天记录）
   * @param {string|number} id - 剧本ID
   * @param {number} userId - 用户ID（鉴权用）
   */
  async destroy(id, userId) {
    const { ctx } = this;

    const script = await ctx.model.Script.findOne({
      where: { id, user_id: userId },
      raw: true,
    });

    if (!script) {
      ctx.throw(404, '剧本不存在');
    }

    /* 级联删除：题材关联 → 分集 → 聊天记录 → 结构化角色 → 剧本 */
    await ctx.model.ScriptGenre.destroy({ where: { script_id: id } });
    await ctx.model.ScriptEpisode.destroy({ where: { script_id: id } });
    await ctx.model.AiChatRecord.destroy({ where: { script_id: id } });
    await ctx.model.ScriptCharacter.destroy({ where: { script_id: id } });
    await ctx.model.Script.destroy({ where: { id, user_id: userId } });
  }
}

module.exports = ScriptService;
