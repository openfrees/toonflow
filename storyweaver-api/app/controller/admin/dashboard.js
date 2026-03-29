'use strict';

const Controller = require('egg').Controller;

/**
 * 管理后台 - 仪表盘控制器
 */
class DashboardController extends Controller {

  /**
   * GET /api/admin/dashboard/stats - 统计数据
   */
  async stats() {
    const { ctx } = this;

    try {
      const result = await ctx.service.admin.dashboard.getStats();
      ctx.body = ctx.helper.success(result);
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }
}

module.exports = DashboardController;
