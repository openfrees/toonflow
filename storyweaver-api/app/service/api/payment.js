'use strict';

const Service = require('egg').Service;
const dayjs = require('dayjs');
const alipayLib = require('../../lib/alipay');

/**
 * C端支付服务
 * 处理订单创建、支付查询、异步回调、订单履约
 */
class PaymentService extends Service {

  /**
   * 校验VIP等级是否允许购买（高等级不能买低等级）
   * @param {number} userId - 用户ID
   * @param {string} targetTierCode - 目标等级代码
   * @returns {Promise<{allowed: boolean, reason?: string}>}
   */
  async checkVipTierUpgrade(userId, targetTierCode) {
    const { ctx } = this;

    const membership = await ctx.service.api.membership.getMembershipByUserId(userId);
    const targetLevel = ctx.service.api.membership.getLevelByTierCode(targetTierCode);
    if (!targetLevel || !targetLevel.level) {
      return { allowed: true };
    }

    if (targetLevel.level_rank < Number(membership.level_rank || 0)) {
      return {
        allowed: false,
        reason: `您当前是${membership.level_name}，无法购买更低等级的会员`,
      };
    }

    return { allowed: true };
  }

  /**
   * 生成商户订单号
   * 格式：SW + 年月日时分秒 + 6位随机数
   * @returns {string}
   */
  _generateOrderNo() {
    const timestamp = dayjs().format('YYYYMMDDHHmmss');
    const random = Math.floor(100000 + Math.random() * 900000);
    return `SW${timestamp}${random}`;
  }

  /**
   * 根据订单类型和商品详情，从数据库查询真实价格（防止前端篡改金额）
   * @param {string} orderType - 订单类型: vip
   * @param {object} productDetail - 商品详情
   * @returns {Promise<{amount: number, productName: string, verifiedDetail: object}>}
   */
  async _verifyAndGetPrice(orderType, productDetail) {
    const { ctx } = this;
    const detail = productDetail || {};

    if (orderType === 'vip') {
      const { tierCode, planCode } = detail;
      if (!tierCode || !planCode) throw new Error('VIP订单缺少tierCode或planCode');

      const tier = await ctx.model.VipTier.findOne({
        attributes: ['id', 'name'],
        where: { tier_code: tierCode },
        raw: true,
      });
      if (!tier) throw new Error(`VIP等级不存在: ${tierCode}`);

      const plan = await ctx.model.VipPlan.findOne({
        attributes: ['id', 'name'],
        where: { plan_code: planCode },
        raw: true,
      });
      if (!plan) throw new Error(`套餐周期不存在: ${planCode}`);

      const price = await ctx.model.VipPrice.findOne({
        attributes: ['current_price'],
        where: { vip_tier_id: tier.id, vip_plan_id: plan.id },
        raw: true,
      });
      if (!price || Number(price.current_price) <= 0) {
        throw new Error(`未找到 ${tier.name}-${plan.name} 的定价配置`);
      }

      return {
        amount: Number(price.current_price),
        productName: `知剧AI - ${tier.name}(${plan.name})`,
        productDesc: `知剧AI ${tier.name}会员 ${plan.name}套餐`,
        verifiedDetail: { tierCode, planCode },
      };
    }

    throw new Error('无效的订单类型');
  }

