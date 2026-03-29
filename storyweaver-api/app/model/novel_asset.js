'use strict';

/**
 * 小说项目资产模型（角色、道具、场景）
 * 对标 Toonflow t_assets 表
 */
module.exports = app => {
  const { STRING, BIGINT, TEXT, DATE } = app.Sequelize;

  const NovelAsset = app.model.define('novel_asset', {
    id: { type: BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    novel_project_id: { type: BIGINT.UNSIGNED, allowNull: false },
    type: { type: STRING(20), allowNull: false, comment: '资产类型: 角色/道具/场景' },
    name: { type: STRING(100), allowNull: false, comment: '资产名称' },
    intro: { type: TEXT, comment: '资产描述（对标 Toonflow intro）' },
    prompt: { type: TEXT, comment: '生成提示词（对标 Toonflow prompt）' },
    source: { type: STRING(20), allowNull: false, defaultValue: 'manual', comment: '来源: ai=AI同步创建, manual=手动创建' },
  }, {
    tableName: 'novel_asset',
    underscored: true,
    indexes: [
      { fields: ['novel_project_id', 'type', 'name'], unique: true },
    ],
  });

  NovelAsset.associate = function() {
    app.model.NovelAsset.belongsTo(app.model.NovelProject, { foreignKey: 'novel_project_id', as: 'project' });
  };

  return NovelAsset;
};
