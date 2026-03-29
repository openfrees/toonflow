'use strict';

/**
 * 剧集分镜模型
 * 存储每集台本对应的AI分镜头提示词数据
 */
module.exports = app => {
  const { STRING, BIGINT, TINYINT, INTEGER, TEXT } = app.Sequelize;

  const EpisodeStoryboard = app.model.define('episode_storyboard', {
    id: { type: BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, comment: '分镜ID' },
    script_id: { type: BIGINT.UNSIGNED, allowNull: false, comment: '剧本ID' },
    episode_id: { type: BIGINT.UNSIGNED, allowNull: false, comment: '剧集ID' },
    user_id: { type: BIGINT.UNSIGNED, allowNull: false, comment: '用户ID' },
    storyboard_data: { type: TEXT('long'), comment: '分镜JSON数据（完整的scenes+shots结构）' },
    style: { type: STRING(50), defaultValue: '日系动漫', comment: '画风风格' },
    aspect_ratio: { type: STRING(10), defaultValue: '16:9', comment: '画面比例' },
    status: { type: TINYINT, defaultValue: 0, comment: '状态: 0未生成 1生成中 2已生成 3生成失败' },
    total_shots: { type: INTEGER, defaultValue: 0, comment: '总镜头数' },
    video_storyboard_data: { type: TEXT('long'), comment: '视频分镜JSON数据' },
    video_status: { type: TINYINT, defaultValue: 0, comment: '视频分镜状态: 0未生成 1生成中 2已生成 3生成失败' },
    video_total_shots: { type: INTEGER, defaultValue: 0, comment: '视频分镜总镜头数' },
  }, {
    tableName: 'episode_storyboard',
    underscored: true,
  });

  /* 关联关系 */
  EpisodeStoryboard.associate = function() {
    app.model.EpisodeStoryboard.belongsTo(app.model.ScriptEpisode, {
      foreignKey: 'episode_id',
      as: 'episode',
    });
    app.model.EpisodeStoryboard.belongsTo(app.model.Script, {
      foreignKey: 'script_id',
      as: 'script',
    });
  };

  return EpisodeStoryboard;
};
