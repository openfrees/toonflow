'use strict';

/**
 * AI会话记录模型
 * 记录用户与AI的每一轮对话，支持上下文关联
 * 策略：用户消息立即入库，AI回复流式结束后入库
 */
module.exports = app => {
  const { STRING, BIGINT, TINYINT, INTEGER, TEXT, DATE } = app.Sequelize;

  const AiChatRecord = app.model.define('ai_chat_record', {
    id: { type: BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, comment: '记录ID' },
    user_id: { type: BIGINT.UNSIGNED, allowNull: false, comment: '用户ID' },
    script_id: { type: BIGINT.UNSIGNED, allowNull: false, comment: '关联剧本ID' },
    role: { type: STRING(20), defaultValue: 'user', comment: '角色: system/user/assistant' },
    content: { type: TEXT('long'), comment: '消息内容' },
    tokens_used: { type: INTEGER, defaultValue: 0, comment: 'Token消耗' },
    model: { type: STRING(50), defaultValue: '', comment: '使用的模型' },
    status: { type: TINYINT, defaultValue: 1, comment: '状态: 1正常 0失败 2生成中' },
  }, {
    tableName: 'ai_chat_record',
    underscored: true,
  });

  /* 关联关系 */
  AiChatRecord.associate = function() {
    app.model.AiChatRecord.belongsTo(app.model.Script, {
      foreignKey: 'script_id',
      as: 'script',
    });
    app.model.AiChatRecord.belongsTo(app.model.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
  };

  return AiChatRecord;
};
