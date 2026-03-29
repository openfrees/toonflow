'use strict';

/**
 * 用户剧本模型
 * 每个用户可创建多个剧本，存储剧本的基本信息和创作参数
 */
module.exports = app => {
  const { STRING, BIGINT, TINYINT, INTEGER, TEXT, DATE, DECIMAL } = app.Sequelize;

  const Script = app.model.define('script', {
    id: { type: BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, comment: '剧本ID' },
    user_id: { type: BIGINT.UNSIGNED, allowNull: false, comment: '用户ID' },
    title: { type: STRING(200), defaultValue: '', comment: '剧本标题' },
    title_locked: { type: TINYINT, defaultValue: 0, comment: '标题锁定: 0未锁定 1已锁定' },
    cover: { type: STRING(500), defaultValue: '', comment: '封面图URL' },
    cover_prompt: { type: TEXT, comment: '封面图AI描述词' },
    basic_info: { type: TEXT, comment: '基本信息' },
    basic_info_locked: { type: TINYINT, defaultValue: 0, comment: '基本信息锁定: 0未锁定 1已锁定' },
    characters: { type: TEXT, comment: '人物介绍' },
    characters_locked: { type: TINYINT, defaultValue: 0, comment: '人物介绍锁定: 0未锁定 1已锁定' },
    emotion_points: { type: TEXT, comment: '信息流情绪点' },
    emotion_points_locked: { type: TINYINT, defaultValue: 0, comment: '信息流情绪点锁定: 0未锁定 1已锁定' },
    plot_lines: { type: TEXT, comment: '剧情线' },
    plot_lines_locked: { type: TINYINT, defaultValue: 0, comment: '剧情线锁定: 0未锁定 1已锁定' },
    synopsis: { type: TEXT, comment: '剧情梗概' },
    synopsis_locked: { type: TINYINT, defaultValue: 0, comment: '剧情梗概锁定: 0未锁定 1已锁定' },
    total_episodes: { type: INTEGER, defaultValue: 80, comment: '总集数' },
    duration: { type: DECIMAL(3, 1), defaultValue: 2.0, comment: '每集时长（分钟）' },
    gender: { type: STRING(10), defaultValue: '男频', comment: '受众性别：男频/女频/通用' },
    max_roles: { type: INTEGER, defaultValue: 10, comment: '主要角色上限' },
    max_scenes: { type: INTEGER, defaultValue: 3, comment: '每集场景上限' },
    max_words: { type: INTEGER, defaultValue: 1200, comment: '每集字数上限' },
    dialogue_ratio: { type: INTEGER, defaultValue: 50, comment: '台词字数占比（%）' },
    custom_genres: { type: STRING(200), defaultValue: '', comment: '用户自定义题材（/分隔）' },
    style: { type: STRING(50), defaultValue: '日系动漫', comment: '画风风格（全局设置）' },
    aspect_ratio: { type: STRING(10), defaultValue: '16:9', comment: '画面比例（全局设置）' },
    params: {
      type: TEXT,
      comment: '创作参数JSON（保留兼容）（MySQL5.6 用 TEXT 存 JSON 字符串）',
      get() { const raw = this.getDataValue('params'); if (raw == null || raw === '') return null; try { return JSON.parse(raw); } catch { return null; } },
      set(val) { this.setDataValue('params', val == null ? null : (typeof val === 'string' ? val : JSON.stringify(val))); },
    },
    user_idea: { type: TEXT, comment: '用户原始创意输入' },
    status: { type: TINYINT, defaultValue: 0, comment: '状态: 0草稿 1已完成 2生成中' },
  }, {
    tableName: 'script',
    underscored: true,
  });

  /* 关联关系 */
  Script.associate = function() {
    /* 剧本属于一个用户 */
    app.model.Script.belongsTo(app.model.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
    /* 剧本有多个分集 */
    app.model.Script.hasMany(app.model.ScriptEpisode, {
      foreignKey: 'script_id',
      as: 'episodes',
    });
    /* 剧本有多条AI会话记录 */
    app.model.Script.hasMany(app.model.AiChatRecord, {
      foreignKey: 'script_id',
      as: 'chatRecords',
    });
    /* 剧本有多个结构化角色 */
    app.model.Script.hasMany(app.model.ScriptCharacter, {
      foreignKey: 'script_id',
      as: 'characters_structured',
    });
  };

  return Script;
};
