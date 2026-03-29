'use strict';

const Service = require('egg').Service;
const bcrypt = require('bcryptjs');

/**
 * C端认证服务
 * 处理用户注册、登录、信息获取等业务逻辑
 * 根据 deployMode 自动适配 network / localhost 模式
 */
class UserAuthService extends Service {

  /**
   * 账号密码登录
   * network 模式：手机号必须已注册，密码必须匹配
   * localhost 模式：手机号不存在则自动注册，首次设置密码
   * @param {string} phone - 手机号（作为账号）
   * @param {string} password - 密码
   * @returns {Promise<{ token: string, userInfo: object }>}
   */
  async loginByPassword(phone, password) {
    const { ctx, app } = this;
    const isLocal = app.config.deployMode === 'localhost';

    let user = await ctx.model.User.findOne({
      where: { phone },
      raw: true,
    });

    if (isLocal) {
      /* localhost 模式：不存在则自动创建账号 */
      if (!user) {
        return await this._localAutoRegisterAndLogin(phone, password);
      }

      /* 已存在用户：如果还没设置密码（历史数据），直接帮他设上 */
      if (!user.password) {
        const hashedPassword = bcrypt.hashSync(password, 10);
        await ctx.model.User.update(
          { password: hashedPassword },
          { where: { id: user.id } }
        );
        user.password = hashedPassword;
      }
    } else {
      /* network 模式：严格校验 */
      if (!user) {
        throw new Error('账号或密码错误');
      }
      if (!user.password) {
        throw new Error('该账号暂未设置密码，请使用手机号验证码登录');
      }
    }

    if (user.status !== 1) {
      throw new Error('账号已被禁用，请联系客服');
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      throw new Error('账号或密码错误');
    }

    /* localhost 模式下 token 有效期 365 天（配置已在 config 中设置） */
    const token = app.jwt.sign(
      { id: user.id, phone: user.phone, type: 'user' },
      app.config.jwt.secret,
      { expiresIn: app.config.jwt.expiresIn }
    );

    await ctx.model.User.update(
      { last_login_at: new Date() },
      { where: { id: user.id } }
    );

    const membership = await ctx.service.api.membership.getMembershipByUser(user);
    return {
      token,
      userInfo: this._formatUserInfo(user, membership),
    };
  }

  /**
   * localhost 模式专用：自动注册并登录
   * @param {string} phone - 手机号
   * @param {string} password - 密码
   * @returns {Promise<{ token: string, userInfo: object }>}
   * @private
   */
  async _localAutoRegisterAndLogin(phone, password) {
    const { ctx, app } = this;

    this._validatePassword(password);

    const hashedPassword = bcrypt.hashSync(password, 10);
    const created = await ctx.model.User.create({
      phone,
      password: hashedPassword,
      nickname: `用户${phone.slice(-4)}`,
      login_type: 'password',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${phone}`,
    });
    const user = created.get({ plain: true });

    const userNo = ctx.helper.generateUserNo(user.id);
    await ctx.model.User.update({ user_no: userNo }, { where: { id: user.id } });
    user.user_no = userNo;

    const token = app.jwt.sign(
      { id: user.id, phone: user.phone, type: 'user' },
      app.config.jwt.secret,
      { expiresIn: app.config.jwt.expiresIn }
    );

    ctx.logger.info('[localhost] 自动注册新用户 phone=%s, id=%d', phone, user.id);

    const membership = await ctx.service.api.membership.getMembershipByUser(user);
    return {
      token,
      userInfo: this._formatUserInfo(user, membership),
      isNewUser: true,
    };
  }

  /**
   * 手机号验证码登录（自动注册）— 仅 network 模式使用
   * @param {string} phone - 手机号
   * @param {string} code - 验证码
   * @returns {Promise<{ token: string, userInfo: object }>}
   */
  async loginByPhone(phone, code) {
    const { ctx, app } = this;

    /* localhost 模式不应走到这里，但做防御处理 */
    if (app.config.deployMode === 'localhost') {
      throw new Error('本地模式请使用手机号+密码登录');
    }

    const isValid = await this._verifySmsCode(phone, code);
    if (!isValid) {
      throw new Error('验证码错误或已过期');
    }

    let user = await ctx.model.User.findOne({
      where: { phone },
      raw: true,
    });

    let isNewUser = false;
    if (!user) {
      const created = await ctx.model.User.create({
        phone,
        nickname: `用户${phone.slice(-4)}`,
        login_type: 'phone',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${phone}`,
      });
      user = created.get({ plain: true });
      isNewUser = true;

      const userNo = ctx.helper.generateUserNo(user.id);
      await ctx.model.User.update({ user_no: userNo }, { where: { id: user.id } });
      user.user_no = userNo;
    }

    if (user.status !== 1) {
      throw new Error('账号已被禁用，请联系客服');
    }

