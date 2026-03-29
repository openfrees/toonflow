'use strict';

/**
 * 剧本-题材关联模型
 */
module.exports = app => {
  const { BIGINT } = app.Sequelize;

  const ScriptGenre = app.model.define('script_genre', {
    script_id: { type: BIGINT.UNSIGNED, allowNull: false, primaryKey: true, comment: '剧本ID' },
    genre_id: { type: BIGINT.UNSIGNED, allowNull: false, primaryKey: true, comment: '题材ID' },
  }, {
    tableName: 'script_genre',
    underscored: true,
    timestamps: false,
  });

  return ScriptGenre;
};
