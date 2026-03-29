'use strict';

const Service = require('egg').Service;
const dayjs = require('dayjs');

/**
 * 管理后台 - 订单服务
 * 提供收益统计和订单列表查询
 */
class OrderService extends Service {

  /**
   * 获取收益统计
   * 今日 / 7天 / 30天 / 累计 充值金额
   * @returns {Promise<object>}
   */
  async getStats() {
    const { ctx } = this;
    const { Op, fn, col } = ctx.model.Sequelize;

    /* 只统计已支付订单 */
    const baseWhere = { status: 1 };

    const [todaySum, weekSum, monthSum, totalSum, todayCount, totalCount] = await Promise.all([
      /* 今日充值金额 */
      ctx.model.RechargeOrder.findOne({
        attributes: [[fn('COALESCE', fn('SUM', col('amount')), 0), 'total']],
        where: {
          ...baseWhere,
          paid_at: { [Op.gte]: dayjs().startOf('day').toDate() },
        },
        raw: true,
      }),
      /* 7天充值金额 */
      ctx.model.RechargeOrder.findOne({
        attributes: [[fn('COALESCE', fn('SUM', col('amount')), 0), 'total']],
        where: {
          ...baseWhere,
          paid_at: { [Op.gte]: dayjs().subtract(7, 'day').startOf('day').toDate() },
        },
        raw: true,
      }),
      /* 30天充值金额 */
      ctx.model.RechargeOrder.findOne({
        attributes: [[fn('COALESCE', fn('SUM', col('amount')), 0), 'total']],
        where: {
          ...baseWhere,
          paid_at: { [Op.gte]: dayjs().subtract(30, 'day').startOf('day').toDate() },
        },
        raw: true,
      }),
      /* 累计充值金额 */
      ctx.model.RechargeOrder.findOne({
        attributes: [[fn('COALESCE', fn('SUM', col('amount')), 0), 'total']],
        where: baseWhere,
        raw: true,
      }),
      /* 今日订单数 */
      ctx.model.RechargeOrder.count({
        where: {
          ...baseWhere,
          paid_at: { [Op.gte]: dayjs().startOf('day').toDate() },
        },
      }),
      /* 累计订单数 */
      ctx.model.RechargeOrder.count({ where: baseWhere }),
    ]);

    return {
      todayAmount: Number(todaySum?.total) || 0,
      weekAmount: Number(weekSum?.total) || 0,
      monthAmount: Number(monthSum?.total) || 0,
      totalAmount: Number(totalSum?.total) || 0,
      todayCount,
      totalCount,
    };
  }

  /**
   * 获取订单列表
   * @param {object} params - 查询参数
   * @param {number} params.page - 页码
   * @param {number} params.pageSize - 每页条数
   * @param {number} [params.status] - 状态筛选
   * @param {string} [params.orderType] - 类型筛选: vip
   * @param {string} [params.keyword] - 关键词搜索(订单号/用户ID)
   * @param {string} [params.userId] - 用户ID筛选
   * @returns {Promise<object>}
   */
  async getList(params) {
    const { ctx } = this;
    const { page = 1, pageSize = 20, status, orderType, keyword, userId } = params;

    /* 构建WHERE条件 */
    const conditions = [];
    const replacements = [];

    /* 状态筛选 */
    if (status !== undefined && status !== '' && status !== null) {
      conditions.push('o.status = ?');
      replacements.push(Number(status));
    }

    /* 类型筛选 */
    if (orderType) {
      conditions.push('o.order_type = ?');
      replacements.push(orderType);
    }

    /* 关键词搜索 */
    if (keyword) {
      conditions.push('(o.order_no LIKE ? OR o.trade_no LIKE ?)');
      replacements.push(`%${keyword}%`, `%${keyword}%`);
    }

    /* 用户ID筛选 */
    if (userId) {
      conditions.push('o.user_id = ?');
      replacements.push(Number(userId));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    /* 查询总数 */
    const countSql = `
      SELECT COUNT(*) AS total
      FROM recharge_order o
      LEFT JOIN user u ON o.user_id = u.id
      ${whereClause}
    `;
    const [countResult] = await ctx.model.query(countSql, {
      replacements,
      type: ctx.model.Sequelize.QueryTypes.SELECT,
    });

    /* 查询列表（LEFT JOIN user 获取 user_no） */
    const listSql = `
      SELECT
        CAST(o.id AS CHAR) AS id,
        o.order_no,
        CAST(o.user_id AS CHAR) AS user_id,
        u.user_no,
        o.order_type,
        o.pay_method,
        o.amount,
        o.status,
        o.product_name,
        o.trade_no,
        o.paid_at,
        o.created_at,
        o.updated_at
      FROM recharge_order o
      LEFT JOIN user u ON o.user_id = u.id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const listReplacements = [...replacements, Number(pageSize), (page - 1) * Number(pageSize)];
    const rows = await ctx.model.query(listSql, {
      replacements: listReplacements,
      type: ctx.model.Sequelize.QueryTypes.SELECT,
    });

    return { rows, count: countResult.total };
  }
}

module.exports = OrderService;
