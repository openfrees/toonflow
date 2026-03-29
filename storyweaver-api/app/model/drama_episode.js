'use strict';

/**
 * 短剧分集模型
 */
module.exports = app => {
  const { STRING, INTEGER, BIGINT, TINYINT, TEXT, DATE } = app.Sequelize;

  const DramaEpisode = app.model.define('drama_episode', {
    id: { type: BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, comment: '分集ID' },
    drama_id: { type: BIGINT.UNSIGNED, allowNull: false, comment: '短剧ID' },
    episode_number: { type: INTEGER, allowNull: false, comment: '集数编号' },
    title: { type: STRING(200), defaultValue: '', comment: '分集标题' },
    content: { type: TEXT('long'), comment: '分集内容/剧本' },
    word_count: { type: INTEGER, defaultValue: 0, comment: '字数' },
    status: { type: TINYINT, defaultValue: 1, comment: '状态: 1已发布 0草稿' },
    sort: { type: INTEGER, defaultValue: 0, comment: '排序' },
  }, {
    tableName: 'drama_episode',
    underscored: true,
  });

  /* 关联关系 */
  DramaEpisode.associate = function() {
    app.model.DramaEpisode.belongsTo(app.model.Drama, {
      foreignKey: 'drama_id',
      as: 'drama',
    });
  };

  return DramaEpisode;
};
