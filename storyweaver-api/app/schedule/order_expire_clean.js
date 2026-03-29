'use strict';

const Subscription = require('egg').Subscription;

/**
 * 过期订单清理定时任务
 * 每10分钟执行一次，将超过15分钟仍未支付的订单标记为已过期（status=2）
 */
class OrderExpireClean extends Subscription {

  static get schedule() {
    return {
      interval: '10m',      /* 每10分钟执行一次 */
      type: 'worker',        /* 只在一个worker上执行，避免重复 */
      immediate: false,
      disable: false,
    };
  }

  async subscribe() {
    const { ctx } = this;
    const { Op } = ctx.app.Sequelize;

    try {
      /* 批量将已过期的待支付订单标记为已过期 */
      const [affectedCount] = await ctx.model.RechargeOrder.update(
        { status: 2 },
        {
          where: {
            status: 0,
            expired_at: { [Op.lt]: new Date() },
          },
        }
      );

      if (affectedCount > 0) {
        ctx.logger.info(`[订单过期清理] 已标记 ${affectedCount} 个过期订单`);
      }
    } catch (err) {
      ctx.logger.error('[订单过期清理] 执行异常:', err);
    }
  }
}

module.exports = OrderExpireClean;
