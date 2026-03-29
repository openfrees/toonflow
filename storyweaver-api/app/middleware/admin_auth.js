'use strict';

/**
 * 管理后台鉴权中间件
 * 校验JWT Token，提取管理员信息
 */
module.exports = () => {
  return async function adminAuth(ctx, next) {
    const token = ctx.get('Authorization')?.replace('Bearer ', '');

    /* localhost 开源模式：无 token 时自动以默认管理员身份通过 */
    if (!token && ctx.app.config.deployMode === 'localhost') {
      ctx.state.adminUser = { id: 1, username: 'admin', nickname: '管理员', role: 'admin' };
      await next();
      return;
    }

    if (!token) {
      ctx.status = 401;
      ctx.body = ctx.helper.fail('请先登录', 401);
      return;
    }

    /* JWT验证 —— 仅捕获鉴权相关的错误 */
    let decoded;
    try {
      decoded = ctx.app.jwt.verify(token, ctx.app.config.jwt.secret);
    } catch (err) {
      ctx.status = 401;
      ctx.body = ctx.helper.fail('登录已过期，请重新登录', 401);
      return;
    }

    /* 查询管理员是否存在且正常 */
    const adminUser = await ctx.model.AdminUser.findOne({
      where: { id: decoded.id, status: 1 },
      attributes: ['id', 'username', 'nickname', 'role'],
      raw: true,
    });

    if (!adminUser) {
      ctx.status = 401;
      ctx.body = ctx.helper.fail('账号不存在或已被禁用', 401);
      return;
    }

    /* 挂载管理员信息到ctx */
    ctx.state.adminUser = adminUser;

    /* 鉴权通过，执行后续中间件/控制器 —— 不要用try包裹，让业务错误正常冒泡给errorHandler */
    await next();
  };
};
