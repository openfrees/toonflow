'use strict';

const Controller = require('egg').Controller;

/**
 * C端支付控制器
 * 处理充值订单的创建、查询和支付宝回调
 */
class PaymentController extends Controller {

  /**
   * 创建充值订单
   * POST /api/payment/create
   * Body: { orderType, payMethod, productDetail }
   * 金额由后端根据 productDetail 从数据库查询，前端无需也不允许传入 amount
   */
  async create() {
    const { ctx } = this;

    /* 参数校验（金额不再由前端传入） */
    ctx.validate({
      orderType: { type: 'string', required: true, trim: true },
      payMethod: { type: 'string', required: true, trim: true },
      productDetail: { type: 'object', required: true },
    });

    const { orderType, payMethod, productDetail } = ctx.request.body;

    /* 校验订单类型：旧积分充值已废弃，仅保留 VIP 购买 */
    if (orderType !== 'vip') {
      ctx.body = ctx.helper.fail('无效的订单类型');
      return;
    }

    /* 校验支付方式 */
    if (!['alipay', 'wechat'].includes(payMethod)) {
      ctx.body = ctx.helper.fail('无效的支付方式');
      return;
    }

    /* 当前只支持支付宝 */
    if (payMethod !== 'alipay') {
      ctx.body = ctx.helper.fail('暂不支持该支付方式，请选择支付宝');
      return;
    }

    try {
      /* VIP订单：校验等级（高等级不能购买低等级） */
      if (orderType === 'vip') {
        const detail = productDetail || {};
        if (detail.tierCode) {
          const canBuy = await ctx.service.api.payment.checkVipTierUpgrade(ctx.state.user.id, detail.tierCode);
          if (!canBuy.allowed) {
            ctx.body = ctx.helper.fail(canBuy.reason);
            return;
          }
        }
      }

      const result = await ctx.service.api.payment.createOrder({
        userId: ctx.state.user.id,
        orderType,
        payMethod,
        productDetail,
      });

      ctx.body = ctx.helper.success(result, '订单创建成功');
    } catch (err) {
      ctx.logger.error('[创建订单] 失败:', err);
      ctx.body = ctx.helper.fail(err.message || '创建订单失败');
    }
  }

  /**
   * 查询订单状态（前端轮询）
   * GET /api/payment/query?orderNo=xxx
   */
  async query() {
    const { ctx } = this;
    const { orderNo } = ctx.query;

    if (!orderNo) {
      ctx.body = ctx.helper.fail('缺少订单号');
      return;
    }

    try {
      const result = await ctx.service.api.payment.queryOrder(orderNo, ctx.state.user.id);
      ctx.body = ctx.helper.success(result);
    } catch (err) {
      ctx.logger.error('[查询订单] 失败:', err);
      ctx.body = ctx.helper.fail(err.message || '查询失败');
    }
  }

  /**
   * 获取当前用户的购买记录列表（分页）
   * GET /api/payment/orders?page=1&pageSize=15
   */
  async orders() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const page = parseInt(ctx.query.page) || 1;
    const pageSize = parseInt(ctx.query.pageSize) || 15;

    try {
      const result = await ctx.service.api.payment.getUserOrders({ userId, page, pageSize });
      ctx.body = ctx.helper.success(result);
    } catch (err) {
      ctx.logger.error('[购买记录] 查询失败:', err);
      ctx.body = ctx.helper.fail(err.message || '查询购买记录失败');
    }
  }

  /**
   * 支付宝异步回调通知
   * POST /api/payment/notify
   * 无需用户鉴权，支付宝服务器直接调用
   */
  async notify() {
    const { ctx } = this;

    try {
      const notifyData = ctx.request.body;
      ctx.logger.info('[支付宝回调] 收到通知:', JSON.stringify(notifyData));

      const success = await ctx.service.api.payment.handleNotify(notifyData);

      /* 支付宝回调响应：成功返回 "success"，失败返回 "fail" */
      ctx.body = success ? 'success' : 'fail';
    } catch (err) {
      ctx.logger.error('[支付宝回调] 处理异常:', err);
      ctx.body = 'fail';
    }
  }
}

module.exports = PaymentController;
