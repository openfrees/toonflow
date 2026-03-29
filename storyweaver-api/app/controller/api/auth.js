'use strict';

const Controller = require('egg').Controller;

/**
 * C端认证控制器
 * 处理用户注册、登录、发送验证码、获取用户信息等接口
 * 根据 deployMode 自动适配 network / localhost 模式
 */
class UserAuthController extends Controller {

  /**
   * POST /api/auth/login - 账号密码登录
   * network 模式：账号必须已注册
   * localhost 模式：账号不存在则自动注册
   */
  async login() {
    const { ctx } = this;

    ctx.validate({
      phone: { type: 'string', required: true, message: '手机号不能为空' },
      password: { type: 'string', required: true, message: '密码不能为空' },
    });

    const { phone, password } = ctx.request.body;

    try {
      const result = await ctx.service.api.auth.loginByPassword(phone, password);
      ctx.body = ctx.helper.success(result, result.isNewUser ? '注册并登录成功' : '登录成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  /**
   * POST /api/auth/login-by-phone - 手机号验证码登录（仅 network 模式）
   */
  async loginByPhone() {
    const { ctx } = this;

    if (ctx.app.config.deployMode === 'localhost') {
      ctx.body = ctx.helper.fail('本地模式不支持验证码登录，请使用手机号+密码登录');
      return;
    }

    ctx.validate({
      phone: { type: 'string', required: true, message: '手机号不能为空' },
      code: { type: 'string', required: true, message: '验证码不能为空' },
    });

    const { phone, code } = ctx.request.body;

    try {
      const result = await ctx.service.api.auth.loginByPhone(phone, code);
      ctx.body = ctx.helper.success(result, '登录成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  /**
   * POST /api/auth/set-password - 首次手机号登录后设置密码
   */
  async setPassword() {
    const { ctx } = this;

    ctx.validate({
      password: { type: 'string', required: true, message: '密码不能为空' },
    });

    const { password } = ctx.request.body;

    try {
      const result = await ctx.service.api.auth.setPassword(password);
      ctx.body = ctx.helper.success(result, '密码设置成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  /**
   * POST /api/auth/change-password - 修改登录密码
   */
  async changePassword() {
    const { ctx } = this;

    ctx.validate({
      oldPassword: { type: 'string', required: true, message: '旧密码不能为空' },
      newPassword: { type: 'string', required: true, message: '新密码不能为空' },
    });

    const { oldPassword, newPassword } = ctx.request.body;

    try {
      const result = await ctx.service.api.auth.changePassword(oldPassword, newPassword);
      ctx.body = ctx.helper.success(result, '密码修改成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  /**
   * POST /api/auth/send-code - 发送短信验证码（仅 network 模式）
   */
  async sendCode() {
    const { ctx } = this;

    if (ctx.app.config.deployMode === 'localhost') {
      ctx.body = ctx.helper.fail('本地模式不支持短信验证码');
      return;
    }

    ctx.validate({
      phone: { type: 'string', required: true, message: '手机号不能为空' },
      captcha_id: { type: 'string', required: false },
      captcha_text: { type: 'string', required: false },
    });

    const { phone, captcha_id, captcha_text } = ctx.request.body;

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      ctx.body = ctx.helper.fail('请输入正确的手机号');
      return;
    }

    try {
      const ip = ctx.get('x-forwarded-for')?.split(',')[0]?.trim() || ctx.ip;
      const result = await ctx.service.api.sms.sendCode(phone, ip, captcha_id, captcha_text);
      ctx.body = ctx.helper.success(result, result.message || '验证码已发送');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  /**
   * GET /api/auth/captcha - 获取图片验证码（仅 network 模式）
   */
  async getCaptcha() {
    const { ctx } = this;

    if (ctx.app.config.deployMode === 'localhost') {
      ctx.body = ctx.helper.fail('本地模式不支持图片验证码');
      return;
    }

    try {
      const result = await ctx.service.api.sms.generateCaptcha();
      ctx.body = ctx.helper.success(result, '获取成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  /**
   * GET /api/auth/userinfo - 获取当前用户信息（需鉴权）
   */
  async userInfo() {
    const { ctx } = this;

    try {
      const result = await ctx.service.api.auth.getUserInfo();
      ctx.body = ctx.helper.success(result);
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  /**
   * POST /api/auth/logout - 退出登录
   */
  async logout() {
    const { ctx } = this;
    ctx.body = ctx.helper.success(null, '退出成功');
  }

  /**
   * GET /api/auth/deploy-mode - 获取当前部署模式（前端用）
   */
  async deployMode() {
    const { ctx } = this;
    ctx.body = ctx.helper.success({
      deployMode: ctx.app.config.deployMode,
    });
  }
}

module.exports = UserAuthController;
