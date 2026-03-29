'use strict';

/**
 * 内存缓存 - 替代 Redis（localhost 模式专用）
 * 支持 TTL 自动过期，API 与 ioredis 保持一致
 * 适用于单进程场景（Electron / Docker 单实例）
 */
class MemoryCache {
  constructor() {
    this._store = new Map();
    /* 每 30 秒清理过期 key */
    this._gcTimer = setInterval(() => this._gc(), 30000);
  }

  async get(key) {
    const item = this._store.get(key);
    if (!item) return null;
    if (item.expireAt && Date.now() > item.expireAt) {
      this._store.delete(key);
      return null;
    }
    return item.value;
  }

  /**
   * set 兼容 ioredis 的多种调用方式：
   *   set(key, value)
   *   set(key, value, 'EX', seconds)
   */
  async set(key, value, ...args) {
    let ttlMs = 0;
    if (args.length >= 2 && String(args[0]).toUpperCase() === 'EX') {
      ttlMs = Number(args[1]) * 1000;
    }
    this._store.set(key, {
      value: String(value),
      expireAt: ttlMs > 0 ? Date.now() + ttlMs : 0,
    });
    return 'OK';
  }

  async del(key) {
    const existed = this._store.has(key);
    this._store.delete(key);
    return existed ? 1 : 0;
  }

  async exists(key) {
    const item = this._store.get(key);
    if (!item) return 0;
    if (item.expireAt && Date.now() > item.expireAt) {
      this._store.delete(key);
      return 0;
    }
    return 1;
  }

  async incr(key) {
    const current = await this.get(key);
    const newVal = (parseInt(current, 10) || 0) + 1;
    const item = this._store.get(key);
    if (item) {
      item.value = String(newVal);
    } else {
      this._store.set(key, { value: String(newVal), expireAt: 0 });
    }
    return newVal;
  }

  async decr(key) {
    const current = await this.get(key);
    const newVal = (parseInt(current, 10) || 0) - 1;
    const item = this._store.get(key);
    if (item) {
      item.value = String(newVal);
    } else {
      this._store.set(key, { value: String(newVal), expireAt: 0 });
    }
    return newVal;
  }

  async expire(key, seconds) {
    const item = this._store.get(key);
    if (!item) return 0;
    item.expireAt = Date.now() + seconds * 1000;
    return 1;
  }

  async ttl(key) {
    const item = this._store.get(key);
    if (!item) return -2;
    if (!item.expireAt) return -1;
    const remaining = Math.ceil((item.expireAt - Date.now()) / 1000);
    if (remaining <= 0) {
      this._store.delete(key);
      return -2;
    }
    return remaining;
  }

  _gc() {
    const now = Date.now();
    for (const [key, item] of this._store) {
      if (item.expireAt && now > item.expireAt) {
        this._store.delete(key);
      }
    }
  }

  destroy() {
    if (this._gcTimer) {
      clearInterval(this._gcTimer);
      this._gcTimer = null;
    }
    this._store.clear();
  }
}

module.exports = MemoryCache;
