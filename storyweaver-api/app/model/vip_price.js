'use strict';

module.exports = app => {
  const { BIGINT, DECIMAL } = app.Sequelize;

  const VipPrice = app.model.define('vip_price', {
    id: { type: BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, comment: '定价ID' },
    vip_tier_id: { type: BIGINT.UNSIGNED, allowNull: false, comment: '关联等级ID' },
    vip_plan_id: { type: BIGINT.UNSIGNED, allowNull: false, comment: '关联套餐ID' },
    current_price: { type: DECIMAL(10, 2), defaultValue: 0.00, comment: '现价' },
    original_price: { type: DECIMAL(10, 2), defaultValue: 0.00, comment: '原价' },
    month_price: { type: DECIMAL(10, 2), defaultValue: 0.00, comment: '折合单月价格' },
  }, {
    tableName: 'vip_price',
    underscored: true,
  });

  /* 关联关系 */
  VipPrice.associate = function() {
    app.model.VipPrice.belongsTo(app.model.VipTier, { foreignKey: 'vip_tier_id', as: 'tier' });
    app.model.VipPrice.belongsTo(app.model.VipPlan, { foreignKey: 'vip_plan_id', as: 'plan' });
  };

  return VipPrice;
};
