'use strict';

/**
 * 小说项目模型
 * 每个用户可创建多个小说项目，存储小说的基本信息和AI创作参数
 */
module.exports = app => {
  const { STRING, BIGINT, TINYINT, INTEGER, TEXT, DATE } = app.Sequelize;

  const NovelProject = app.model.define('novel_project', {
    id: { type: BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    user_id: { type: BIGINT.UNSIGNED, allowNull: false },
    title: { type: STRING(200), defaultValue: '' },
    cover: { type: STRING(500), defaultValue: '' },
    cover_prompt: { type: TEXT },
    total_episodes: { type: INTEGER, defaultValue: 80, comment: '目标总集数' },
    duration: { type: INTEGER, defaultValue: 2, comment: '单集时长(分钟)' },
    gender: { type: STRING(20), defaultValue: '男频' },
    genres: {
      type: TEXT,
      comment: '题材类型数组（MySQL5.6 用 TEXT 存 JSON 字符串）',
      get() {
        const raw = this.getDataValue('genres');
        if (raw == null || raw === '') return null;
        try { return JSON.parse(raw); } catch { return null; }
      },
      set(val) {
        this.setDataValue('genres', val == null ? null : (typeof val === 'string' ? val : JSON.stringify(val)));
      },
    },
    episode_plan: {
      type: TEXT,
      comment: '分集规划表（JSON数组，规划师生成）',
      get() {
        const raw = this.getDataValue('episode_plan');
        if (raw == null || raw === '') return null;
        try { return JSON.parse(raw); } catch { return null; }
      },
      set(val) {
        this.setDataValue('episode_plan', val == null ? null : (typeof val === 'string' ? val : JSON.stringify(val)));
      },
    },
    art_style: { type: STRING(50), defaultValue: '日系动漫', comment: '画风风格' },
    aspect_ratio: { type: STRING(10), defaultValue: '9:16', comment: '画面比例' },
    characters: { type: TEXT('long'), comment: 'AI生成的人物介绍' },
    characters_locked: { type: TINYINT, defaultValue: 0 },
    copyright_confirmed: { type: TINYINT, defaultValue: 0, comment: '是否完成版权确认' },
    copyright_confirm_text: { type: TEXT, comment: '版权确认文案' },
    copyright_confirm_version: { type: STRING(32), defaultValue: '', comment: '版权确认文案版本' },
    copyright_confirmed_ip: { type: STRING(64), defaultValue: '', comment: '版权确认时的客户端IP' },
    copyright_confirmed_at: { type: DATE, comment: '版权确认时间' },
    status: { type: TINYINT, defaultValue: 0, comment: '0-草稿 1-进行中 2-已完成' },
  }, {
    tableName: 'novel_project',
    underscored: true,
  });

  NovelProject.associate = function() {
    app.model.NovelProject.belongsTo(app.model.User, { foreignKey: 'user_id', as: 'user' });
    app.model.NovelProject.hasMany(app.model.NovelChapter, { foreignKey: 'novel_project_id', as: 'chapters' });
    app.model.NovelProject.hasOne(app.model.NovelStoryline, { foreignKey: 'novel_project_id', as: 'storyline' });
    app.model.NovelProject.hasMany(app.model.NovelEpisode, { foreignKey: 'novel_project_id', as: 'episodes' });
    app.model.NovelProject.hasMany(app.model.NovelChatHistory, { foreignKey: 'novel_project_id', as: 'chatHistory' });
  };

  return NovelProject;
};
