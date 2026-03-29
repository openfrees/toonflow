'use strict';

/**
 * Agent 对话历史模型
 * 记录用户与小说AI Agent的完整对话，用于重建上下文
 */
module.exports = app => {
  const { STRING, BIGINT, INTEGER, TEXT, DATE } = app.Sequelize;

  const NovelChatHistory = app.model.define('novel_chat_history', {
    id: { type: BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    novel_project_id: { type: BIGINT.UNSIGNED, allowNull: false },
    user_id: { type: BIGINT.UNSIGNED, allowNull: false },
    role: { type: STRING(20), allowNull: false, comment: 'user/assistant/tool' },
    agent_type: { type: STRING(20), defaultValue: 'main', comment: 'main/AI1/AI2/director' },
    content: { type: TEXT('long') },
    tool_calls: {
      type: TEXT,
      comment: '工具调用记录（MySQL5.6 用 TEXT 存 JSON 字符串）',
      get() { const raw = this.getDataValue('tool_calls'); if (raw == null || raw === '') return null; try { return JSON.parse(raw); } catch { return null; } },
      set(val) { this.setDataValue('tool_calls', val == null ? null : (typeof val === 'string' ? val : JSON.stringify(val))); },
    },
    tokens_used: { type: INTEGER, defaultValue: 0 },
  }, {
    tableName: 'novel_chat_history',
    underscored: true,
    updatedAt: false,
  });

  NovelChatHistory.associate = function() {
    app.model.NovelChatHistory.belongsTo(app.model.NovelProject, { foreignKey: 'novel_project_id', as: 'project' });
  };

  return NovelChatHistory;
};
