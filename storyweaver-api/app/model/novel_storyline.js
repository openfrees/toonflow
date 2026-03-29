'use strict';

/**
 * 故事线模型
 * 每个小说项目有且仅有一条故事线（由AI故事师分析生成）
 */
module.exports = app => {
  const { BIGINT, TINYINT, TEXT, DATE } = app.Sequelize;

  const NovelStoryline = app.model.define('novel_storyline', {
    id: { type: BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    novel_project_id: { type: BIGINT.UNSIGNED, allowNull: false },
    user_id: { type: BIGINT.UNSIGNED, allowNull: false },
    content: { type: TEXT('long'), comment: '故事线完整内容(Markdown)' },
    is_locked: { type: TINYINT, defaultValue: 0 },
  }, {
    tableName: 'novel_storyline',
    underscored: true,
  });

  NovelStoryline.associate = function() {
    app.model.NovelStoryline.belongsTo(app.model.NovelProject, { foreignKey: 'novel_project_id', as: 'project' });
  };

  return NovelStoryline;
};
