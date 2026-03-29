'use strict';

/**
 * 剧本分集模型
 * 每个剧本包含多集，每集有独立的标题和内容
 */
module.exports = app => {
  const { STRING, BIGINT, TINYINT, INTEGER, TEXT, DATE } = app.Sequelize;

  const ScriptEpisode = app.model.define('script_episode', {
    id: { type: BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, comment: '剧集ID' },
    script_id: { type: BIGINT.UNSIGNED, allowNull: false, comment: '剧本ID' },
    user_id: { type: BIGINT.UNSIGNED, allowNull: false, comment: '用户ID' },
    episode_number: { type: INTEGER, defaultValue: 1, comment: '集数编号' },
    title: { type: STRING(200), defaultValue: '', comment: '集标题' },
    content: { type: TEXT('long'), comment: '大纲内容' },
    script_content: { type: TEXT('long'), comment: '详细台本内容' },
    word_count: { type: INTEGER, defaultValue: 0, comment: '字数' },
    script_status: { type: TINYINT, defaultValue: 0, comment: '台本状态: 0未生成 1生成中 2已生成 3生成失败' },
    script_locked: { type: TINYINT, defaultValue: 0, comment: '台本锁定: 0未锁定 1已锁定' },
    is_locked: { type: TINYINT, defaultValue: 0, comment: '大纲锁定: 0未锁定 1已锁定' },
  }, {
    tableName: 'script_episode',
    underscored: true,
  });

  /* 关联关系 */
  ScriptEpisode.associate = function() {
    app.model.ScriptEpisode.belongsTo(app.model.Script, {
      foreignKey: 'script_id',
      as: 'script',
    });
  };

  return ScriptEpisode;
};
