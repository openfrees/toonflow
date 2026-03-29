'use strict';

const { Service } = require('egg');

/**
 * 剧本角色服务
 * 处理角色的CRUD、文本解析、图片生成等业务逻辑
 */
class ScriptCharacterService extends Service {

  /**
   * 获取剧本的所有结构化角色
   * @param {number} scriptId - 剧本真实ID
   * @param {number} userId - 用户ID（鉴权）
   * @returns {Promise<Array>}
   */
  async list(scriptId, userId) {
    const { ctx } = this;

    /* 验证剧本归属 */
    await this._verifyScript(scriptId, userId);

    const characters = await ctx.model.ScriptCharacter.findAll({
      where: { script_id: scriptId },
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
      raw: true,
    });

    return characters.map(c => this._formatCharacter(c));
  }

  /**
   * 批量保存角色（全量替换：先删后插）
   * @param {number} scriptId - 剧本真实ID
   * @param {number} userId - 用户ID
   * @param {Array} characters - 角色数组
   */
  async batchSave(scriptId, userId, characters) {
    const { ctx } = this;

    await this._verifyScript(scriptId, userId);

    /* 事务：先删除旧数据，再批量插入 */
    const transaction = await ctx.model.transaction();
    try {
      await ctx.model.ScriptCharacter.destroy({
        where: { script_id: scriptId },
        transaction,
      });

      if (characters && characters.length > 0) {
        const records = characters.map((c, index) => ({
          script_id: scriptId,
          role_type: c.roleType || 'other',
          name: c.name || '',
          gender: c.gender || '',
          age: c.age || '',
          personality: JSON.stringify(c.personality || []),
          appearance: JSON.stringify(c.appearance || []),
          relationship: c.relationship || '',
          background: c.background || '',
          avatar: c.avatar || '',
          avatar_prompt: c.avatarPrompt || '',
          sort_order: index,
        }));

        await ctx.model.ScriptCharacter.bulkCreate(records, { transaction });
      }

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  /**
   * 更新单个角色
   * @param {number} characterId - 角色真实ID
   * @param {number} userId - 用户ID
   * @param {object} data - 更新数据
   */
  async update(characterId, userId, data) {
    const { ctx } = this;

    const character = await ctx.model.ScriptCharacter.findOne({
      where: { id: characterId },
      raw: true,
    });
    if (!character) ctx.throw(404, '角色不存在');

    /* 验证剧本归属 */
    await this._verifyScript(character.script_id, userId);

    const updateData = {};
    const allowedFields = {
      roleType: 'role_type',
      name: 'name',
      gender: 'gender',
      age: 'age',
      relationship: 'relationship',
      background: 'background',
      avatar: 'avatar',
      avatarPrompt: 'avatar_prompt',
      sortOrder: 'sort_order',
    };

    for (const [key, dbField] of Object.entries(allowedFields)) {
      if (data[key] !== undefined) {
        updateData[dbField] = data[key];
      }
    }

    /* JSON字段特殊处理 */
    if (data.personality !== undefined) {
      updateData.personality = JSON.stringify(data.personality);
    }
    if (data.appearance !== undefined) {
      updateData.appearance = JSON.stringify(data.appearance);
    }

    if (Object.keys(updateData).length > 0) {
      await ctx.model.ScriptCharacter.update(updateData, {
        where: { id: characterId },
      });
    }
  }

  /**
   * 删除单个角色
   * @param {number} characterId - 角色真实ID
   * @param {number} userId - 用户ID
   */
  async destroy(characterId, userId) {
    const { ctx } = this;

    const character = await ctx.model.ScriptCharacter.findOne({
      where: { id: characterId },
      raw: true,
    });
    if (!character) ctx.throw(404, '角色不存在');

    await this._verifyScript(character.script_id, userId);

    /* 清理磁盘上的形象图片 */
    if (character.avatar) {
      ctx.helper.removeUploadedFile(character.avatar);
    }

    await ctx.model.ScriptCharacter.destroy({
      where: { id: characterId },
    });
  }

  /**
   * 预览解析结果（只解析不保存），返回新旧对比摘要
   * @param {number} scriptId - 剧本真实ID
   * @param {number} userId - 用户ID
   * @param {string} text - 人物介绍文本
   * @returns {Promise<object>} { newChars, diff }
   */
  async parsePreview(scriptId, userId, text) {
    const { ctx } = this;
    await this._verifyScript(scriptId, userId);

    if (!text || !text.trim()) return { newChars: [], diff: null };

    /* 解析文本得到新角色 */
    const newChars = this._parseCharacterText(text);

    /* 查询现有角色 */
    const oldChars = await ctx.model.ScriptCharacter.findAll({
      where: { script_id: scriptId },
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
      raw: true,
    });

    /* 生成对比摘要 */
    const diff = this._buildDiff(oldChars, newChars);

    return { newChars, diff };
  }

  /**
   * 生成新旧角色对比摘要
   * @param {Array} oldChars - 数据库中的旧角色（raw）
   * @param {Array} newChars - 新解析的角色
   * @returns {object} 对比摘要
   * @private
   */
  _buildDiff(oldChars, newChars) {
    /* 字段中文标签映射 */
    const fieldLabels = {
      roleType: '角色类型', gender: '性别', age: '年龄',
      personality: '性格特点', appearance: '容貌',
      relationship: '与主角关系', background: '人物经历',
    };

    /* 按 name 建立旧角色索引 */
    const oldMap = new Map();
    for (const c of oldChars) {
      oldMap.set(c.name, c);
    }

    const updated = [];    /* 有变化的角色 */
    const preserved = [];  /* 形象图将被保留的角色 */
    const added = [];      /* 新增角色 */
    const removed = [];    /* 将被删除的角色 */

    const newNameSet = new Set();

    for (const nc of newChars) {
      newNameSet.add(nc.name);
      const oc = oldMap.get(nc.name);

      if (!oc) {
        /* 新增角色 */
        added.push({ name: nc.name, roleType: nc.roleType });
        continue;
      }

      /* 匹配到 → 对比字段变化 */
      const changedFields = [];
      if (nc.roleType !== oc.role_type) changedFields.push(fieldLabels.roleType);
      if (nc.gender !== oc.gender) changedFields.push(fieldLabels.gender);
      if (nc.age !== oc.age) changedFields.push(fieldLabels.age);
      if (nc.relationship !== (oc.relationship || '')) changedFields.push(fieldLabels.relationship);
      if (nc.background !== (oc.background || '')) changedFields.push(fieldLabels.background);
      /* JSON字段对比（序列化后比较） */
      if (JSON.stringify(nc.personality || []) !== (oc.personality || '[]')) changedFields.push(fieldLabels.personality);
      if (JSON.stringify(nc.appearance || []) !== (oc.appearance || '[]')) changedFields.push(fieldLabels.appearance);

      if (changedFields.length > 0) {
        updated.push({ name: nc.name, changedFields });
      }

      /* 有形象图的角色 → 标记保留 */
      if (oc.avatar) {
        preserved.push({ name: nc.name, avatar: oc.avatar });
      }
    }

    /* 旧角色中不在新解析结果里的 → 将被删除 */
    for (const oc of oldChars) {
      if (!newNameSet.has(oc.name)) {
        removed.push({ name: oc.name, hasAvatar: !!oc.avatar });
      }
    }

    return { updated, preserved, added, removed };
  }

  /**
   * 从人物介绍文本解析结构化角色数据（智能合并模式）
   * 按角色名匹配：匹配到的保留avatar/avatarPrompt并更新其他字段，新增的插入，消失的删除
   * @param {number} scriptId - 剧本真实ID
   * @param {number} userId - 用户ID
   * @param {string} text - 人物介绍文本
   * @returns {Promise<Array>} 合并后的角色数组
   */
  async parseFromText(scriptId, userId, text) {
    const { ctx } = this;

    await this._verifyScript(scriptId, userId);

    if (!text || !text.trim()) return [];

    /* 解析文本 */
    const newChars = this._parseCharacterText(text);
    if (newChars.length === 0) return [];

    /* 查询现有角色 */
    const oldChars = await ctx.model.ScriptCharacter.findAll({
      where: { script_id: scriptId },
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
      raw: true,
    });

    /* 如果没有旧数据，直接全量插入 */
    if (oldChars.length === 0) {
      await this.batchSave(scriptId, userId, newChars);
      return this.list(scriptId, userId);
    }

    /* 按 name 建立旧角色索引 */
    const oldMap = new Map();
    for (const c of oldChars) {
      oldMap.set(c.name, c);
    }

    /* 智能合并：事务内执行 */
    const transaction = await ctx.model.transaction();
    try {
      const newNameSet = new Set(newChars.map(c => c.name));

      /* 1. 删除消失的角色 */
      const removeIds = oldChars
        .filter(c => !newNameSet.has(c.name))
        .map(c => c.id);
      if (removeIds.length > 0) {
        await ctx.model.ScriptCharacter.destroy({
          where: { id: removeIds },
          transaction,
        });
      }

      /* 2. 更新匹配到的角色（保留 avatar 和 avatar_prompt） */
      for (let i = 0; i < newChars.length; i++) {
        const nc = newChars[i];
        const oc = oldMap.get(nc.name);

        if (oc) {
          /* 匹配到 → 更新文本字段，保留 avatar/avatar_prompt */
          await ctx.model.ScriptCharacter.update({
            role_type: nc.roleType || 'other',
            gender: nc.gender || '',
            age: nc.age || '',
            personality: JSON.stringify(nc.personality || []),
            appearance: JSON.stringify(nc.appearance || []),
            relationship: nc.relationship || '',
            background: nc.background || '',
            sort_order: i,
          }, {
            where: { id: oc.id },
            transaction,
          });
        } else {
          /* 新增角色 → 插入 */
          await ctx.model.ScriptCharacter.create({
            script_id: scriptId,
            role_type: nc.roleType || 'other',
            name: nc.name || '',
            gender: nc.gender || '',
            age: nc.age || '',
            personality: JSON.stringify(nc.personality || []),
            appearance: JSON.stringify(nc.appearance || []),
            relationship: nc.relationship || '',
            background: nc.background || '',
            avatar: '',
            avatar_prompt: '',
            sort_order: i,
          }, { transaction });
        }
      }

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    /* 返回合并后的数据 */
    return this.list(scriptId, userId);
  }

  /**
   * 解析人物介绍文本为结构化数据
   * 支持AI生成的标准格式：-- 角色类型：\n* 字段：值
   * @param {string} text - 人物介绍原始文本
   * @returns {Array} 角色数组
   * @private
   */
  _parseCharacterText(text) {
    const characters = [];

    /* 按角色分隔符分割，兼容 "-- " 和 "* -- " 两种格式 */
    const normalized = text.replace(/^\*?\s*--\s+/, '\n-- ');
    const blocks = normalized.split(/\n\*?\s*--\s+/).filter(Boolean);

    /* 角色类型关键词映射 */
    const roleTypeMap = {
      '主角': 'protagonist',
      '反派': 'antagonist',
      '朋友': 'ally',
      '盟友': 'ally',
      '朋友/盟友': 'ally',
      '恋人': 'lover',
      '情感': 'lover',
      '恋人/情感线角色': 'lover',
      '对手': 'rival',
      '竞争者': 'rival',
      '对手/竞争者': 'rival',
    };

    for (const block of blocks) {
      const lines = block.trim();
      if (!lines) continue;

      /* 提取角色类型（第一行的冒号前部分） */
      const firstLine = lines.split('\n')[0].trim();
      let roleType = 'other';
      for (const [keyword, type] of Object.entries(roleTypeMap)) {
        if (firstLine.includes(keyword)) {
          roleType = type;
          break;
        }
      }

      /* 提取各字段 */
      const character = {
        roleType,
        name: this._extractField(lines, '姓名'),
        gender: this._extractField(lines, '性别'),
        age: this._extractField(lines, '年龄'),
        personality: this._extractListField(lines, '性格特点'),
        appearance: this._extractListField(lines, '容貌'),
        relationship: this._extractField(lines, '与主角关系'),
        background: this._extractField(lines, '人物经历'),
      };

      /* 至少有姓名才算有效角色 */
      if (character.name) {
        characters.push(character);
      }
    }

    return characters;
  }

  /**
   * 从文本块中提取单行字段值
   * @param {string} text - 文本块
   * @param {string} fieldName - 字段名
   * @returns {string}
   * @private
   */
  _extractField(text, fieldName) {
    const regex = new RegExp(`\\*\\s*${fieldName}[：:]\\s*(.+)`, 'm');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  }

  /**
   * 从文本块中提取列表字段（如性格特点、容貌）
   * 格式：关键词：描述 或 - 关键词：描述
   * @param {string} text - 文本块
   * @param {string} fieldName - 字段名
   * @returns {Array<{keyword: string, desc: string}>}
   * @private
   */
  _extractListField(text, fieldName) {
    const items = [];

    /* 找到字段起始位置 */
    const fieldRegex = new RegExp(`\\*\\s*${fieldName}[：:]`, 'm');
    const fieldMatch = text.match(fieldRegex);
    if (!fieldMatch) return items;

    const startIdx = text.indexOf(fieldMatch[0]) + fieldMatch[0].length;
    const remaining = text.slice(startIdx);

    /* 提取缩进的列表项（以 - 开头） */
    const listRegex = /[-*]\s*(.+?)[：:]\s*(.+)/gm;
    const lines = remaining.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      /* 遇到下一个 * 字段就停止 */
      if (trimmed.startsWith('* ') && !trimmed.startsWith('* -')) break;

      const itemMatch = trimmed.match(/^(?:[-*]|\d+[.)、])\s*(.+?)[：:]\s*(.+)/);
      if (itemMatch) {
        items.push({
          keyword: itemMatch[1].trim(),
          desc: itemMatch[2].trim(),
        });
      }
    }

    return items;
  }

  /**
   * 格式化角色数据（数据库字段 → 前端字段）
   * @param {object} c - 数据库原始记录
   * @returns {object}
   * @private
   */
  _formatCharacter(c) {
    const { ctx } = this;
    return {
      id: ctx.helper.encodeId(c.id),
      scriptId: ctx.helper.encodeId(c.script_id),
      roleType: c.role_type,
      name: c.name,
      gender: c.gender,
      age: c.age,
      personality: this._safeJsonParse(c.personality, []),
      appearance: this._safeJsonParse(c.appearance, []),
      relationship: c.relationship || '',
      background: c.background || '',
      avatar: c.avatar || '',
      avatarPrompt: c.avatar_prompt || '',
      sortOrder: c.sort_order,
    };
  }

  /**
   * 安全JSON解析
   * @param {string} str - JSON字符串
   * @param {*} defaultVal - 解析失败的默认值
   * @returns {*}
   * @private
   */
  _safeJsonParse(str, defaultVal) {
    if (!str) return defaultVal;
    try {
      return JSON.parse(str);
    } catch {
      return defaultVal;
    }
  }

  /**
   * 验证剧本归属
   * @param {number} scriptId - 剧本真实ID
   * @param {number} userId - 用户ID
   * @private
   */
  async _verifyScript(scriptId, userId) {
    const { ctx } = this;
    const script = await ctx.model.Script.findOne({
      where: { id: scriptId, user_id: userId },
      attributes: ['id'],
      raw: true,
    });
    if (!script) ctx.throw(404, '剧本不存在');
  }
}

module.exports = ScriptCharacterService;
