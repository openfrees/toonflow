'use strict';

/**
 * C端用户模型
 * 支持三种登录方式：账号密码、手机验证码、微信扫码
 */
module.exports = app => {
  const { STRING, BIGINT, TINYINT, DATE } = app.Sequelize;

  const User = app.model.define('user', {
    id: { type: BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, comment: '用户ID' },
    user_no: { type: STRING(20), allowNull: true, unique: true, comment: '用户编号（混淆后的展示ID）' },
    phone: { type: STRING(20), allowNull: true, unique: true, comment: '手机号' },
    password: { type: STRING(255), allowNull: true, comment: '密码(bcrypt加密)' },
    nickname: { type: STRING(50), defaultValue: '', comment: '昵称' },
    avatar: { type: STRING(500), defaultValue: '', comment: '头像URL' },
    wechat_openid: { type: STRING(100), allowNull: true, unique: true, comment: '微信OpenID' },
    wechat_unionid: { type: STRING(100), allowNull: true, unique: true, comment: '微信UnionID' },
    login_type: { type: STRING(20), defaultValue: 'password', comment: '注册方式: password/phone/wechat' },
    status: { type: TINYINT, defaultValue: 1, comment: '状态: 1正常 0禁用' },
    points: { type: app.Sequelize.INTEGER, defaultValue: 0, comment: '积分余额' },
    vip_tier_id: { type: BIGINT.UNSIGNED, allowNull: true, comment: '当前VIP等级ID' },
    vip_expires_at: { type: DATE, allowNull: true, comment: 'VIP到期时间' },
    last_login_at: { type: DATE, comment: '最后登录时间' },
  }, {
    tableName: 'user',
    underscored: true,
  });

  return User;
};
