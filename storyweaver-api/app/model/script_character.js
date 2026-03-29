'use strict';

/**
 * 剧本角色结构化模型
 * 存储从人物介绍文本中解析出的结构化角色数据
 */
module.exports = app => {
  const { STRING, BIGINT, TEXT, INTEGER, DATE } = app.Sequelize;

  const ScriptCharacter = app.model.define('script_character', {
    id: { type: BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, comment: '角色ID' },
    script_id: { type: BIGINT.UNSIGNED, allowNull: false, comment: '关联剧本ID' },
    role_type: { type: STRING(20), defaultValue: 'other', comment: '角色类型: protagonist/antagonist/ally/lover/rival/other' },
    name: { type: STRING(50), defaultValue: '', comment: '角色姓名' },
    gender: { type: STRING(10), defaultValue: '', comment: '性别' },
    age: { type: STRING(20), defaultValue: '', comment: '年龄' },
    personality: { type: TEXT, comment: '性格特点JSON: [{keyword, desc}]' },
    appearance: { type: TEXT, comment: '容貌描述JSON: [{keyword, desc}]' },
    relationship: { type: TEXT, comment: '与主角关系' },
    background: { type: TEXT, comment: '人物经历' },
    avatar: { type: STRING(500), defaultValue: '', comment: '角色头像图片路径' },
    avatar_prompt: { type: TEXT, comment: '角色图片AI描述词' },
    sort_order: { type: INTEGER, defaultValue: 0, comment: '排序序号' },
  }, {
    tableName: 'script_character',
    underscored: true,
  });

  /* 关联关系 */
  ScriptCharacter.associate = function() {
    app.model.ScriptCharacter.belongsTo(app.model.Script, {
      foreignKey: 'script_id',
      as: 'script',
    });
  };

  return ScriptCharacter;
};
