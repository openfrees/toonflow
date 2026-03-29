'use strict';

const Controller = require('egg').Controller;

/**
 * 反馈控制器
 * 处理用户反馈提交
 */
class FeedbackController extends Controller {

  /**
   * POST /api/feedback/submit - 提交反馈
   */
  async submit() {
    const { ctx } = this;

    /* 参数校验（基础类型校验） */
    ctx.validate({
      type: { type: 'string', required: true },
      module: { type: 'string', required: true },
      content: { type: 'string', required: true, min: 6, max: 500 },
      images: { type: 'array', required: false, itemType: 'string' },
      contact: { type: 'string', required: false, max: 100 },
    });

    const { type, module, content, images, contact } = ctx.request.body;

    /* 枚举值校验 */
    const allowedTypes = ['suggestion', 'bug'];
    if (!allowedTypes.includes(type)) {
      ctx.body = ctx.helper.fail('反馈类型必须是 suggestion 或 bug');
      return;
    }

    const allowedModules = [
      'write_script',
      'novel_to_script',
      'model_settings',
      'other',
      'buy_vip',
      'review_script',
    ];
    if (!allowedModules.includes(module)) {
      ctx.body = ctx.helper.fail('所属功能不在允许范围内');
      return;
    }

    /* 图片数量校验 */
    if (images && images.length > 3) {
      ctx.body = ctx.helper.fail('截图最多3张');
      return;
    }

    /* 验证联系方式格式（如果填写了） */
    if (contact) {
      const phonePattern = /^1[3-9]\d{9}$/;
      const emailPattern = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
      if (!phonePattern.test(contact) && !emailPattern.test(contact)) {
        ctx.body = ctx.helper.fail('联系方式格式不正确，请输入手机号或邮箱');
        return;
      }
    }

    try {
      /* 调用Service层提交反馈 */
      await ctx.service.api.feedback.submit({
        type,
        module,
        content,
        images,
        contact,
      });

      ctx.body = ctx.helper.success(null, '提交成功，感谢您的反馈！');

    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }
}

module.exports = FeedbackController;
