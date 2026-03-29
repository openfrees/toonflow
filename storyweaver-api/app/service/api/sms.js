'use strict';

const Service = require('egg').Service;
const crypto = require('crypto');

/**
 * 短信验证码服务
 * 对接旦米科技 SMS API，处理验证码生成、发送、校验
 * 包含防刷机制：IP限流 + 每日限制 + 图片验证码
 */
class SmsService extends Service {

  /* ========================================
   * 公开方法
   * ======================================== */

  /**
   * 发送短信验证码
   * 流程：校验手机号 → 检查每日限制 → 检查IP限流 → 校验图片验证码 → 生成验证码 → 存Redis → 调旦米API
   * @param {string} phone - 手机号
   * @param {string} ip - 客户端IP
   * @param {string} [captchaId] - 图片验证码ID（需要图片验证码时传入）
   * @param {string} [captchaText] - 图片验证码文本
   * @returns {Promise<object>} 发送结果
   */
  async sendCode(phone, ip, captchaId, captchaText) {
    const { app, ctx } = this;
    const redis = app.redis;
    const config = app.config.sms;

    /* 1. 检查每日发送限制 */
    const dailyKey = `sms:daily:${phone}`;
    const dailyCount = await redis.get(dailyKey);
    if (dailyCount && Number(dailyCount) >= config.dailyMax) {
      throw new Error(`今日验证码发送次数已达上限（${config.dailyMax}次），请明天再试`);
    }

    /* 2. 检查IP限流，判断是否需要图片验证码 */
    const ipKey = `sms:ip:${ip}`;
    const ipCount = await redis.get(ipKey);
    const needCaptcha = ipCount && Number(ipCount) >= config.ipMaxInWindow;

    if (needCaptcha) {
      /* IP达到阈值，必须提供正确的图片验证码 */
      if (!captchaId || !captchaText) {
        /* 返回需要图片验证码的信号，同时生成一个图片验证码 */
        const captcha = await this.generateCaptcha();
        return {
          need_captcha: true,
          captcha_id: captcha.captcha_id,
          captcha_svg: captcha.captcha_svg,
          message: '请完成图片验证码后再获取短信验证码',
        };
      }

      /* 校验图片验证码 */
      const isValidCaptcha = await this._verifyCaptcha(captchaId, captchaText);
      if (!isValidCaptcha) {
        /* 图片验证码错误，重新生成一个返回 */
        const captcha = await this.generateCaptcha();
        return {
          need_captcha: true,
          captcha_id: captcha.captcha_id,
          captcha_svg: captcha.captcha_svg,
          message: '图片验证码错误，请重新输入',
        };
      }
    }

    /* 3. 检查是否在冷却时间内（同一手机号60秒内不能重复发送） */
    const cooldownKey = `sms:cooldown:${phone}`;
    const cooldownExists = await redis.exists(cooldownKey);
    if (cooldownExists) {
      const ttl = await redis.ttl(cooldownKey);
      throw new Error(`请${ttl}秒后再获取验证码`);
    }

    /* 4. 生成6位随机验证码 */
    const code = this._generateCode(config.codeLength);

    /* 5. 存入Redis（验证码 + 冷却标记） */
    const codeKey = `sms:code:${phone}`;
    await redis.set(codeKey, code, 'EX', config.codeExpire);
    await redis.set(cooldownKey, '1', 'EX', 60); // 60秒冷却

    /* 6. 递增IP计数器 */
    const newIpCount = await redis.incr(ipKey);
    if (newIpCount === 1) {
      await redis.expire(ipKey, config.ipWindowSeconds);
    }

    /* 7. 递增每日计数器（TTL到当天23:59:59） */
    const newDailyCount = await redis.incr(dailyKey);
    if (newDailyCount === 1) {
      const ttlSeconds = this._getSecondsUntilMidnight();
      await redis.expire(dailyKey, ttlSeconds);
    }

    /* 8. 调旦米API发送短信 */
    try {
      await this._callDanmiApi(phone, code);
      ctx.logger.info('[短信发送成功] phone=%s, code=%s', phone, code);
    } catch (err) {
      /* 发送失败，清除验证码和冷却标记，并回退计数器 */
      await redis.del(codeKey);
      await redis.del(cooldownKey);
      await redis.decr(ipKey);       // 回退IP计数器
      await redis.decr(dailyKey);    // 回退每日计数器
      ctx.logger.error('[短信发送失败] phone=%s, error=%s', phone, err.message);
      throw new Error('短信发送失败，请稍后重试');
    }

    return {
      need_captcha: false,
      message: '验证码已发送',
    };
  }

