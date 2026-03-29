'use strict';

module.exports = app => {
  const { STRING, BIGINT, INTEGER } = app.Sequelize;

  const VipPlan = app.model.define('vip_plan', {
    id: { type: BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, comment: '周期套餐ID' },
    plan_code: { type: STRING(50), allowNull: false, unique: true, comment: '周期代码' },
    name: { type: STRING(50), allowNull: false, comment: '周期名称' },
    badge: { type: STRING(50), defaultValue: '', comment: '角标' },
    sort_order: { type: INTEGER, defaultValue: 0, comment: '排序' },
  }, {
    tableName: 'vip_plan',
    underscored: true,
  });

  return VipPlan;
};
