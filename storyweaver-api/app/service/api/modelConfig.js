'use strict';

const { Service } = require('egg');

/**
 * 用户模型配置 Service
 * 处理模型 CRUD、场景绑定、获取有效 AI 配置
 */
class ModelConfigService extends Service {

  /* ========== 模型 CRUD ========== */

  /**
   * 获取用户的模型列表
   * @param {number} userId - 用户ID
   * @param {string} [type] - 筛选类型：text/image，不传返回全部
   */
  async listModels(userId, type) {
    const { ctx } = this;
    const where = { user_id: userId };
    if (type) where.type = type;

    const models = await ctx.model.UserModel.findAll({
      where,
      order: [['sort_order', 'ASC'], ['id', 'DESC']],
      raw: true,
    });

    return models.map(m => this._formatModel(m));
  }

  /**
   * 获取单个模型详情
   */
  async getModel(userId, modelId) {
    const { ctx } = this;
    const model = await ctx.model.UserModel.findOne({
      where: { id: modelId, user_id: userId },
      raw: true,
    });
    return model ? this._formatModel(model) : null;
  }

  /**
   * 创建模型
   */
  async createModel(userId, data) {
    const { ctx } = this;
    const encryptedKey = ctx.helper.encryptAES(data.apiKey);

    const record = await ctx.model.UserModel.create({
      user_id: userId,
      type: data.type || 'text',
      name: data.name,
      provider: data.provider || 'custom',
      api_key: encryptedKey,
      base_url: data.baseUrl,
      model_id: data.modelId,
      max_tokens: data.maxTokens || 4096,
      temperature: data.temperature ?? 0.80,
      extra_params: data.extraParams ? JSON.stringify(data.extraParams) : null,
      is_active: 1,
      sort_order: data.sortOrder || 0,
    });

    return this._formatModel(record.get({ plain: true }));
  }

  /**
   * 更新模型
   */
  async updateModel(userId, modelId, data) {
    const { ctx } = this;
    const model = await ctx.model.UserModel.findOne({
      where: { id: modelId, user_id: userId },
    });
    if (!model) return null;

    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.provider !== undefined) updateData.provider = data.provider;
    if (data.baseUrl !== undefined) updateData.base_url = data.baseUrl;
    if (data.modelId !== undefined) {
      updateData.model_id = data.modelId;
      /* name 未传时自动同步为 modelId */
      if (data.name === undefined) updateData.name = data.modelId;
    }
    if (data.maxTokens !== undefined) updateData.max_tokens = data.maxTokens;
    if (data.temperature !== undefined) updateData.temperature = data.temperature;
    if (data.extraParams !== undefined) updateData.extra_params = JSON.stringify(data.extraParams);
    if (data.isActive !== undefined) updateData.is_active = data.isActive ? 1 : 0;
    if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder;

    /* API Key 只有明确传了才更新（前端脱敏后不回传） */
    if (data.apiKey) {
      updateData.api_key = ctx.helper.encryptAES(data.apiKey);
    }