    const token = app.jwt.sign(
      { id: user.id, phone: user.phone, type: 'user' },
      app.config.jwt.secret,
      { expiresIn: app.config.jwt.expiresIn }
    );

    await ctx.model.User.update(
      { last_login_at: new Date() },
      { where: { id: user.id } }
    );

    const membership = await ctx.service.api.membership.getMembershipByUser(user);
    return {
      token,
      userInfo: this._formatUserInfo(user, membership),
      isNewUser: isNewUser,
      needSetPassword: isNewUser,
    };
  }

  /**
   * 为已登录用户设置登录密码
   * @param {string} password - 明文密码
   * @returns {Promise<object>}
   */
  async setPassword(password) {
    const { ctx } = this;
    const { id } = ctx.state.user;

    const user = await ctx.model.User.findOne({
      where: { id, status: 1 },
      raw: true,
    });

    if (!user) {
      throw new Error('用户不存在或已被禁用');
    }

    if (user.password) {
      throw new Error('该账号已设置登录密码');
    }

    this._validatePassword(password);

    const hashedPassword = bcrypt.hashSync(password, 10);

    await ctx.model.User.update(
      { password: hashedPassword },
      { where: { id: user.id } }
    );

    return {
      hasPassword: true,
    };
  }

  /**
   * 修改当前登录用户的密码
   * @param {string} oldPassword - 旧密码
   * @param {string} newPassword - 新密码
   * @returns {Promise<object>}
   */
  async changePassword(oldPassword, newPassword) {
    const { ctx } = this;
    const { id } = ctx.state.user;

    const user = await ctx.model.User.findOne({
      where: { id, status: 1 },
      raw: true,
    });

    if (!user) {
      throw new Error('用户不存在或已被禁用');
    }

    if (!user.password) {
      throw new Error('该账号暂未设置登录密码，请先设置密码');
    }

    const isOldPasswordMatch = bcrypt.compareSync(oldPassword, user.password);
    if (!isOldPasswordMatch) {
      throw new Error('旧密码输入错误');
    }

    this._validatePassword(newPassword);

    if (bcrypt.compareSync(newPassword, user.password)) {
      throw new Error('新密码不能与旧密码相同');
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    await ctx.model.User.update(
      { password: hashedPassword },
      { where: { id: user.id } }
    );

    return null;
  }

  /**
   * 获取当前登录用户信息
   * @returns {Promise<object>}
   */
  async getUserInfo() {
    const { ctx } = this;
    const { id } = ctx.state.user;

    const user = await ctx.model.User.findOne({
      where: { id },
      raw: true,
    });

    if (!user) {
      throw new Error('用户不存在');
    }

    const membership = await ctx.service.api.membership.getMembershipByUser(user);
    return this._formatUserInfo(user, membership);
  }

  /**
   * 验证短信验证码（仅 network 模式）
   * @param {string} phone - 手机号
   * @param {string} code - 验证码
   * @returns {Promise<boolean>}
   * @private
   */
  async _verifySmsCode(phone, code) {
    return await this.ctx.service.api.sms.verifyCode(phone, code);
  }

  /**
   * 格式化用户信息（统一输出格式）
   * @param {object} user - 用户原始数据
   * @param {object} membership - 会员权益快照
   * @returns {object}
   * @private
   */
  _formatUserInfo(user, membership = null) {
    const userNo = user.user_no || this.ctx.helper.generateUserNo(user.id);
    const currentMembership = membership || this.ctx.service.api.membership.getFreeMembership();
    const isVip = !!currentMembership.is_vip;

    return {
      id: String(user.id),
      userNo,
      phone: user.phone || '',
      nickname: user.nickname || '',
      avatar: user.avatar || '',
      loginType: user.login_type || 'password',
      hasPassword: !!user.password,
      isPhoneBound: !!user.phone,
      isWechatBound: !!user.wechat_openid,
      isVip,
      vipTierCode: isVip ? (currentMembership.tier_code || '') : '',
      vipTierName: isVip ? (currentMembership.tier_name || '') : '',
      vipExpiresAt: user.vip_expires_at || null,
      membershipLevel: currentMembership.level || 'free',
      membershipLevelName: currentMembership.level_name || '免费会员',
      membershipLevelRank: Number(currentMembership.level_rank || 0),
      membershipCreateLimit: Number(currentMembership.create_limit || 0),
      membershipNovelWordLimit: Number(currentMembership.novel_word_limit || 0),
    };
  }

  /**
   * 校验登录密码格式
   * @param {string} password - 明文密码
   * @private
   */
  _validatePassword(password) {
    if (typeof password !== 'string') {
      throw new Error('密码格式不正确');
    }

    const trimmedPassword = password.trim();
    if (trimmedPassword.length < 6 || trimmedPassword.length > 20) {
      throw new Error('密码长度需为 6-20 位');
    }
  }
}

module.exports = UserAuthService;
