'use strict';

const Controller = require('egg').Controller;

/**
 * 管理后台 - 系统配置控制器
 */
class SystemConfigController extends Controller {

  /**
   * GET /admin/system/config - 获取所有系统配置
   */
  async getAll() {
    const { ctx } = this;
    try {
      const list = await ctx.service.admin.system.getAll();
      ctx.body = ctx.helper.success(list);
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  /**
   * POST /admin/system/config - 保存配置（有则更新，无则新增）
   */
  async save() {
    const { ctx } = this;

    ctx.validate({
      func_key: { type: 'string', required: true, message: '功能键名不能为空' },
      func_value: { type: 'string', required: false },
      func_desc: { type: 'string', required: false },
      cleanup_paths: { type: 'array', required: false, itemType: 'string' },
    });

    const { func_key, func_value, func_desc, cleanup_paths } = ctx.request.body;

    try {
      const result = await ctx.service.admin.system.save({ func_key, func_value, func_desc, cleanup_paths });
      ctx.body = ctx.helper.success(result, '保存成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }
}

module.exports = SystemConfigController;