  /**
   * 创建充值订单（金额由后端从数据库查询，拒绝前端传入）
   * @param {object} params - 订单参数
   * @param {number} params.userId - 用户ID
   * @param {string} params.orderType - 订单类型: vip
   * @param {string} params.payMethod - 支付方式: alipay / wechat
   * @param {object} params.productDetail - 商品详情（tierCode+planCode）
   * @returns {Promise<object>} { orderNo, payFormHtml, amount, expiredAt }
   */
  async createOrder(params) {
    const { ctx, app } = this;

    /* 从数据库查询真实价格，拒绝前端传入的 amount（防篡改） */
    const verified = await this._verifyAndGetPrice(params.orderType, params.productDetail);
    const amount = verified.amount;
    const productName = verified.productName;
    const productDesc = verified.productDesc;

    /* 生成订单号 */
    const orderNo = this._generateOrderNo();

    /* 订单15分钟后过期 */
    const expiredAt = dayjs().add(15, 'minute').toDate();

    /* 创建本地订单记录（product_detail 使用后端校验后的数据） */
    await ctx.model.RechargeOrder.create({
      order_no: orderNo,
      user_id: params.userId,
      order_type: params.orderType,
      pay_method: params.payMethod,
      amount,
      status: 0,
      product_name: productName,
      product_detail: verified.verifiedDetail,
      expired_at: expiredAt,
    });

    /* 调用支付宝电脑网站支付 */
    let payFormHtml = '';
    if (params.payMethod === 'alipay') {
      try {
        const alipayConfig = app.config.alipay;
        const formHtml = await alipayLib.pagePay(alipayConfig, {
          outTradeNo: orderNo,
          totalAmount: String(amount),
          subject: productName,
          body: productDesc,
        });

        payFormHtml = formHtml;
        ctx.logger.info('[支付宝电脑网站支付] 表单生成成功, 订单号:', orderNo, ', 金额:', amount);
      } catch (err) {
        ctx.logger.error('[支付宝电脑网站支付] 调用失败 >>>>>>>>>>>>>>>>');
        ctx.logger.error('[支付宝电脑网站支付] 错误信息:', err.message);
        ctx.logger.error('[支付宝电脑网站支付] 错误代码:', err.code || '无');
        ctx.logger.error('[支付宝电脑网站支付] 完整错误:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
        await ctx.model.RechargeOrder.update(
          { remark: `支付宝电脑网站支付失败: ${err.message}` },
          { where: { order_no: orderNo } }
        );
        throw new Error('支付宝接口调用失败，请稍后重试');
      }
    }

    return {
      orderNo,
      payFormHtml,
      amount,
      expiredAt: dayjs(expiredAt).format('YYYY-MM-DD HH:mm:ss'),
    };
  }

  /**
   * 查询订单状态
   * 先查本地，如果本地待支付则去支付宝查询最新状态
   * @param {string} orderNo - 商户订单号
   * @param {number} userId - 用户ID（校验归属）
   * @returns {Promise<object>} 订单状态信息
   */
  async queryOrder(orderNo, userId) {
    const { ctx, app } = this;

    const order = await ctx.model.RechargeOrder.findOne({
      where: { order_no: orderNo, user_id: userId },
      raw: true,
    });

    if (!order) {
      throw new Error('订单不存在');
    }

    /* 已支付/已退款 → 确定终态，直接返回 */
    if (order.status === 1 || order.status === 3) {
      return {
        orderNo: order.order_no,
        status: order.status,
        statusText: this._getStatusText(order.status),
        amount: order.amount,
        paidAt: order.paid_at,
      };
    }

    /* 待支付(0) 或 已过期(2)：用户可能已在支付宝完成支付，主动查询确认
     * 特别是过期订单：定时任务可能在回调到达前就标记了过期，必须向支付宝确认 */
    if (order.pay_method === 'alipay') {
      try {
        const alipayConfig = app.config.alipay;
        const tradeResult = await alipayLib.queryTrade(alipayConfig, orderNo);
        const tradeStatus = tradeResult.tradeStatus;
        if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
          await this.fulfillOrder(orderNo, tradeResult.tradeNo, tradeResult);
          return {
            orderNo: order.order_no,
            status: 1,
            statusText: '已支付',
            amount: order.amount,
            paidAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          };
        }
      } catch (err) {
        ctx.logger.warn('[支付宝查询] 查询失败:', err.message);
      }
    }

    /* 支付宝未确认成功：status=0 检查是否应该标记过期 */
    if (order.status === 0 && order.expired_at && dayjs().isAfter(dayjs(order.expired_at))) {
      await ctx.model.RechargeOrder.update(
        { status: 2 },
        { where: { order_no: orderNo, status: 0 } }
      );
      return {
        orderNo: order.order_no,
        status: 2,
        statusText: '已过期',
        amount: order.amount,
      };
    }

    /* 已过期且支付宝确认未成功 */
    if (order.status === 2) {
      return {
        orderNo: order.order_no,
        status: 2,
        statusText: '已过期',
        amount: order.amount,
      };
    }

    return {
      orderNo: order.order_no,
      status: 0,
      statusText: '待支付',
      amount: order.amount,
      expiredAt: order.expired_at,
    };
  }

