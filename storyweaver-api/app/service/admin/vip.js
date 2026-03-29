'use strict';

const Service = require('egg').Service;

class VipService extends Service {
  isSupportedTierCode(tierCode) {
    return ['gold', 'blackgold'].includes(String(tierCode || ''));
  }

  // ================= Tiers =================
  async getTiers() {
    const list = await this.ctx.model.VipTier.findAll({
      order: [['sort_order', 'ASC']],
      raw: true,
    });
    return list
      .filter(item => this.isSupportedTierCode(item.tier_code))
      .map(item => ({ ...item, id: this.ctx.helper.encodeId(item.id) }));
  }

  async createTier(data) {
    const tier = await this.ctx.model.VipTier.create(data);
    return { id: this.ctx.helper.encodeId(tier.id) };
  }

  async updateTier(id, data) {
    const tier = await this.ctx.model.VipTier.findByPk(id);
    if (!tier) throw new Error('等级不存在');
    await this.ctx.model.VipTier.update(data, { where: { id } });
  }

  async deleteTier(id) {
    const tier = await this.ctx.model.VipTier.findByPk(id);
    if (!tier) throw new Error('等级不存在');
    await this.ctx.model.VipTier.destroy({ where: { id } });
  }

  // ================= Plans =================
  async getPlans() {
    const list = await this.ctx.model.VipPlan.findAll({
      order: [['sort_order', 'ASC']],
      raw: true,
    });
    return list.map(item => ({ ...item, id: this.ctx.helper.encodeId(item.id) }));
  }

  async createPlan(data) {
    const plan = await this.ctx.model.VipPlan.create(data);
    return { id: this.ctx.helper.encodeId(plan.id) };
  }

  async updatePlan(id, data) {
    const plan = await this.ctx.model.VipPlan.findByPk(id);
    if (!plan) throw new Error('套餐不存在');
    await this.ctx.model.VipPlan.update(data, { where: { id } });
  }

  async deletePlan(id) {
    const plan = await this.ctx.model.VipPlan.findByPk(id);
    if (!plan) throw new Error('套餐不存在');
    await this.ctx.model.VipPlan.destroy({ where: { id } });
  }

  // ================= Prices =================
  async getPrices() {
    const list = await this.ctx.model.VipPrice.findAll({
      include: [
        { model: this.ctx.model.VipTier, as: 'tier', attributes: ['id', 'name', 'tier_code'] },
        { model: this.ctx.model.VipPlan, as: 'plan', attributes: ['id', 'name', 'plan_code'] }
      ],
      raw: true,
      nest: true
    });
    return list
      .filter(item => this.isSupportedTierCode(item.tier && item.tier.tier_code))
      .map(item => ({
        ...item,
        id: this.ctx.helper.encodeId(item.id),
        vip_tier_id: this.ctx.helper.encodeId(item.vip_tier_id),
        vip_plan_id: this.ctx.helper.encodeId(item.vip_plan_id),
        tier: { ...item.tier, id: this.ctx.helper.encodeId(item.tier.id) },
        plan: { ...item.plan, id: this.ctx.helper.encodeId(item.plan.id) }
      }));
  }

  async setPrice(data) {
    const { vip_tier_id, vip_plan_id, current_price, original_price, month_price } = data;
    
    // Check if exists
    let price = await this.ctx.model.VipPrice.findOne({
      where: { vip_tier_id, vip_plan_id }
    });

    if (price) {
      // Update
      await this.ctx.model.VipPrice.update({
        current_price, original_price, month_price
      }, { where: { id: price.id } });
    } else {
      // Create
      price = await this.ctx.model.VipPrice.create({
        vip_tier_id, vip_plan_id, current_price, original_price, month_price
      });
    }
  }

}

module.exports = VipService;
