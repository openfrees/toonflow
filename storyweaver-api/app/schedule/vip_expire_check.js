'use strict';

const Subscription = require('egg').Subscription;

/**
 * VIP会员过期检测定时任务
 * 每天凌晨 00:05 执行，检测所有已过期的VIP用户，清除会员状态
 * 必须在积分发放任务之前执行（积分发放在 00:10）
 */
class VipExpireCheck extends Subscription {

  static get schedule() {
    return {
      cron: '0 5 0 * * *', /* 每天凌晨 00:05 */
      type: 'worker',       /* 只在一个worker上执行，避免重复 */
      immediate: false,
      disable: false,
    };
  }

  async subscribe() {
    const { ctx } = this;
    const { Op } = ctx.app.Sequelize;


    try {
      /* 查询所有已过期的VIP用户（vip_tier_id 不为空 且 vip_expires_at < 当前时间） */
      const expiredUsers = await ctx.model.User.findAll({
        attributes: ['id', 'nickname', 'vip_tier_id', 'vip_expires_at'],
        where: {
          vip_tier_id: { [Op.ne]: null },
          vip_expires_at: { [Op.lt]: new Date() },
        },
        raw: true,
        limit: 1000, /* 每次最多处理1000个，防止数据量过大 */
      });

      if (expiredUsers.length === 0) {
        return;
      }


      /* 批量清除过期用户的VIP状态 */
      const expiredIds = expiredUsers.map(u => u.id);
      await ctx.model.User.update(
        {
          vip_tier_id: null,
          vip_expires_at: null,
          next_points_grant_at: null,
        },
        {
          where: { id: { [Op.in]: expiredIds } },
        }
      );
    } catch (err) {
      ctx.logger.error('[VIP过期检测] 执行失败: %s', err.message);
      /* 定时任务失败不抛到进程外 */
    }

  }
}

module.exports = VipExpireCheck;
