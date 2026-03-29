'use strict';

const Controller = require('egg').Controller;

/**
 * C端用户资料控制器
 * 处理用户资料更新、头像上传等接口
 */
class UserController extends Controller {

  /**
   * PUT /api/user/profile - 更新用户资料
   */
  async updateProfile() {
    const { ctx } = this;

    ctx.validate({
      nickname: { type: 'string', required: false, max: 20 },
    });

    const { nickname } = ctx.request.body;

    try {
      const result = await ctx.service.api.user.updateProfile(
        ctx.state.user.id,
        { nickname }
      );
      ctx.body = ctx.helper.success(result, '资料更新成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  /**
   * POST /api/user/avatar - 上传头像
   */
  async uploadAvatar() {
    const { ctx } = this;

    try {
      /* 获取上传的文件 */
      const file = ctx.request.files[0];
      if (!file) {
        ctx.body = ctx.helper.fail('请选择要上传的图片');
        return;
      }

      const result = await ctx.service.api.user.uploadAvatar(
        ctx.state.user.id,
        file
      );
      ctx.body = ctx.helper.success(result, '头像更新成功');
    } catch (err) {
      /* 出错时也要清理临时文件 */
      await ctx.cleanupRequestFiles();
      ctx.body = ctx.helper.fail(err.message);
    }
  }
  /**
   * GET /api/user/vip-info - 获取用户VIP会员信息
   */
  async vipInfo() {
    const { ctx } = this;

    try {
      const result = await ctx.service.api.user.getVipInfo(ctx.state.user.id);
      ctx.body = ctx.helper.success(result);
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }
}

module.exports = UserController;
