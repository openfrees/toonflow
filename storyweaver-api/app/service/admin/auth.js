'use strict';

const Service = require('egg').Service;
const bcrypt = require('bcryptjs');

/**
 * 登录失败锁定：内存存储
 * 结构：Map<username, { count: number, lockedUntil: number | null }>
 */
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 10 * 60 * 1000; // 10分钟

/**
 * 管理后台 - 认证服务
 */
class AuthService extends Service {

  /**
   * 获取账号的锁定状态
   * @param {string} username
   * @returns {{ locked: boolean, remainSeconds: number, remainAttempts: number }}
   */
  _getLockStatus(username) {
    const record = loginAttempts.get(username);
    if (!record) {
      return { locked: false, remainSeconds: 0, remainAttempts: MAX_ATTEMPTS };
    }

    if (record.lockedUntil) {
      const now = Date.now();
      if (now < record.lockedUntil) {
        const remainSeconds = Math.ceil((record.lockedUntil - now) / 1000);
        return { locked: true, remainSeconds, remainAttempts: 0 };
      }
      loginAttempts.delete(username);
      return { locked: false, remainSeconds: 0, remainAttempts: MAX_ATTEMPTS };
    }

    return { locked: false, remainSeconds: 0, remainAttempts: MAX_ATTEMPTS - record.count };
  }

  /**
   * 记录一次登录失败
   * @param {string} username
   * @returns {{ locked: boolean, remainSeconds: number, remainAttempts: number }}
   */
  _recordFailure(username) {
    let record = loginAttempts.get(username);
    if (!record) {
      record = { count: 0, lockedUntil: null };
      loginAttempts.set(username, record);
    }

    record.count += 1;

    if (record.count >= MAX_ATTEMPTS) {
      record.lockedUntil = Date.now() + LOCK_DURATION_MS;
      const remainSeconds = Math.ceil(LOCK_DURATION_MS / 1000);

      setTimeout(() => {
        loginAttempts.delete(username);
      }, LOCK_DURATION_MS);

      return { locked: true, remainSeconds, remainAttempts: 0 };
    }

    return { locked: false, remainSeconds: 0, remainAttempts: MAX_ATTEMPTS - record.count };
  }

  /**
   * 清除登录失败记录（登录成功时调用）
   * @param {string} username
   */
  _clearFailure(username) {
    loginAttempts.delete(username);
  }

  /**
   * 管理员登录
   * @param {string} username - 用户名
   * @param {string} password - 密码
   * @returns {Promise<{ token: string, userInfo: object }>}
   */
  async login(username, password) {
    const { ctx, app } = this;

    /* 检查是否被锁定 */
    const lockStatus = this._getLockStatus(username);
    if (lockStatus.locked) {
      const err = new Error(`登录失败次数过多，请${lockStatus.remainSeconds}秒后再试`);
      err.lockInfo = lockStatus;
      throw err;
    }

    /* 查询管理员 */
    const admin = await ctx.model.AdminUser.findOne({
      where: { username },
      raw: true,
    });

    if (!admin) {
      const failInfo = this._recordFailure(username);
      const err = new Error('用户名或密码错误');
      err.lockInfo = failInfo;
      throw err;
    }

    if (admin.status !== 1) {
      throw new Error('账号已被禁用，请联系管理员');
    }

    /* 验证密码 */
    const isMatch = bcrypt.compareSync(password, admin.password);
    if (!isMatch) {
      const failInfo = this._recordFailure(username);
      const err = new Error('用户名或密码错误');
      err.lockInfo = failInfo;
      throw err;
    }

    /* 登录成功，清除失败记录 */
    this._clearFailure(username);

    /* 生成JWT Token */
    const token = app.jwt.sign(
      { id: admin.id, username: admin.username, role: admin.role },
      app.config.jwt.secret,
      { expiresIn: app.config.jwt.expiresIn }
    );

    /* 更新最后登录时间 */
    await ctx.model.AdminUser.update(
      { last_login_at: new Date() },
      { where: { id: admin.id } }
    );

    return {
      token,
      userInfo: {
        id: String(admin.id),
        username: admin.username,
        nickname: admin.nickname,
        avatar: admin.avatar,
        role: admin.role,
      },
    };
  }

  /**
   * 获取当前登录管理员信息
   * @returns {Promise<object>}
   */
  async getUserInfo() {
    const { ctx } = this;
    const { id } = ctx.state.adminUser;

    const admin = await ctx.model.AdminUser.findOne({
      where: { id },
      attributes: { exclude: ['password'] },
      raw: true,
    });

    if (!admin) {
      throw new Error('管理员不存在');
    }

    return {
      ...admin,
      id: String(admin.id),
    };
  }

  /**
   * 修改密码
   * @param {string} oldPassword - 旧密码
   * @param {string} newPassword - 新密码
   */
  async changePassword(oldPassword, newPassword) {
    const { ctx } = this;
    const { id } = ctx.state.adminUser;

    const admin = await ctx.model.AdminUser.findOne({
      where: { id },
      raw: true,
    });

    /* 验证旧密码 */
    const isMatch = bcrypt.compareSync(oldPassword, admin.password);
    if (!isMatch) {
      throw new Error('原密码错误');
    }

    /* 加密新密码 */
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(newPassword, salt);

    await ctx.model.AdminUser.update(
      { password: hashedPassword },
      { where: { id } }
    );
  }
}

module.exports = AuthService;
