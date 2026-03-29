'use strict';

/**
 * 题材类型字典模型
 */
module.exports = app => {
  const { STRING, INTEGER, BIGINT, TINYINT } = app.Sequelize;

  const Genre = app.model.define('genre', {
    id: { type: BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, comment: '题材ID' },
    name: { type: STRING(20), allowNull: false, comment: '题材名称' },
    category: { type: STRING(20), allowNull: false, comment: '所属分类：时代背景、主题情节、角色设定' },
    sort_order: { type: INTEGER, defaultValue: 0, comment: '排序权重（越大越靠前）' },
    is_enabled: { type: TINYINT, defaultValue: 1, comment: '是否启用：1启用 0禁用' },
  }, {
    tableName: 'genre',
    underscored: true,
  });

  return Genre;
};
