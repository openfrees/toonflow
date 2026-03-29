'use strict';

/**
 * 用户反馈模型
 * 支持未登录用户提交反馈
 */
module.exports = app => {
  const { STRING, BIGINT, TEXT, TINYINT, DATE } = app.Sequelize;

  const Feedback = app.model.define('feedback', {
    id: { type: BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, comment: '反馈ID' },
    user_id: { type: BIGINT.UNSIGNED, allowNull: true, comment: '用户ID（可选，未登录用户为NULL）' },
    type: { type: STRING(20), allowNull: false, comment: '反馈类型: suggestion/bug' },
    module: { type: STRING(50), allowNull: false, comment: '所属功能: write_script/novel_to_script/model_settings/other（兼容旧值 buy_vip/review_script）' },
    content: { type: TEXT, allowNull: false, comment: '反馈内容' },
    images: {
      type: TEXT,
      allowNull: true,
      comment: '截图URL数组，如["url1","url2"]（MySQL5.6 用 TEXT 存 JSON 字符串）',
      get() {
        const raw = this.getDataValue('images');
        if (raw == null || raw === '') return null;
        try { return JSON.parse(raw); } catch { return null; }
      },
      set(val) {
        this.setDataValue('images', val == null ? null : (typeof val === 'string' ? val : JSON.stringify(val)));
      },
    },
    contact: { type: STRING(100), allowNull: true, comment: '联系方式（邮箱或手机号）' },
    status: { type: TINYINT, defaultValue: 0, comment: '状态: 0待处理 1已处理 2已关闭' },
    admin_reply: { type: TEXT, allowNull: true, comment: '管理员回复' },
    ip: { type: STRING(50), allowNull: true, comment: '提交IP（用于防刷）' },
  }, {
    tableName: 'feedback',
    underscored: true,
  });

  return Feedback;
};
