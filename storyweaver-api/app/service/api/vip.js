'use strict';

const Service = require('egg').Service;

class VipService extends Service {
  async getConfig() {
    const { ctx } = this;
    const membershipService = ctx.service.api.membership;

    // 1. 获取所有可用套餐（周期）
    const plansRaw = await ctx.model.VipPlan.findAll({
      order: [['sort_order', 'ASC']],
      raw: true
    });

    const tabs = plansRaw.map(p => {
      const tab = { label: p.name, value: p.plan_code };
      if (p.badge) tab.tag = p.badge;
      return tab;
    });

    // 2. 获取所有会员等级
    const tiersRaw = await ctx.model.VipTier.findAll({
      order: [['sort_order', 'ASC']],
      raw: true
    });

    // 3. 获取所有价格矩阵
    const pricesRaw = await ctx.model.VipPrice.findAll({
      raw: true
    });

    const freeTier = {
      id: 'free',
      tier_code: 'free',
      name: '免费会员',
      badge: '当前默认',
      desc_text: '体验核心创作能力',
      script_create_limit: 4,
      novel_word_limit: 500000,
      sort_order: 0,
      is_virtual: true,
      prices: {},
      features_html: membershipService.buildTierFeatures({}, membershipService.getFreeMembership()),
    };

    // 组装前台可售 tiers 数据结构
    const tiers = tiersRaw
      .filter(tier => membershipService.isPublicPurchaseTier(tier.tier_code))
      .map(tier => {
        const membership = membershipService.buildMembershipFromTier(tier);
        const tierObj = {
          id: ctx.helper.encodeId(tier.id),
          tier_code: tier.tier_code,
          name: membership.level_name,
          badge: tier.badge,
          desc_text: tier.desc_text,
          script_create_limit: membership.create_limit,
          novel_word_limit: membership.novel_word_limit,
          membership_level: membership.level,
          membership_level_rank: membership.level_rank,
          features_html: membershipService.buildTierFeatures(tier, membership),
          sort_order: membership.level_rank,
          prices: {}
        };

      // 挂载对应的各周期价格
        plansRaw.forEach(plan => {
          const pInfo = pricesRaw.find(p => p.vip_tier_id === tier.id && p.vip_plan_id === plan.id);
          if (pInfo) {
            tierObj.prices[plan.plan_code] = {
              current: pInfo.current_price,
              original: pInfo.original_price,
              monthEquivalent: pInfo.month_price
            };
          } else {
            tierObj.prices[plan.plan_code] = { current: '0.00', original: '0.00', monthEquivalent: '0.00' };
          }
        });

        return tierObj;
      });

    return {
      tabs,
      freeTier,
      tiers,
    };
  }
}

module.exports = VipService;