  /**
   * 处理支付宝异步回调通知
   * @param {object} notifyData - 回调POST数据
   * @returns {Promise<boolean>} 处理结果
   */
  async handleNotify(notifyData) {
    const { ctx, app } = this;

    ctx.logger.info('[支付宝回调] ========== 开始处理 ==========');
    ctx.logger.info('[支付宝回调] 原始数据:', JSON.stringify(notifyData));
    ctx.logger.info('[支付宝回调] 订单号:', notifyData.out_trade_no);
    ctx.logger.info('[支付宝回调] 支付宝交易号:', notifyData.trade_no);
    ctx.logger.info('[支付宝回调] 交易状态:', notifyData.trade_status);
    ctx.logger.info('[支付宝回调] 交易金额:', notifyData.total_amount);
    ctx.logger.info('[支付宝回调] 买家账号:', notifyData.buyer_logon_id);
    ctx.logger.info('[支付宝回调] 通知时间:', notifyData.notify_time);
    ctx.logger.info('[支付宝回调] 通知类型:', notifyData.notify_type);

    /* 1. 验证签名 */
    const alipayConfig = app.config.alipay;
    const signValid = alipayLib.checkNotifySign(alipayConfig, notifyData);
    ctx.logger.info(`[支付宝回调] 验签结果: ${signValid ? '✅ 通过' : '❌ 失败'}`);
    if (!signValid) {
      ctx.logger.error('[支付宝回调] 验签失败，拒绝处理:', JSON.stringify(notifyData));
      return false;
    }

    const orderNo = notifyData.out_trade_no;
    const tradeNo = notifyData.trade_no;
    const tradeStatus = notifyData.trade_status;

    ctx.logger.info(`[支付宝回调] 订单:${orderNo} 状态:${tradeStatus}`);

    /* 2. 校验 app_id 是否为本应用（防止其他应用的通知误投） */
    if (notifyData.app_id !== alipayConfig.appId) {
      ctx.logger.error(`[支付宝回调] app_id不匹配: 期望${alipayConfig.appId}, 实际${notifyData.app_id}`);
      return false;
    }

    /* 3. 查询本地订单 */
    const order = await ctx.model.RechargeOrder.findOne({
      where: { order_no: orderNo },
      raw: true,
    });

    if (!order) {
      ctx.logger.error('[支付宝回调] 订单不存在:', orderNo);
      return false;
    }

    ctx.logger.info(`[支付宝回调] 本地订单状态: ${order.status}, 类型: ${order.order_type}, 金额: ${order.amount}`);

    /* 4. 校验回调金额与本地订单金额是否一致（防止金额篡改） */
    const notifyAmount = parseFloat(notifyData.total_amount);
    const localAmount = parseFloat(order.amount);
    if (Math.abs(notifyAmount - localAmount) > 0.001) {
      ctx.logger.error(`[支付宝回调] 金额不匹配: 本地${localAmount}, 回调${notifyAmount}, 订单${orderNo}`);
      return false;
    }

    /* 5. 已支付的订单不重复处理 */
    if (order.status === 1) {
      ctx.logger.info('[支付宝回调] 订单已处理，跳过:', orderNo);
      return true;
    }

    /* 6. 交易成功 → 执行履约 */
    if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
      ctx.logger.info(`[支付宝回调] 交易成功，开始履约: 订单${orderNo}`);
      await this.fulfillOrder(orderNo, tradeNo, notifyData);
      ctx.logger.info(`[支付宝回调] 履约完成: 订单${orderNo}`);
      ctx.logger.info('[支付宝回调] ========== 处理完成 ==========');
      return true;
    }

    /* 7. 其他状态，记录通知数据 */
    ctx.logger.info(`[支付宝回调] 非成功状态(${tradeStatus})，仅记录数据: 订单${orderNo}`);
    await ctx.model.RechargeOrder.update(
      { notify_data: JSON.stringify(notifyData) },
      { where: { order_no: orderNo } }
    );

