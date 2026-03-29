'use strict';

const Controller = require('egg').Controller;

class VipController extends Controller {
  async getConfig() {
    const { ctx } = this;
    try {
      const data = await ctx.service.api.vip.getConfig();
      ctx.body = ctx.helper.success(data);
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }
}

module.exports = VipController;
