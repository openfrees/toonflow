'use strict';

/**
 * 小说分集模型
 * 存储AI生成的分集大纲和后续扩写的剧本台本
 */
module.exports = app => {
  const { STRING, BIGINT, TINYINT, INTEGER, TEXT, DATE } = app.Sequelize;

  const NovelEpisode = app.model.define('novel_episode', {
    id: { type: BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    novel_project_id: { type: BIGINT.UNSIGNED, allowNull: false },
    user_id: { type: BIGINT.UNSIGNED, allowNull: false },
    episode_number: { type: INTEGER, allowNull: false, comment: '集数(1开始)' },
    title: { type: STRING(200), defaultValue: '' },
    chapter_range: {
      type: TEXT,
      comment: '对应原著章节范围（MySQL5.6 用 TEXT 存 JSON 字符串）',
      get() { const raw = this.getDataValue('chapter_range'); if (raw == null || raw === '') return null; try { return JSON.parse(raw); } catch { return null; } },
      set(val) { this.setDataValue('chapter_range', val == null ? null : (typeof val === 'string' ? val : JSON.stringify(val))); },
    },
    outline: { type: TEXT('long'), comment: '大纲内容' },
    outline_detail: {
      type: TEXT,
      comment: '结构化字段(scenes/props/hooks等)（MySQL5.6 用 TEXT 存 JSON 字符串）',
      get() { const raw = this.getDataValue('outline_detail'); if (raw == null || raw === '') return null; try { return JSON.parse(raw); } catch { return null; } },
      set(val) { this.setDataValue('outline_detail', val == null ? null : (typeof val === 'string' ? val : JSON.stringify(val))); },
    },
    data: {
      type: TEXT('long'),
      comment: '完整大纲数据(EpisodeData JSON，对齐Toonflow，备份用)（MySQL5.6 用 TEXT 存 JSON 字符串）',
      get() { const raw = this.getDataValue('data'); if (raw == null || raw === '') return null; try { return JSON.parse(raw); } catch { return null; } },
      set(val) { this.setDataValue('data', val == null ? null : (typeof val === 'string' ? val : JSON.stringify(val))); },
    },
    outline_locked: { type: TINYINT, defaultValue: 0 },
    script_content: { type: TEXT('long'), comment: '剧本台本' },
    script_status: { type: TINYINT, defaultValue: 0, comment: '0-未生成 1-生成中 2-已完成 3-失败' },
    script_locked: { type: TINYINT, defaultValue: 0 },
  }, {
    tableName: 'novel_episode',
    underscored: true,
  });

  NovelEpisode.associate = function() {
    app.model.NovelEpisode.belongsTo(app.model.NovelProject, { foreignKey: 'novel_project_id', as: 'project' });
  };

  return NovelEpisode;
};
