'use strict';

/**
 * 通用限流中间件
 * 基于 Redis（network）或内存缓存（localhost）计数器
 * 按用户ID（需登录）或IP（未登录）限流
 *
 * 使用方式：
 *   const rateLimit = middleware.rateLimit({ max: 5, window: 60, prefix: 'redeem' });
 *   router.post('/api/redeem/use', userAuth, rateLimit, controller.api.redeem.use);
 *
 * @param {Object} options 配置项
 * @param {number} options.max - 窗口期内最大请求次数（默认5）
 * @param {number} options.window - 窗口期秒数（默认60）
 * @param {string} options.prefix - Redis key前缀（默认'rate_limit'）
 */
module.exports = (options = {}) => {
  const max = options.max || 5;
  const window = options.window || 60;
  const prefix = options.prefix || 'rate_limit';

  return async function rateLimit(ctx, next) {
    const identity = ctx.state?.user?.id || ctx.ip;
    const key = `${prefix}:${identity}`;

    /* 兼容 Redis（network）和 MemoryCache（localhost），统一通过 app.redis 调用 */
    const cache = ctx.app.redis;
    if (!cache) {
      /* 无缓存可用时直接放行（不应出现，但防御性处理） */
      await next();
      return;
    }

    const count = await cache.incr(key);

    if (count === 1) {
      await cache.expire(key, window);
    }

    if (count > max) {
      const ttl = await cache.ttl(key);
      ctx.body = ctx.helper.fail(`操作太频繁，请${ttl}秒后再试`, 429);
      return;
    }

    await next();
  };
};
