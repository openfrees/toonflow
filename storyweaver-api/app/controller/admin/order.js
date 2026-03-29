'use strict';

const Controller = require('egg').Controller;

/**
 * 管理后台 - 订单控制器
 * 提供订单收益统计和订单列表查询接口
 */
class OrderController extends Controller {

  /**
   * 获取收益统计
   * GET /admin/order/stats
   */
  async stats() {
    const { ctx } = this;
    try {
      const data = await ctx.service.admin.order.getStats();
      ctx.body = ctx.helper.success(data);
    } catch (err) {
      ctx.logger.error('[订单统计] 失败:', err);
      ctx.body = ctx.helper.fail('获取统计数据失败');
    }
  }

  /**
   * 获取订单列表
   * GET /admin/order
   * Query: page, pageSize, status, orderType, keyword, agentId, userId
   */
  async index() {
    const { ctx } = this;
    const { page = 1, pageSize = 20, status, orderType, keyword, userId } = ctx.query;

    try {
      const result = await ctx.service.admin.order.getList({
        page: Number(page),
        pageSize: Number(pageSize),
        status,
        orderType,
        keyword,
        userId,
      });
      ctx.body = ctx.helper.paginate(result, page, pageSize);
    } catch (err) {
      ctx.logger.error('[订单列表] 失败:', err);
      ctx.body = ctx.helper.fail('获取订单列表失败');
    }
  }
}

module.exports = OrderController;
