'use strict';

/**
 * 短剧模型
 */
module.exports = app => {
  const { STRING, INTEGER, BIGINT, TINYINT, TEXT, DECIMAL, DATE } = app.Sequelize;

  const Drama = app.model.define('drama', {
    id: { type: BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, comment: '短剧ID' },
    title: { type: STRING(200), allowNull: false, comment: '短剧标题' },
    cover: { type: STRING(500), defaultValue: '', comment: '封面图URL' },
    description: { type: TEXT, comment: '短剧简介' },
    category_id: { type: BIGINT.UNSIGNED, comment: '分类ID' },
    total_episodes: { type: INTEGER, defaultValue: 0, comment: '总集数' },
    word_count: { type: STRING(20), defaultValue: '', comment: '字数(如9.9万)' },
    price: { type: DECIMAL(12, 2), defaultValue: 0.00, comment: '价格' },
    score: { type: DECIMAL(4, 1), defaultValue: 0.0, comment: '评分(0-100)' },
    grade: { type: STRING(10), defaultValue: '', comment: '评级: S/A+/A/B+/B' },
    status: { type: TINYINT, defaultValue: 1, comment: '状态: 1上架 0下架 2草稿' },
    is_free: { type: TINYINT, defaultValue: 0, comment: '是否免费: 1是 0否' },
    is_recommend: { type: TINYINT, defaultValue: 0, comment: '是否推荐: 1是 0否' },
    is_sold_out: { type: TINYINT, defaultValue: 0, comment: '是否售罄: 1是 0否' },
    view_count: { type: INTEGER, defaultValue: 0, comment: '浏览量' },
    author: { type: STRING(100), defaultValue: '', comment: '作者' },
  }, {
    tableName: 'drama',
    underscored: true,
  });

  /* 关联关系 */
  Drama.associate = function() {
    /* 短剧有多个分集 */
    app.model.Drama.hasMany(app.model.DramaEpisode, {
      foreignKey: 'drama_id',
      as: 'episodes',
    });
  };

  return Drama;
};
