'use strict';

const Service = require('egg').Service;

/**
 * C端 - 兑换码服务
 * 用户使用兑换码
 */
class RedeemService extends Service {

  /**
   * 使用兑换码
   * @param {number} userId - 用户ID
   * @param {string} code - 兑换码
   * @returns {Promise<Record<string, never>>}
   */
  async useCode(userId, code) {
    const { ctx } = this;

    /* 兑换码转大写并去除首尾空格 */
    const normalizedCode = String(code).trim().toUpperCase();

    if (!normalizedCode) {
      throw new Error('请输入兑换码');
    }

    /* 使用事务保证数据一致性 */
    const transaction = await ctx.model.transaction();

    try {
      /* 查询兑换码（加锁防止并发） */
      const redeemCode = await ctx.model.RedeemCode.findOne({
        where: { code: normalizedCode },
        lock: transaction.LOCK.UPDATE,
        transaction,
        raw: true,
      });

      /* 校验：兑换码是否存在 */
      if (!redeemCode) {
        throw new Error('兑换码不存在');
      }

      /* 校验：兑换码是否启用 */
      if (redeemCode.status !== 1) {
        throw new Error('该兑换码已被禁用');
      }

      /* 校验：兑换码是否过期 */
      if (new Date(redeemCode.expire_at) <= new Date()) {
        throw new Error('该兑换码已过期');
      }

      /* 校验：兑换码使用次数是否已满 */
      if (redeemCode.used_count >= redeemCode.max_uses) {
        throw new Error('该兑换码已被使用完毕');
      }

      /* 校验：同一用户是否已使用过该兑换码 */
      const existLog = await ctx.model.RedeemLog.findOne({
        where: {
          redeem_code_id: redeemCode.id,
          user_id: userId,
        },
        raw: true,
        transaction,
      });
      if (existLog) {
        throw new Error('您已使用过该兑换码');
      }

      /* 更新兑换码使用次数 */
      await ctx.model.RedeemCode.update(
        { used_count: redeemCode.used_count + 1 },
        { where: { id: redeemCode.id }, transaction }
      );

      /* 写入兑换记录 */
      const now = new Date();
      await ctx.model.RedeemLog.create({
        redeem_code_id: redeemCode.id,
        user_id: userId,
        code: normalizedCode,
        points: redeemCode.points,
        created_at: now,
        updated_at: now,
      }, { transaction });

      await transaction.commit();

      return {};
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
}

module.exports = RedeemService;
