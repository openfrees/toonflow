'use strict';

const { Controller } = require('egg');

/**
 * 用户模型配置控制器（C端）
 * 处理模型 CRUD、场景绑定、测试连接、配置状态查询
 */
class ModelConfigController extends Controller {

  /**
   * 获取模型列表
   * GET /api/model-config/models?type=text
   */
  async listModels() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const { type } = ctx.query;

    if (type && !['text', 'image'].includes(type)) {
      ctx.body = ctx.helper.fail('type 参数无效，应为 text 或 image');
      return;
    }

    const list = await ctx.service.api.modelConfig.listModels(userId, type || null);
    ctx.body = ctx.helper.success(list);
  }

  /**
   * 获取单个模型详情
   * GET /api/model-config/models/:id
   */
  async getModel() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const realId = ctx.helper.decodeId(ctx.params.id);
    if (!realId) {
      ctx.body = ctx.helper.fail('无效的模型ID');
      return;
    }

    const model = await ctx.service.api.modelConfig.getModel(userId, realId);
    if (!model) {
      ctx.status = 404;
      ctx.body = ctx.helper.fail('模型不存在');
      return;
    }

    ctx.body = ctx.helper.success(model);
  }

  /**
   * 创建模型
   * POST /api/model-config/models
   */
  async createModel() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const { type, name, provider, apiKey, baseUrl, modelId, maxTokens, temperature, extraParams } = ctx.request.body;

    if (!apiKey || !baseUrl || !modelId) {
      ctx.body = ctx.helper.fail('apiKey、baseUrl、modelId 为必填');
      return;
    }

    if (type && !['text', 'image'].includes(type)) {
      ctx.body = ctx.helper.fail('type 参数无效');
      return;
    }

    const model = await ctx.service.api.modelConfig.createModel(userId, {
      type, name: name || modelId, provider, apiKey, baseUrl, modelId, maxTokens, temperature, extraParams,
    });

    ctx.body = ctx.helper.success(model, '模型创建成功');
  }

  /**
   * 更新模型
   * PUT /api/model-config/models/:id
   */
  async updateModel() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const realId = ctx.helper.decodeId(ctx.params.id);
    if (!realId) {
      ctx.body = ctx.helper.fail('无效的模型ID');
      return;
    }

    const model = await ctx.service.api.modelConfig.updateModel(userId, realId, ctx.request.body);
    if (!model) {
      ctx.status = 404;
      ctx.body = ctx.helper.fail('模型不存在');
      return;
    }

    ctx.body = ctx.helper.success(model, '模型更新成功');
  }

  /**
   * 删除模型
   * DELETE /api/model-config/models/:id
   */
  async deleteModel() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const realId = ctx.helper.decodeId(ctx.params.id);
    if (!realId) {
      ctx.body = ctx.helper.fail('无效的模型ID');
      return;
    }

    const success = await ctx.service.api.modelConfig.deleteModel(userId, realId);
    if (!success) {
      ctx.status = 404;
      ctx.body = ctx.helper.fail('模型不存在');
      return;
    }

    ctx.body = ctx.helper.success(null, '模型删除成功');
  }

  /**
   * 获取场景绑定列表
   * GET /api/model-config/scenes
   */
  async listScenes() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const scenes = await ctx.service.api.modelConfig.listScenes(userId);
    ctx.body = ctx.helper.success(scenes);
  }

  /**
   * 绑定场景到模型
   * POST /api/model-config/scenes/bind
   */
  async bindScene() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const { sceneCode, modelId } = ctx.request.body;

    if (!sceneCode || !modelId) {
      ctx.body = ctx.helper.fail('sceneCode 和 modelId 为必填');
      return;
    }

    if (!['script_gen', 'image_gen'].includes(sceneCode)) {
      ctx.body = ctx.helper.fail('sceneCode 无效');
      return;
    }

    const result = await ctx.service.api.modelConfig.bindScene(userId, sceneCode, modelId);
    if (!result) {
      ctx.body = ctx.helper.fail('绑定失败：模型不存在或类型不匹配');
      return;
    }

    ctx.body = ctx.helper.success(result, '绑定成功');
  }

  /**
   * 解绑场景
   * POST /api/model-config/scenes/unbind
   */
  async unbindScene() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const { sceneCode } = ctx.request.body;

    if (!sceneCode) {
      ctx.body = ctx.helper.fail('sceneCode 为必填');
      return;
    }

    await ctx.service.api.modelConfig.unbindScene(userId, sceneCode);
    ctx.body = ctx.helper.success(null, '已解绑');
  }

  /**
   * 获取配置状态（前端用于判断是否需要弹确认框）
   * GET /api/model-config/status
   */
  async getStatus() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const status = await ctx.service.api.modelConfig.getConfigStatus(userId);
    ctx.body = ctx.helper.success(status);
  }

  /**
   * 测试模型连接
   * POST /api/model-config/test
   */
  async testConnection() {
    const { ctx } = this;
    const { type, apiKey, baseUrl, modelId } = ctx.request.body;

    if (!apiKey || !baseUrl) {
      ctx.body = ctx.helper.fail('apiKey 和 baseUrl 为必填');
      return;
    }

    const result = await ctx.service.api.modelConfig.testConnection({
      type: type || 'text',
      apiKey,
      baseUrl,
      modelId: modelId || '',
    });

    ctx.body = ctx.helper.success(result);
  }
}

module.exports = ModelConfigController;
