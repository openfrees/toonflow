'use strict';

const Controller = require('egg').Controller;

/**
 * 管理后台 - 调试控制器
 * 手动触发定时任务，方便本地测试VIP过期逻辑
 */
class DebugController extends Controller {

  /**
   * POST /admin/debug/run-vip-expire-check
   * 手动触发VIP过期检测
   */
  async runVipExpireCheck() {
    const { ctx } = this;

    try {
      ctx.logger.info('[DEBUG] 手动触发VIP过期检测');

      const VipExpireCheck = require('../../schedule/vip_expire_check');
      const task = new VipExpireCheck(ctx);
      await task.subscribe();

      ctx.body = ctx.helper.success(null, 'VIP过期检测已执行，请查看服务端日志');
    } catch (err) {
      ctx.logger.error('[DEBUG] VIP过期检测执行失败:', err);
      ctx.body = ctx.helper.fail(err.message);
    }
  }
}

module.exports = DebugController;
