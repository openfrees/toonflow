'use strict';

/**
 * 充值订单模型
 * 记录当前可售的 VIP 会员充值交易
 */
module.exports = app => {
  const { STRING, BIGINT, TINYINT, DECIMAL, DATE, TEXT } = app.Sequelize;

  const RechargeOrder = app.model.define('recharge_order', {
    id: { type: BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, comment: '订单ID' },
    order_no: { type: STRING(64), allowNull: false, unique: true, comment: '商户订单号' },
    user_id: { type: BIGINT.UNSIGNED, allowNull: false, comment: '用户ID' },
    order_type: { type: STRING(20), allowNull: false, defaultValue: 'vip', comment: '订单类型: vip' },
    pay_method: { type: STRING(20), allowNull: false, defaultValue: 'alipay', comment: '支付方式: alipay/wechat' },
    amount: { type: DECIMAL(10, 2), allowNull: false, defaultValue: 0.00, comment: '支付金额(元)' },
    status: { type: TINYINT, allowNull: false, defaultValue: 0, comment: '状态: 0待支付 1已支付 2已过期 3已退款' },
    product_name: { type: STRING(255), defaultValue: '', comment: '商品名称' },
    product_detail: {
      type: TEXT,
      defaultValue: null,
      comment: '商品详情(JSON)（MySQL5.6 用 TEXT 存 JSON 字符串）',
      get() { const raw = this.getDataValue('product_detail'); if (raw == null || raw === '') return null; try { return JSON.parse(raw); } catch { return null; } },
      set(val) { this.setDataValue('product_detail', val == null ? null : (typeof val === 'string' ? val : JSON.stringify(val))); },
    },
    trade_no: { type: STRING(64), defaultValue: null, comment: '支付宝/微信交易号' },
    paid_at: { type: DATE, defaultValue: null, comment: '支付完成时间' },
    expired_at: { type: DATE, defaultValue: null, comment: '订单过期时间' },
    notify_data: { type: TEXT, defaultValue: null, comment: '回调原始数据' },
    remark: { type: STRING(255), defaultValue: '', comment: '备注' },
  }, {
    tableName: 'recharge_order',
    underscored: true,
  });

  return RechargeOrder;
};
