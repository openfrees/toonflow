'use strict';

/**
 * 用户场景模型绑定表
 * 记录每个场景使用哪个用户模型
 */
module.exports = app => {
  const { BIGINT, STRING } = app.Sequelize;

  const UserModelScene = app.model.define('user_model_scene', {
    id: { type: BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    user_id: { type: BIGINT.UNSIGNED, allowNull: false, comment: '用户ID' },
    scene_code: { type: STRING(50), allowNull: false, comment: '场景编码：script_gen/image_gen' },
    model_id: { type: BIGINT.UNSIGNED, allowNull: false, comment: '绑定的模型ID' },
  }, {
    tableName: 'user_model_scene',
    underscored: true,
  });

  return UserModelScene;
};
