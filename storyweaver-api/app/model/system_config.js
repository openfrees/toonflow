'use strict';

/**
 * 系统配置模型
 * 键值对形式存储系统级配置，支持功能开关、赠送额度等零碎配置
 */
module.exports = app => {
  const { STRING, INTEGER } = app.Sequelize;

  const SystemConfig = app.model.define('system_config', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true, comment: '自增ID' },
    func_key: { type: STRING(100), allowNull: false, unique: true, comment: '功能键名' },
    func_value: { type: STRING(500), allowNull: false, defaultValue: '', comment: '功能值' },
    func_desc: { type: STRING(255), allowNull: false, defaultValue: '', comment: '功能说明' },
  }, {
    tableName: 'system_config',
    underscored: true,
  });

  return SystemConfig;
};
