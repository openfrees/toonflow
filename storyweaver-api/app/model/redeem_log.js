'use strict';

/**
 * 兑换记录模型
 * 记录每一次兑换码使用的详细信息
 */
module.exports = app => {
  const { BIGINT, INTEGER, STRING, DATE } = app.Sequelize;

  const RedeemLog = app.model.define('redeem_log', {
    id: { type: BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, comment: '兑换记录ID' },
    redeem_code_id: { type: BIGINT.UNSIGNED, allowNull: false, comment: '兑换码ID' },
    user_id: { type: BIGINT.UNSIGNED, allowNull: false, comment: '用户ID' },
    code: { type: STRING(32), allowNull: false, comment: '兑换码（冗余存储）' },
    points: { type: INTEGER, allowNull: false, comment: '兑换获得积分' },
  }, {
    tableName: 'redeem_log',
    underscored: true,
  });

  return RedeemLog;
};
