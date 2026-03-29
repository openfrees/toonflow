'use strict';

module.exports = app => {
  const { STRING, BIGINT, INTEGER, TEXT } = app.Sequelize;

  const VipTier = app.model.define('vip_tier', {
    id: { type: BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, comment: '会员等级ID' },
    tier_code: { type: STRING(50), allowNull: false, unique: true, comment: '等级代码' },
    name: { type: STRING(50), allowNull: false, comment: '等级名称' },
    badge: { type: STRING(50), defaultValue: '', comment: '角标' },
    desc_text: { type: STRING(255), defaultValue: '', comment: '描述' },
    monthly_coins: { type: INTEGER, defaultValue: 0, comment: '每月获赠蛙币数量' },
    script_create_limit: { type: INTEGER, defaultValue: 0, comment: '最多可创建剧本数，0=不限' },
    novel_word_limit: { type: INTEGER, defaultValue: 0, comment: '小说导入总字数上限，0=不限' },
    features_html: { type: TEXT, comment: '权限富文本' },
    sort_order: { type: INTEGER, defaultValue: 0, comment: '排序' },
  }, {
    tableName: 'vip_tier',
    underscored: true,
  });

  return VipTier;
};
