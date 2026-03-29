'use strict';

/**
 * 小说章节模型
 * 存储用户上传的小说各章节原文内容
 */
module.exports = app => {
  const { STRING, BIGINT, TINYINT, INTEGER, TEXT, DATE } = app.Sequelize;

  const NovelChapter = app.model.define('novel_chapter', {
    id: { type: BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    novel_project_id: { type: BIGINT.UNSIGNED, allowNull: false },
    user_id: { type: BIGINT.UNSIGNED, allowNull: false },
    chapter_index: { type: INTEGER, allowNull: false, comment: '章节序号(1开始)' },
    chapter_title: { type: STRING(200), defaultValue: '' },
    chapter_content: { type: TEXT('long') },
    word_count: { type: INTEGER, defaultValue: 0 },
    is_selected: { type: TINYINT, defaultValue: 0, comment: '是否已被大纲覆盖（0=未覆盖 1=已覆盖）' },
  }, {
    tableName: 'novel_chapter',
    underscored: true,
  });

  NovelChapter.associate = function() {
    app.model.NovelChapter.belongsTo(app.model.NovelProject, { foreignKey: 'novel_project_id', as: 'project' });
  };

  return NovelChapter;
};
