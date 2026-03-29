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

    ctx.logger.info('[VIP过期检测] ========== 开始执行 ==========');

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
        ctx.logger.info('[VIP过期检测] 无过期用户，跳过');
        ctx.logger.info('[VIP过期检测] ========== 执行完毕 ==========');
        return;
      }

      ctx.logger.info(`[VIP过期检测] 发现 ${expiredUsers.length} 个过期用户`);

      /* 批量清除过期用户的VIP状态 */
      const expiredIds = expiredUsers.map(u => u.id);
      const [affectedCount] = await ctx.model.User.update(
        {
          vip_tier_id: null,
          vip_expires_at: null,
          next_points_grant_at: null,
        },
        {
          where: { id: { [Op.in]: expiredIds } },
        }
      );

      /* 记录日志 */
      for (const user of expiredUsers) {
        ctx.logger.info(`[VIP过期检测] 已清除: 用户${user.id}(${user.nickname}), 原等级ID=${user.vip_tier_id}, 原到期=${user.vip_expires_at}`);
      }

      ctx.logger.info(`[VIP过期检测] 共清除 ${affectedCount} 个用户的VIP状态`);
    } catch (err) {
      ctx.logger.error('[VIP过期检测] 执行异常:', err);
    }

    ctx.logger.info('[VIP过期检测] ========== 执行完毕 ==========');
  }
}

module.exports = VipExpireCheck;
