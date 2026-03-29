'use strict';

/**
 * 管理员模型
 */
module.exports = app => {
  const { STRING, INTEGER, BIGINT, TINYINT, DATE } = app.Sequelize;

  const AdminUser = app.model.define('admin_user', {
    id: { type: BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, comment: '管理员ID' },
    username: { type: STRING(50), allowNull: false, comment: '用户名' },
    password: { type: STRING(255), allowNull: false, comment: '密码(bcrypt加密)' },
    nickname: { type: STRING(50), defaultValue: '', comment: '昵称' },
    avatar: { type: STRING(500), defaultValue: '', comment: '头像URL' },
    role: { type: STRING(20), defaultValue: 'admin', comment: '角色: super_admin/admin/editor' },
    status: { type: TINYINT, defaultValue: 1, comment: '状态: 1启用 0禁用' },
    last_login_at: { type: DATE, comment: '最后登录时间' },
  }, {
    tableName: 'admin_user',
    underscored: true,
  });

  return AdminUser;
};
