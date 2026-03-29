'use strict';

const Controller = require('egg').Controller;

/**
 * C端 - 兑换码控制器
 * 用户使用兑换码兑换积分
 */
class RedeemController extends Controller {

  /**
   * POST /api/redeem/use - 使用兑换码
   */
  async use() {
    const { ctx } = this;

    ctx.validate({
      code: { type: 'string', required: true, message: '请输入兑换码' },
    });

    try {
      const { id } = ctx.state.user;
      const { code } = ctx.request.body;
      const result = await ctx.service.api.redeem.useCode(id, code);
      ctx.body = ctx.helper.success(result, '兑换成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }
}

module.exports = RedeemController;