    await model.update(updateData);
    return this._formatModel(model.get({ plain: true }));
  }

  /**
   * 删除模型（同时清理该模型的场景绑定）
   */
  async deleteModel(userId, modelId) {
    const { ctx } = this;
    const model = await ctx.model.UserModel.findOne({
      where: { id: modelId, user_id: userId },
    });
    if (!model) return false;

    /* 清理关联的场景绑定 */
    await ctx.model.UserModelScene.destroy({
      where: { user_id: userId, model_id: modelId },
    });

    await model.destroy();
    return true;
  }

  /* ========== 场景绑定 ========== */

  /**
   * 获取用户的场景绑定列表
   */
  async listScenes(userId) {
    const { ctx } = this;
    const scenes = await ctx.model.UserModelScene.findAll({
      where: { user_id: userId },
      raw: true,
    });

    const result = {};
    for (const scene of scenes) {
      const model = await ctx.model.UserModel.findOne({
        where: { id: scene.model_id, user_id: userId },
        raw: true,
      });
      result[scene.scene_code] = {
        sceneCode: scene.scene_code,
        modelId: ctx.helper.encodeId(scene.model_id),
        modelName: model ? model.name : '已删除的模型',
        modelProvider: model ? model.provider : '',
      };
    }
    return result;
  }

  /**
   * 绑定场景到模型（upsert）
   */
  async bindScene(userId, sceneCode, modelId) {
    const { ctx } = this;
    const realModelId = ctx.helper.decodeId(modelId);
    if (!realModelId) return null;

    /* 确认模型存在且属于该用户 */
    const model = await ctx.model.UserModel.findOne({
      where: { id: realModelId, user_id: userId },
      raw: true,
    });
    if (!model) return null;

    /* 检查场景类型是否匹配 */
    const expectedType = sceneCode === 'image_gen' ? 'image' : 'text';
    if (model.type !== expectedType) return null;

    /* upsert：有则更新，无则创建 */
    const existing = await ctx.model.UserModelScene.findOne({
      where: { user_id: userId, scene_code: sceneCode },
    });

    if (existing) {
      await existing.update({ model_id: realModelId });
    } else {
      await ctx.model.UserModelScene.create({
        user_id: userId,
        scene_code: sceneCode,
        model_id: realModelId,
      });
    }

    return {
      sceneCode,
      modelId,
      modelName: model.name,
    };
  }

  /**
   * 解绑场景
   */
  async unbindScene(userId, sceneCode) {
    const { ctx } = this;
    const result = await ctx.model.UserModelScene.destroy({
      where: { user_id: userId, scene_code: sceneCode },
    });
    return result > 0;
  }

  /* ========== 核心：获取有效的 AI 配置 ========== */

  /**
   * 获取用户在指定场景下的有效 AI 配置
   * 有用户配置返回用户的，无则返回 null（调用方 fallback 到系统默认）
   * @param {number} userId - 用户ID
   * @param {string} sceneCode - 场景编码：script_gen / image_gen
   * @returns {object|null} 与 app.config.ai 同结构的配置对象，或图片配置对象
   */
  async getEffectiveAiConfig(userId, sceneCode) {
    const { ctx } = this;

    /* 查场景绑定 */
    const scene = await ctx.model.UserModelScene.findOne({
      where: { user_id: userId, scene_code: sceneCode },
      raw: true,
    });
    if (!scene) return null;

    /* 查绑定的模型 */
    const model = await ctx.model.UserModel.findOne({
      where: { id: scene.model_id, user_id: userId, is_active: 1 },
      raw: true,
    });
    if (!model) return null;

    /* 解密 API Key */
    let apiKey;
    try {
      apiKey = ctx.helper.decryptAES(model.api_key);
    } catch (err) {
      ctx.logger.error('[ModelConfig] API Key 解密失败, modelId=%d: %s', model.id, err.message);
      return null;
    }

    if (sceneCode === 'image_gen') {
      const extra = ctx.helper.parseJsonObject(model.extra_params, {});
      return {
        _source: 'user',
        apiKey,
        baseURL: model.base_url,
        model: model.model_id,
        size: extra.size || '1680x2240',
      };
    }

    /* 文字模型：构建与 app.config.ai 同结构的配置 */
    return {
      _source: 'user',
      defaultProvider: 'user_custom',
      user_custom: {
        apiKey,
        baseURL: model.base_url,
        model: model.model_id,
        maxTokens: model.max_tokens || 4096,
        temperature: parseFloat(model.temperature) || 0.8,
      },
    };
  }

  /**
   * 检查用户是否配置了指定场景的模型
   */
  async hasSceneConfig(userId, sceneCode) {
    const { ctx } = this;
    const scene = await ctx.model.UserModelScene.findOne({
      where: { user_id: userId, scene_code: sceneCode },
      raw: true,
    });
    return !!scene;
  }

  /**
   * 获取用户的配置状态（两个场景是否都已设置）
   */
  async getConfigStatus(userId) {
    const { ctx } = this;
    const scenes = await ctx.model.UserModelScene.findAll({
      where: { user_id: userId },
      raw: true,
    });

    const configured = {};
    for (const s of scenes) {
      configured[s.scene_code] = true;
    }

    return {
      scriptGen: !!configured.script_gen,
      imageGen: !!configured.image_gen,
    };
  }

  /**
   * 测试模型连接（非流式同步请求，认证失败会直接抛错）
   */
  async testConnection(data) {
    const { ctx } = this;
    const { chat } = require('../../lib/ai_chat');
    const { OpenAI } = require('openai');

    if (data.type === 'image') {
      try {
        const client = new OpenAI({
          apiKey: data.apiKey,
          baseURL: data.baseUrl,
        });
        await client.models.list();
        return { success: true, message: '连接成功' };
      } catch (err) {
        return { success: false, message: `连接失败: ${err.message}` };
      }
    }

    /* 文字模型：用非流式 generateText 测试，认证/网络错误会直接 throw */
    try {
      const testConfig = {
        defaultProvider: 'test',
        test: {
          apiKey: data.apiKey,
          baseURL: data.baseUrl,
          model: data.modelId,
          maxTokens: 20,
          temperature: 0.1,
        },
      };
      const result = await chat(testConfig, [
        { role: 'user', content: '请回复ok' },
      ], { provider: 'test', maxTokens: 20 });

      if (!result || !result.content) {
        return { success: false, message: '连接失败: 未收到模型响应' };
      }
      return { success: true, message: '连接成功' };
    } catch (err) {
      return { success: false, message: `连接失败: ${err.message}` };
    }
  }

  /* ========== 私有方法 ========== */

  /**
   * 格式化模型记录（脱敏 + ID 编码）
   */
  _formatModel(record) {
    const { ctx } = this;
    let decryptedKey = '';
    try {
      decryptedKey = ctx.helper.decryptAES(record.api_key);
    } catch (_) {
      decryptedKey = '';
    }

    return {
      id: ctx.helper.encodeId(record.id),
      type: record.type,
      name: record.name,
      provider: record.provider,
      apiKey: decryptedKey,
      apiKeyMask: ctx.helper.maskApiKey(decryptedKey),
      baseUrl: record.base_url,
      modelId: record.model_id,
      maxTokens: record.max_tokens,
      temperature: parseFloat(record.temperature),
      extraParams: ctx.helper.parseJsonObject(record.extra_params, {}),
      isActive: !!record.is_active,
      sortOrder: record.sort_order,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }
}

module.exports = ModelConfigService;
