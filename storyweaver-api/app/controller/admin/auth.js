'use strict';

const Controller = require('egg').Controller;

/**
 * 管理后台 - 认证控制器
 */
class AuthController extends Controller {

  /**
   * POST /api/admin/auth/login - 管理员登录
   */
  async login() {
    const { ctx } = this;

    /* 参数校验 */
    ctx.validate({
      username: { type: 'string', required: true, message: '用户名不能为空' },
      password: { type: 'string', required: true, message: '密码不能为空' },
    });

    const { username, password } = ctx.request.body;

    try {
      const result = await ctx.service.admin.auth.login(username, password);
      ctx.body = ctx.helper.success(result, '登录成功');
    } catch (err) {
      /* 携带锁定信息供前端展示倒计时 */
      if (err.lockInfo) {
        ctx.body = {
          code: 400,
          message: err.message,
          data: {
            locked: err.lockInfo.locked,
            remainSeconds: err.lockInfo.remainSeconds,
            remainAttempts: err.lockInfo.remainAttempts,
          },
        };
        return;
      }
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  /**
   * GET /api/admin/auth/userinfo - 获取当前用户信息
   */
  async userInfo() {
    const { ctx } = this;

    try {
      const result = await ctx.service.admin.auth.getUserInfo();
      ctx.body = ctx.helper.success(result);
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  /**
   * POST /api/admin/auth/change-password - 修改密码
   */
  async changePassword() {
    const { ctx } = this;

    ctx.validate({
      oldPassword: { type: 'string', required: true },
      newPassword: { type: 'string', required: true, min: 6 },
    });

    const { oldPassword, newPassword } = ctx.request.body;

    try {
      await ctx.service.admin.auth.changePassword(oldPassword, newPassword);
      ctx.body = ctx.helper.success(null, '密码修改成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  /**
   * POST /api/admin/auth/logout - 退出登录
   */
  async logout() {
    const { ctx } = this;
    ctx.body = ctx.helper.success(null, '退出成功');
  }
}

module.exports = AuthController;
