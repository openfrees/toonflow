'use strict';

/**
 * 全局错误处理中间件
 * 捕获所有异常，返回统一格式的错误响应
 */
module.exports = () => {
  return async function errorHandler(ctx, next) {
    try {
      await next();
    } catch (err) {
      /* 记录错误日志 */
      ctx.app.emit('error', err, ctx);

      const status = err.status || 500;
      const isProd = ctx.app.config.env === 'prod';

      /* 参数校验错误 */
      if (status === 422) {
        ctx.status = 422;
        ctx.body = {
          code: 422,
          message: '参数校验失败',
          data: err.errors || null,
        };
        return;
      }

      /* 401 未授权 */
      if (status === 401) {
        ctx.status = 401;
        ctx.body = {
          code: 401,
          message: err.message || '未登录或登录已过期',
          data: null,
        };
        return;
      }

      /* 403 无权限 */
      if (status === 403) {
        ctx.status = 403;
        ctx.body = {
          code: 403,
          message: err.message || '没有操作权限',
          data: null,
        };
        return;
      }

      /* 其他错误 */
      ctx.status = status;
      ctx.body = {
        code: status,
        message: isProd ? '服务器内部错误' : err.message,
        data: isProd ? null : { stack: err.stack },
      };
    }
  };
};
