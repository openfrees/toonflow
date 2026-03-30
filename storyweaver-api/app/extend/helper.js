'use strict';

const Hashids = require('hashids/cjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * 框架扩展 - Helper 工具方法
 * 统一响应格式：{ code, message, data }
 */

/* Hashids 单例缓存 */
let _hashids = null;

module.exports = {

  /**
   * 获取 Hashids 实例（懒加载单例）
   * @returns {Hashids}
   */
  _getHashids() {
    if (!_hashids) {
      const { salt, minLength } = this.app.config.hashids;
      _hashids = new Hashids(salt, minLength);
    }
    return _hashids;
  },

  /**
   * 编码ID（数据库自增ID → 混淆字符串）
   * @param {number|string} id - 原始ID
   * @returns {string} 混淆后的ID
   */
  encodeId(id) {
    if (id === null || id === undefined) return null;
    return this._getHashids().encode(Number(id));
  },

  /**
   * 解码ID（混淆字符串 → 数据库自增ID）
   * @param {string} hash - 混淆后的ID
   * @returns {number|null} 原始ID，解码失败返回null
   */
  decodeId(hash) {
    if (!hash) return null;
    const ids = this._getHashids().decode(hash);
    return ids.length > 0 ? ids[0] : null;
  },

  /**
   * 生成用户展示编号（模乘逆元混淆，纯数字，7位）
   * 将自增ID映射为看似随机的7位数字，无碰撞，不可逆推
   * @param {number} id - 用户自增ID
   * @returns {string} 7位数字编号
   */
  generateUserNo(id) {
    const PRIME = 9999991;   // 7位质数，定义映射空间
    const MULT = 6592781;    // 与PRIME互质的乘数（混淆因子）
    const XOR_KEY = 0x5A3C9; // 异或密钥，增加混淆度
    /* 模乘 + 异或双重混淆 */
    let encoded = (Number(id) * MULT) % PRIME;
    encoded = encoded ^ XOR_KEY;
    /* 确保结果为正数，补零到7位 */
    if (encoded < 0) encoded += PRIME;
    return String(encoded).padStart(7, '0');
  },

  /**
   * AES-256-GCM 加密（用于加密用户的API Key等敏感信息）
   * @param {string} plaintext - 明文
   * @returns {string} 加密后的 hex 字符串（iv:authTag:ciphertext）
   */
  encryptAES(plaintext) {
    const secret = this.app.config.encryption.secret;
    const key = crypto.createHash('sha256').update(secret).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  },

  /**
   * AES-256-GCM 解密
   * @param {string} ciphertext - 加密后的字符串（iv:authTag:encrypted）
   * @returns {string} 解密后的明文
   */
  decryptAES(ciphertext) {
    const secret = this.app.config.encryption.secret;
    const key = crypto.createHash('sha256').update(secret).digest();
    const parts = ciphertext.split(':');
    if (parts.length !== 3) throw new Error('无效的加密数据格式');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  },

  /**
   * API Key 脱敏显示（只显示前4后4位）
   * @param {string} apiKey - 原始API Key
   * @returns {string} 脱敏后的字符串
   */
  maskApiKey(apiKey) {
    if (!apiKey || apiKey.length <= 8) return '****';
    return apiKey.slice(0, 4) + '****' + apiKey.slice(-4);
  },

  /**
   * 成功响应
   * @param {*} data - 响应数据
   * @param {string} message - 成功消息
   * @returns {{ code: number, message: string, data: * }}
   */
  success(data = null, message = 'success') {
    return {
      code: 200,
      message,
      data,
    };
  },

  /**
   * 失败响应
   * @param {string} message - 错误消息
   * @param {number} code - 错误码
   * @returns {{ code: number, message: string, data: null }}
   */
  fail(message = '操作失败', code = 400) {
    return {
      code,
      message,
      data: null,
    };
  },

  /**
   * 删除本地上传的图片文件（安全清理，仅处理 /public/uploads/ 下的相对路径）
   * @param {string} avatarPath - 图片相对路径，如 /public/uploads/characters/20260312/xxx.png
   */
  removeUploadedFile(avatarPath) {
    if (!avatarPath || !avatarPath.startsWith('/public/uploads/')) return;
    try {
      const fullPath = path.join(this.app.baseDir, 'app', avatarPath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (err) {
      this.ctx.logger.warn('[helper.removeUploadedFile] 删除上传文件失败: %s, message=%s', avatarPath, err.message);
    }
  },

  /**
   * 兼容 MySQL 5.6 下用 TEXT 存储的 JSON 字段
   * @param {*} value - 原始值，可能是对象/数组/JSON字符串/空值
   * @param {*} defaultValue - 解析失败时的兜底值
   * @returns {*}
   */
  parseJsonText(value, defaultValue = null) {
    if (value === null || value === undefined || value === '') return defaultValue;
    if (typeof value === 'object') return value;
    if (typeof value !== 'string') return defaultValue;
    try {
      return JSON.parse(value);
    } catch (_) {
      return defaultValue;
    }
  },

  /**
   * 将 TEXT JSON 字段安全解析为数组
   * @param {*} value - 原始值
   * @param {Array} defaultValue - 默认数组
   * @returns {Array}
   */
  parseJsonArray(value, defaultValue = []) {
    const parsed = this.parseJsonText(value, defaultValue);
    return Array.isArray(parsed) ? parsed : defaultValue;
  },

  /**
   * 将 TEXT JSON 字段安全解析为对象
   * @param {*} value - 原始值
   * @param {object} defaultValue - 默认对象
   * @returns {object}
   */
  parseJsonObject(value, defaultValue = {}) {
    const parsed = this.parseJsonText(value, defaultValue);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
    return defaultValue;
  },

  /**
   * 分页响应
   * @param {{ rows: Array, count: number }} result - Sequelize 分页查询结果
   * @param {number} page - 当前页码
   * @param {number} pageSize - 每页条数
   * @returns {{ code: number, message: string, data: { list: Array, pagination: object } }}
   */
  paginate(result, page, pageSize) {
    return {
      code: 200,
      message: 'success',
      data: {
        list: result.rows,
        pagination: {
          total: result.count,
          page: Number(page),
          pageSize: Number(pageSize),
          totalPages: Math.ceil(result.count / pageSize),
        },
      },
    };
  },
};
