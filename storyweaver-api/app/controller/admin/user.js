'use strict';

const Controller = require('egg').Controller;

/**
 * 管理后台 - 用户管理控制器
 * 提供用户注册统计和用户列表查询接口
 */
class UserController extends Controller {

  /**
   * 获取注册统计
   * GET /admin/user/stats
   */
  async stats() {
    const { ctx } = this;
    try {
      const data = await ctx.service.admin.user.getStats();
      ctx.body = ctx.helper.success(data);
    } catch (err) {
      ctx.body = ctx.helper.fail('获取统计数据失败');
    }
  }

  /**
   * 获取用户列表
   * GET /admin/user
   * Query: page, pageSize, status, loginType, vipTierId, keyword
   */
  async index() {
    const { ctx } = this;
    const { page = 1, pageSize = 20, status, loginType, vipTierId, keyword } = ctx.query;

    try {
      const result = await ctx.service.admin.user.getList({
        page: Number(page),
        pageSize: Number(pageSize),
        status,
        loginType,
        vipTierId,
        keyword,
      });
      ctx.body = ctx.helper.paginate(result, page, pageSize);
    } catch (err) {
      ctx.body = ctx.helper.fail('获取用户列表失败');
    }
  }

  /**
   * 更新用户状态（启用/禁用）
   * PUT /admin/user/:id/status
   * Body: { status: 0|1 }
   */
  async updateStatus() {
    const { ctx } = this;
    const { id } = ctx.params;
    const { status } = ctx.request.body;

    if (status === undefined || ![0, 1].includes(Number(status))) {
      ctx.body = ctx.helper.fail('状态参数无效');
      return;
    }

    try {
      await ctx.service.admin.user.updateStatus(id, Number(status));
      ctx.body = ctx.helper.success(null, status === 1 ? '已启用' : '已禁用');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message || '操作失败');
    }
  }

  /**
   * 智能搜索用户（用于订单筛选）
   * GET /admin/user/search
   * Query: keyword
   */
  async search() {
    const { ctx } = this;
    const { keyword } = ctx.query;

    try {
      const users = await ctx.service.admin.user.searchUsers(keyword);
      ctx.body = ctx.helper.success(users);
    } catch (err) {
      ctx.body = ctx.helper.fail('搜索失败');
    }
  }

  /**
   * 一键删除用户所有数据（临时测试功能）
   * DELETE /admin/user/:id
   * 删除用户及其所有关联数据：积分记录、充值订单、兑换记录、剧本、AI聊天、反馈等
   */
  async destroy() {
    const { ctx } = this;
    const { id } = ctx.params;

    if (!id) {
      ctx.body = ctx.helper.fail('用户ID不能为空');
      return;
    }

    try {
      const result = await ctx.service.admin.user.destroyUser(id);
      ctx.body = ctx.helper.success(result, '用户数据已全部删除');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message || '删除失败');
    }
  }
}

module.exports = UserController;