  /**
   * 验证短信验证码
   * 验证成功后立即删除Redis中的验证码（一次性使用）
   * @param {string} phone - 手机号
   * @param {string} code - 用户输入的验证码
   * @returns {Promise<boolean>} 是否验证通过
   */
  async verifyCode(phone, code) {
    const redis = this.app.redis;
    const codeKey = `sms:code:${phone}`;

    const storedCode = await redis.get(codeKey);
    if (!storedCode) {
      return false; // 验证码不存在或已过期
    }

    if (storedCode !== code) {
      return false; // 验证码不匹配
    }

    /* 验证成功，立即删除（防止重复使用） */
    await redis.del(codeKey);
    return true;
  }

  /**
   * 生成图片验证码
   * @returns {Promise<{captcha_id: string, captcha_svg: string}>}
   */
  async generateCaptcha() {
    const svgCaptcha = require('svg-captcha');
    const redis = this.app.redis;

    /* 生成SVG验证码 */
    const captcha = svgCaptcha.create({
      size: 4,            // 4位字符
      noise: 3,           // 干扰线
      color: true,        // 彩色
      background: '#f0f0f0',
      width: 120,
      height: 40,
      fontSize: 36,
      ignoreChars: '0oO1iIlL', // 排除易混淆字符
    });

    /* 生成唯一ID，存入Redis */
    const captchaId = crypto.randomUUID();
    const captchaKey = `captcha:${captchaId}`;
    await redis.set(captchaKey, captcha.text.toLowerCase(), 'EX', 300); // 5分钟过期

    return {
      captcha_id: captchaId,
      captcha_svg: captcha.data,
    };
  }

  /* ========================================
   * 私有方法
   * ======================================== */

  /**
   * 校验图片验证码
   * @param {string} captchaId - 验证码ID
   * @param {string} captchaText - 用户输入的文本
   * @returns {Promise<boolean>}
   * @private
   */
  async _verifyCaptcha(captchaId, captchaText) {
    const redis = this.app.redis;
    const captchaKey = `captcha:${captchaId}`;

    const stored = await redis.get(captchaKey);
    if (!stored) return false;

    /* 不区分大小写比较 */
    const isValid = stored === captchaText.toLowerCase();

    /* 无论对错都删除（防止暴力穷举） */
    await redis.del(captchaKey);

    return isValid;
  }

  /**
   * 调用旦米科技短信API发送验证码
   * @param {string} phone - 手机号
   * @param {string} code - 验证码
   * @private
   */
  async _callDanmiApi(phone, code) {
    const { ctx, app } = this;
    const config = app.config.sms;

    /* 生成毫秒时间戳（旦米V3文档要求数字类型） */
    const timestamp = Date.now();

    /* 生成签名：MD5(accountSid + authToken + timestamp)，小写hex */
    const sigStr = config.accountSid + config.authToken + timestamp;
    const sig = crypto.createHash('md5').update(sigStr).digest('hex');

    /* 构建请求体（严格按旦米V3文档格式） */
    const body = {
      accountSid: config.accountSid,
      to: [phone],                      // 文档要求数组格式
      templateid: config.templateId,
      paramsList: [code],               // 文档要求 paramsList 数组
      timestamp,                        // 毫秒时间戳（数字）
      sig,
      accountId: config.accountId,      // 文档要求传 accountId
    };
    console.log({ ...body, sig: sig.substring(0, 8) + '...' });
    

    ctx.logger.info('[旦米短信请求] url=%s, body=%j', config.apiUrl, { ...body, sig: sig.substring(0, 8) + '...' });

    /* 发送HTTP请求 */
    const result = await ctx.curl(config.apiUrl, {
      method: 'POST',
      contentType: 'json',
      dataType: 'json',
      data: body,
      timeout: 10000,
    });

    ctx.logger.info('[旦米短信响应] status=%d, data=%j', result.status, result.data);

    /* 检查响应 */
    if (result.status !== 200) {
      throw new Error(`短信API HTTP错误: ${result.status}`);
    }

    const respData = result.data;
    if (respData && respData.respCode !== '0000') {
      throw new Error(`短信发送失败: ${respData.respCode} - ${respData.respDesc || '未知错误'}`);
    }

    return respData;
  }

  /**
   * 生成N位随机数字验证码
   * @param {number} length - 验证码长度
   * @returns {string}
   * @private
   */
  _generateCode(length) {
    let code = '';
    for (let i = 0; i < length; i++) {
      code += Math.floor(Math.random() * 10).toString();
    }
    /* 确保首位不为0（美观一些） */
    if (code[0] === '0') {
      code = (Math.floor(Math.random() * 9) + 1).toString() + code.slice(1);
    }
    return code;
  }

  /**
   * 格式化时间戳为 yyyyMMddHHmmss
   * @param {Date} date
   * @returns {string}
   * @private
   */
  _formatTimestamp(date) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  }

  /**
   * 计算距离当天23:59:59的剩余秒数
   * 用于每日限制的Redis TTL
   * @returns {number}
   * @private
   */
  _getSecondsUntilMidnight() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(23, 59, 59, 999);
    return Math.max(1, Math.ceil((midnight.getTime() - now.getTime()) / 1000));
  }
}

module.exports = SmsService;
