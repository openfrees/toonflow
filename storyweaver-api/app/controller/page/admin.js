'use strict';

const Controller = require('egg').Controller;

/**
 * 管理后台页面控制器
 * 渲染 admin.nj 模板，前端 SPA 由 Vue Router 接管
 */
class AdminPageController extends Controller {

  async index() {
    const { ctx, app } = this;
    await ctx.render('admin.nj', {
      adminPrefix: app.config.adminPrefix || '/admin',
      deployMode: app.config.deployMode || 'network',
      cacheVersion: Date.now(),
    });
  }
}

module.exports = AdminPageController;
