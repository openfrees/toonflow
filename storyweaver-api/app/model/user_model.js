'use strict';

/**
 * 用户模型配置表
 * 存储用户自定义的AI模型（文字/图片）
 */
module.exports = app => {
  const { STRING, BIGINT, TINYINT, INTEGER, DECIMAL, TEXT } = app.Sequelize;

  const UserModel = app.model.define('user_model', {
    id: { type: BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    user_id: { type: BIGINT.UNSIGNED, allowNull: false, comment: '用户ID' },
    type: { type: STRING(10), allowNull: false, defaultValue: 'text', comment: '模型类型：text/image' },
    name: { type: STRING(100), allowNull: false, comment: '显示名称' },
    provider: { type: STRING(50), allowNull: false, defaultValue: 'custom', comment: '提供商标识' },
    api_key: { type: STRING(1024), allowNull: false, comment: 'API密钥（AES加密）' },
    base_url: { type: STRING(255), allowNull: false, comment: 'API基础地址' },
    model_id: { type: STRING(100), allowNull: false, comment: '模型标识' },
    max_tokens: { type: INTEGER.UNSIGNED, allowNull: false, defaultValue: 4096, comment: '最大Token数' },
    temperature: { type: DECIMAL(3, 2), allowNull: false, defaultValue: 0.80, comment: '温度参数' },
    extra_params: { type: TEXT, allowNull: true, comment: '额外参数JSON' },
    is_active: { type: TINYINT(1), allowNull: false, defaultValue: 1, comment: '是否启用' },
    sort_order: { type: INTEGER, allowNull: false, defaultValue: 0, comment: '排序权重' },
  }, {
    tableName: 'user_model',
    underscored: true,
  });

  return UserModel;
};
