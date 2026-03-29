'use strict';

/**
 * 兑换码模型
 * 管理后台生成兑换码，C端用户使用兑换码兑换积分
 */
module.exports = app => {
  const { BIGINT, INTEGER, STRING, TINYINT, DATE } = app.Sequelize;

  const RedeemCode = app.model.define('redeem_code', {
    id: { type: BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, comment: '兑换码ID' },
    code: { type: STRING(32), allowNull: false, unique: true, comment: '兑换码（大写字母+数字）' },
    points: { type: INTEGER, allowNull: false, comment: '兑换积分额度' },
    max_uses: { type: INTEGER, allowNull: false, defaultValue: 1, comment: '最大使用次数' },
    used_count: { type: INTEGER, allowNull: false, defaultValue: 0, comment: '已使用次数' },
    expire_at: { type: DATE, allowNull: false, comment: '过期时间' },
    status: { type: TINYINT, allowNull: false, defaultValue: 1, comment: '状态: 1启用 0禁用' },
    remark: { type: STRING(200), defaultValue: '', comment: '备注' },
    created_by: { type: BIGINT.UNSIGNED, allowNull: true, comment: '创建管理员ID' },
  }, {
    tableName: 'redeem_code',
    underscored: true,
  });

  return RedeemCode;
};