    ctx.logger.info('[支付宝回调] ========== 处理完成 ==========');
    return true;
  }

  /**
   * 订单履约 - 支付成功后的业务处理
   * VIP订单 → 开通/续费会员
   * @param {string} orderNo - 商户订单号
   * @param {string} tradeNo - 支付宝交易号
   * @param {object} rawData - 原始回调/查询数据
   */
  async fulfillOrder(orderNo, tradeNo, rawData) {
    const { ctx } = this;

    /* 使用乐观锁更新，防止并发重复履约
     * 同时接受 status=0（待支付）和 status=2（已过期）：
     * 过期订单可能因回调延迟导致用户已付款但本地已标记过期，必须允许恢复 */
    const { Op } = ctx.app.Sequelize;
    const [affectedCount] = await ctx.model.RechargeOrder.update(
      {
        status: 1,
        trade_no: tradeNo,
        paid_at: new Date(),
        notify_data: JSON.stringify(rawData),
      },
      { where: { order_no: orderNo, status: { [Op.in]: [0, 2] } } }
    );

    /* 未更新任何行，说明已被处理（status=1 已支付 或 status=3 已退款） */
    if (affectedCount === 0) {
      ctx.logger.info('[订单履约] 订单已被处理，跳过:', orderNo);
      return;
    }

    /* 查询订单详情 */
    const order = await ctx.model.RechargeOrder.findOne({
      where: { order_no: orderNo },
      raw: true,
    });

    if (!order) return;
    const detail = ctx.helper.parseJsonObject(order.product_detail, {});

    /* 根据订单类型执行不同的履约逻辑 */
    if (order.order_type === 'vip') {
      /* VIP会员开通/续费 */
      const tierCode = detail.tierCode;
      const planCode = detail.planCode;

      if (!tierCode || !planCode) {
        ctx.logger.error(`[订单履约] VIP订单缺少tierCode或planCode: 订单${orderNo}`, detail);
        return;
      }

      /* 查询目标VIP等级 */
      const targetTier = await ctx.model.VipTier.findOne({
        where: { tier_code: tierCode },
        raw: true,
      });

      if (!targetTier) {
        ctx.logger.error(`[订单履约] VIP等级不存在: ${tierCode}, 订单${orderNo}`);
        return;
      }

      /* 根据套餐周期计算增加的天数 */
      const planDaysMap = { month: 30, quarter: 90, year: 365 };
      const addDays = planDaysMap[planCode] || 30;

      /* 查询用户当前VIP状态 */
      const user = await ctx.model.User.findOne({
        attributes: ['id', 'vip_tier_id', 'vip_expires_at'],
        where: { id: order.user_id },
        raw: true,
      });

      if (!user) {
        ctx.logger.error(`[订单履约] 用户不存在: ${order.user_id}, 订单${orderNo}`);
        return;
      }

      let newExpiresAt;
      const now = dayjs();
      const msPerDay = 24 * 60 * 60 * 1000;
      let bonusMs = 0; // 旧等级按月价折算后的额外时长（毫秒）

      const hasActiveVip = user.vip_tier_id && user.vip_expires_at && dayjs(user.vip_expires_at).isAfter(now);
      const currentMembership = await ctx.service.api.membership.getMembershipByUser(user);
      const targetMembership = ctx.service.api.membership.buildMembershipFromTier(targetTier);
      const sameLevelRenewal = hasActiveVip
        && Number(currentMembership.level_rank || 0) === Number(targetMembership.level_rank || 0);

      if (sameLevelRenewal) {
        /* 同会员层级续费：在现有到期时间基础上延长 */
        newExpiresAt = dayjs(user.vip_expires_at).add(addDays, 'day').toDate();
        ctx.logger.info(`[订单履约] VIP同层级续费: 用户${order.user_id}, ${tierCode}, 在原到期时间上+${addDays}天`);

      } else if (hasActiveVip && Number(targetMembership.level_rank || 0) > Number(currentMembership.level_rank || 0)) {
        /* 跨等级升级：按月价折算旧等级剩余时长，避免按整天取整丢失小时/分钟 */
        const remainMs = Math.max(dayjs(user.vip_expires_at).diff(now), 0);

        /* 查询旧等级和新等级的月价（plan_code=month 的 current_price） */
        const monthPlan = await ctx.model.VipPlan.findOne({
          attributes: ['id'],
          where: { plan_code: 'month' },
          raw: true,
        });

        if (monthPlan) {
          const oldMonthPrice = await ctx.model.VipPrice.findOne({
            attributes: ['current_price'],
            where: { vip_tier_id: user.vip_tier_id, vip_plan_id: monthPlan.id },
            raw: true,
          });

          const newMonthPrice = await ctx.model.VipPrice.findOne({
            attributes: ['current_price'],
            where: { vip_tier_id: targetTier.id, vip_plan_id: monthPlan.id },
            raw: true,
          });

          if (oldMonthPrice && newMonthPrice && Number(newMonthPrice.current_price) > 0) {
            /* 折算公式：剩余时长 × (旧月价 / 新月价)，保留精确到毫秒的权益时长 */
            bonusMs = Math.round(remainMs * Number(oldMonthPrice.current_price) / Number(newMonthPrice.current_price));
            ctx.logger.info(
              `[订单履约] VIP升级折算: 旧等级剩余${(remainMs / msPerDay).toFixed(4)}天, 旧月价${oldMonthPrice.current_price}, 新月价${newMonthPrice.current_price}, 折算${(bonusMs / msPerDay).toFixed(4)}天`
            );
          }
        }

        newExpiresAt = now.add(addDays, 'day').add(bonusMs, 'millisecond').toDate();
        ctx.logger.info(
          `[订单履约] VIP升级: 用户${order.user_id}, → ${tierCode}, 新购${addDays}天 + 折算${(bonusMs / msPerDay).toFixed(4)}天`
        );

      } else {
        /* 新开通 / 已过期：从今天开始算 */
        newExpiresAt = now.add(addDays, 'day').toDate();
        ctx.logger.info(`[订单履约] VIP开通: 用户${order.user_id}, ${tierCode}, 从今天起+${addDays}天`);
      }

      /* 更新用户VIP状态 */
      await ctx.model.User.update(
        {
          vip_tier_id: targetTier.id,
          vip_expires_at: newExpiresAt,
        },
        { where: { id: order.user_id } }
      );

      ctx.logger.info(`[订单履约] VIP开通成功: 用户${order.user_id}, 等级=${tierCode}, 到期=${dayjs(newExpiresAt).format('YYYY-MM-DD HH:mm:ss')}, 订单${orderNo}`);
    }
  }

  /**
   * 获取当前用户的购买记录列表（分页）
   * @param {object} params - { userId, page, pageSize }
   * @returns {Promise<{list: Array, pagination: object}>}
   */
  async getUserOrders({ userId, page = 1, pageSize = 15 }) {
    const { ctx } = this;
    const offset = (page - 1) * pageSize;

    const { count, rows } = await ctx.model.RechargeOrder.findAndCountAll({
      where: { user_id: userId, status: 1 },
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset,
      raw: true,
    });

    /* 格式化列表数据 */
    const list = rows.map(row => ({
      id: String(row.id),
      orderNo: row.order_no,
      orderType: row.order_type,
      orderTypeText: row.order_type === 'vip' ? 'VIP会员' : '其他',
      payMethod: row.pay_method,
      payMethodText: row.pay_method === 'alipay' ? '支付宝' : '微信',
      amount: Number(row.amount).toFixed(2),
      status: row.status,
      statusText: this._getStatusText(row.status),
      productName: row.product_name || '',
      paidAt: row.paid_at ? dayjs(row.paid_at).format('YYYY-MM-DD HH:mm:ss') : null,
      createdAt: dayjs(row.created_at).format('YYYY-MM-DD HH:mm:ss'),
    }));

    return {
      list,
      pagination: { page, pageSize, total: count },
    };
  }

  /**
   * 获取状态文本
   * @param {number} status
   * @returns {string}
   */
  _getStatusText(status) {
    const map = { 0: '待支付', 1: '已支付', 2: '已过期', 3: '已退款' };
    return map[status] || '未知';
  }
}

module.exports = PaymentService;
