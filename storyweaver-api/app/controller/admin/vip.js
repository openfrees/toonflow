'use strict';

const Controller = require('egg').Controller;

class VipController extends Controller {
  // ================= Tiers =================
  async getTiers() {
    const { ctx } = this;
    try {
      const result = await ctx.service.admin.vip.getTiers();
      ctx.body = ctx.helper.success(result);
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  async createTier() {
    const { ctx } = this;
    ctx.validate({
      tier_code: { type: 'string', required: true },
      name: { type: 'string', required: true },
    });
    try {
      const result = await ctx.service.admin.vip.createTier(ctx.request.body);
      ctx.body = ctx.helper.success(result, '创建成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  async updateTier() {
    const { ctx } = this;
    try {
      const id = ctx.helper.decodeId(ctx.params.id);
      const { id: _id, createdAt, updatedAt, created_at, updated_at, ...data } = ctx.request.body;
      await ctx.service.admin.vip.updateTier(id, data);
      ctx.body = ctx.helper.success(null, '更新成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  async deleteTier() {
    const { ctx } = this;
    try {
      const id = ctx.helper.decodeId(ctx.params.id);
      await ctx.service.admin.vip.deleteTier(id);
      ctx.body = ctx.helper.success(null, '删除成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  // ================= Plans =================
  async getPlans() {
    const { ctx } = this;
    try {
      const result = await ctx.service.admin.vip.getPlans();
      ctx.body = ctx.helper.success(result);
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  async createPlan() {
    const { ctx } = this;
    ctx.validate({
      plan_code: { type: 'string', required: true },
      name: { type: 'string', required: true },
    });
    try {
      const result = await ctx.service.admin.vip.createPlan(ctx.request.body);
      ctx.body = ctx.helper.success(result, '创建成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  async updatePlan() {
    const { ctx } = this;
    try {
      const id = ctx.helper.decodeId(ctx.params.id);
      const { id: _id, createdAt, updatedAt, created_at, updated_at, ...data } = ctx.request.body;
      await ctx.service.admin.vip.updatePlan(id, data);
      ctx.body = ctx.helper.success(null, '更新成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  async deletePlan() {
    const { ctx } = this;
    try {
      const id = ctx.helper.decodeId(ctx.params.id);
      await ctx.service.admin.vip.deletePlan(id);
      ctx.body = ctx.helper.success(null, '删除成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  // ================= Prices =================
  async getPrices() {
    const { ctx } = this;
    try {
      const result = await ctx.service.admin.vip.getPrices();
      ctx.body = ctx.helper.success(result);
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

  async setPrice() {
    const { ctx } = this;
    ctx.validate({
      vip_tier_id: { type: 'string', required: true },
      vip_plan_id: { type: 'string', required: true },
      current_price: { type: 'number', required: true },
      original_price: { type: 'number', required: true },
      month_price: { type: 'number', required: true },
    });
    try {
      const data = { ...ctx.request.body };
      data.vip_tier_id = ctx.helper.decodeId(data.vip_tier_id);
      data.vip_plan_id = ctx.helper.decodeId(data.vip_plan_id);
      await ctx.service.admin.vip.setPrice(data);
      ctx.body = ctx.helper.success(null, '设置成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }

}

module.exports = VipController;
