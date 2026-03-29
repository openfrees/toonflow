'use strict';

/**
 * C端用户鉴权中间件
 * 校验JWT Token，提取用户信息挂载到 ctx.state.user
 */
module.exports = () => {
  return async function userAuth(ctx, next) {
    const token = ctx.get('Authorization')?.replace('Bearer ', '');

    if (!token) {
      ctx.status = 401;
      ctx.body = ctx.helper.fail('请先登录', 401);
      return;
    }

    /* JWT验证和用户查询 —— 仅捕获鉴权相关的错误 */
    let decoded;
    try {
      decoded = ctx.app.jwt.verify(token, ctx.app.config.jwt.secret);
    } catch (err) {
      ctx.status = 401;
      ctx.body = ctx.helper.fail('登录已过期，请重新登录', 401);
      return;
    }

    /* 确认是C端用户Token */
    if (decoded.type !== 'user') {
      ctx.status = 401;
      ctx.body = ctx.helper.fail('无效的用户凭证', 401);
      return;
    }

    /* 查询用户是否存在且正常 */
    const user = await ctx.model.User.findOne({
      where: { id: decoded.id, status: 1 },
      attributes: ['id', 'phone', 'nickname', 'avatar', 'vip_tier_id', 'vip_expires_at'],
      raw: true,
    });

    if (!user) {
      ctx.status = 401;
      ctx.body = ctx.helper.fail('账号不存在或已被禁用', 401);
      return;
    }

    /* 挂载用户信息到ctx */
    ctx.state.user = user;

    /* 鉴权通过，执行后续中间件/控制器 —— 不要用try包裹，让业务错误正常冒泡给errorHandler */
    await next();
  };
};
