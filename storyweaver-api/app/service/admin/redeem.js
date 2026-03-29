'use strict';

const Service = require('egg').Service;
const { Op } = require('sequelize');
const crypto = require('crypto');

/**
 * 管理后台 - 兑换码服务
 * 兑换码生成、列表查询、状态管理、兑换记录查询
 */
class RedeemService extends Service {

  /**
   * 生成随机兑换码（8位大写字母+数字）
   * @returns {string} 兑换码
   */
  _generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    const bytes = crypto.randomBytes(8);
    for (let i = 0; i < 8; i++) {
      code += chars[bytes[i] % chars.length];
    }
    return code;
  }

  /**
   * 批量生成兑换码
   * @param {object} data - 生成参数
   * @param {number} data.count - 生成数量（1-100）
   * @param {number} data.points - 积分额度
   * @param {number} data.max_uses - 最大使用次数
   * @param {string} data.expire_at - 过期时间
   * @param {string} data.remark - 备注
   * @param {number} adminId - 操作管理员ID
   * @returns {Promise<{ count: number, codes: string[] }>}
   */
  async generate(data, adminId) {
    const { ctx } = this;
    const count = Math.min(100, Math.max(1, Number(data.count) || 1));
    const codes = [];
    const records = [];

    /* 生成不重复的兑换码 */
    const existingCodes = new Set();
    let attempts = 0;
    const maxAttempts = count * 3;

    while (codes.length < count && attempts < maxAttempts) {
      attempts++;
      const code = this._generateCode();

      if (existingCodes.has(code)) continue;
      existingCodes.add(code);

      /* 检查数据库是否已存在 */
      const exist = await ctx.model.RedeemCode.findOne({
        where: { code },
        attributes: ['id'],
        raw: true,
      });
      if (exist) continue;

      codes.push(code);
      records.push({
        code,
        points: Number(data.points),
        max_uses: Number(data.max_uses) || 1,
        expire_at: data.expire_at,
        remark: data.remark || '',
        created_by: adminId,
      });
    }

    if (records.length === 0) {
      throw new Error('兑换码生成失败，请重试');
    }

    /* 批量插入 */
    await ctx.model.RedeemCode.bulkCreate(records);

    return {
      count: codes.length,
      codes,
    };
  }

  /**
   * 查询兑换码列表（分页）
   * @param {object} query - 查询参数
   * @param {number} query.page - 页码
   * @param {number} query.pageSize - 每页条数
   * @param {string} query.status - 状态筛选: all/unused/used/expired/disabled
   * @param {string} query.keyword - 关键词搜索（兑换码/备注）
   * @returns {Promise<{ list: Array, pagination: object }>}
   */
  async list(query = {}) {
    const { ctx } = this;
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20));
    const offset = (page - 1) * pageSize;

    const where = {};

    /* 状态筛选 */
    const now = new Date();
    if (query.status === 'unused') {
      /* 未使用：启用 + 未过期 + used_count < max_uses */
      where.status = 1;
      where.expire_at = { [Op.gt]: now };
      where.used_count = { [Op.lt]: ctx.model.Sequelize.col('max_uses') };
    } else if (query.status === 'used') {
      /* 已用完：used_count >= max_uses */
      where.used_count = { [Op.gte]: ctx.model.Sequelize.col('max_uses') };
    } else if (query.status === 'expired') {
      /* 已过期 */
      where.expire_at = { [Op.lte]: now };
    } else if (query.status === 'disabled') {
      /* 已禁用 */
      where.status = 0;
    }

    /* 关键词搜索 */
    if (query.keyword) {
      where[Op.or] = [
        { code: { [Op.like]: `%${query.keyword}%` } },
        { remark: { [Op.like]: `%${query.keyword}%` } },
      ];
    }

    const result = await ctx.model.RedeemCode.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset,
      raw: true,
    });

    const dayjs = require('dayjs');
    const list = result.rows.map(item => ({
      id: String(item.id),
      code: item.code,
      points: item.points,
      max_uses: item.max_uses,
      used_count: item.used_count,
      expire_at: dayjs(item.expire_at).format('YYYY-MM-DD HH:mm:ss'),
      status: item.status,
      remark: item.remark,
      created_by: item.created_by ? String(item.created_by) : null,
      created_at: dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss'),
      /* 计算状态标签 */
      status_label: this._getStatusLabel(item),
    }));

    return {
      list,
      pagination: {
        total: result.count,
        page,
        pageSize,
        totalPages: Math.ceil(result.count / pageSize),
      },
    };
  }

  /**
   * 计算兑换码状态标签
   * @param {object} item - 兑换码记录
   * @returns {string} 状态标签
   */
  _getStatusLabel(item) {
    if (item.status === 0) return 'disabled';
    if (new Date(item.expire_at) <= new Date()) return 'expired';
    if (item.used_count >= item.max_uses) return 'used';
    return 'unused';
  }

  /**
   * 更新兑换码状态（启用/禁用）
   * @param {string|number} id - 兑换码ID
   * @param {number} status - 状态值 0/1
   */
  async updateStatus(id, status) {
    const { ctx } = this;

    const code = await ctx.model.RedeemCode.findOne({
      where: { id },
      raw: true,
    });
    if (!code) {
      throw new Error('兑换码不存在');
    }

    await ctx.model.RedeemCode.update(
      { status: Number(status) },
      { where: { id } }
    );
  }

  /**
   * 删除兑换码
   * @param {string|number} id - 兑换码ID
   */
  async destroy(id) {
    const { ctx } = this;

    const code = await ctx.model.RedeemCode.findOne({
      where: { id },
      raw: true,
    });
    if (!code) {
      throw new Error('兑换码不存在');
    }

    /* 如果已有兑换记录，不允许删除 */
    if (code.used_count > 0) {
      throw new Error('该兑换码已有使用记录，无法删除');
    }

    await ctx.model.RedeemCode.destroy({ where: { id } });
  }

  /**
   * 查询兑换记录列表（分页）
   * @param {object} query - 查询参数
   * @param {number} query.page - 页码
   * @param {number} query.pageSize - 每页条数
   * @param {string} query.keyword - 关键词搜索（兑换码/用户手机号）
   * @returns {Promise<{ list: Array, pagination: object }>}
   */
  async logList(query = {}) {
    const { ctx } = this;
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20));
    const offset = (page - 1) * pageSize;

    /* 如果有手机号搜索，先查用户ID */
    let userIds = null;
    if (query.keyword) {
      const users = await ctx.model.User.findAll({
        where: { phone: { [Op.like]: `%${query.keyword}%` } },
        attributes: ['id'],
        raw: true,
      });
      userIds = users.map(u => u.id);
    }

    const where = {};
    if (query.keyword) {
      where[Op.or] = [
        { code: { [Op.like]: `%${query.keyword}%` } },
        ...(userIds && userIds.length > 0 ? [{ user_id: { [Op.in]: userIds } }] : []),
      ];
    }

    const result = await ctx.model.RedeemLog.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset,
      raw: true,
    });

    /* 批量查询用户信息 */
    const logUserIds = [...new Set(result.rows.map(r => r.user_id))];
    let userMap = {};
    if (logUserIds.length > 0) {
      const users = await ctx.model.User.findAll({
        where: { id: { [Op.in]: logUserIds } },
        attributes: ['id', 'nickname', 'phone', 'avatar'],
        raw: true,
      });
      userMap = users.reduce((map, u) => {
        map[u.id] = u;
        return map;
      }, {});
    }

    const dayjs = require('dayjs');
    const list = result.rows.map(item => {
      const user = userMap[item.user_id] || {};
      return {
        id: String(item.id),
        redeem_code_id: String(item.redeem_code_id),
        user_id: String(item.user_id),
        code: item.code,
        points: item.points,
        user_nickname: user.nickname || '-',
        user_phone: user.phone || '-',
        user_avatar: user.avatar || '',
        created_at: dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss'),
      };
    });

    return {
      list,
      pagination: {
        total: result.count,
        page,
        pageSize,
        totalPages: Math.ceil(result.count / pageSize),
      },
    };
  }
}

module.exports = RedeemService;
