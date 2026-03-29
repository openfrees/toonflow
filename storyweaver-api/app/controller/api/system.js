'use strict';

const Controller = require('egg').Controller;

/**
 * C端系统配置控制器
 * 只返回前端可安全公开使用的系统配置
 */
class SystemController extends Controller {

  /**
   * GET /api/system/public-config - 获取前端公开配置
   */
  async publicConfig() {
    const { ctx } = this;

    try {
      const data = await ctx.service.admin.system.getPublicConfig();
      ctx.body = ctx.helper.success(data);
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }
}

module.exports = SystemController;
