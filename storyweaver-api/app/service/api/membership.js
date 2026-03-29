'use strict';

const { Service } = require('egg');

const FREE_MEMBERSHIP = {
  level: 'free',
  level_name: '免费会员',
  level_rank: 0,
  is_vip: false,
  create_limit: 4,
  novel_word_limit: 500000,
  novel_word_limit_text: '50万字',
};

const BASIC_TIER_CODES = new Set(['gold']);
const ADVANCED_TIER_CODES = new Set(['blackgold']);
const PUBLIC_PURCHASE_TIER_CODES = new Set(['gold', 'blackgold']);

class MembershipService extends Service {
  resolveTierLimit(rawValue, fallbackValue) {
    const value = Number(rawValue);
    return Number.isFinite(value) ? value : fallbackValue;
  }

  getFreeMembership() {
    return { ...FREE_MEMBERSHIP };
  }

  isPublicPurchaseTier(tierCode) {
    return PUBLIC_PURCHASE_TIER_CODES.has(String(tierCode || '').trim());
  }

  getLevelByTierCode(tierCode) {
    const code = String(tierCode || '').trim();
    if (ADVANCED_TIER_CODES.has(code)) {
      return { level: 'advanced', level_name: '高级会员', level_rank: 2 };
    }
    if (BASIC_TIER_CODES.has(code)) {
      return { level: 'basic', level_name: '基础会员', level_rank: 1 };
    }
    return { ...FREE_MEMBERSHIP };
  }

  buildTierFeatures(tier = {}, membership = null) {
    const rights = membership || this.buildMembershipFromTier(tier);
    const features = this.getDefaultFeatureList(rights);

    return features.map(item => [
      '<li>',
      '<svg class="icon-check" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg>',
      item,
      '</li>',
    ].join('')).join('');
  }

  getDefaultFeatureList(rights = {}) {
    const createLimit = Number(rights.create_limit || 0);
    const wordLimitText = rights.novel_word_limit_text || this.formatWordLimitText(rights.novel_word_limit);

    if (rights.level === 'advanced') {
      return [
        `最多创建<strong>${createLimit}</strong>个剧本（写剧本/小说转剧本合计）`,
        `小说转剧本最多保存<strong>${wordLimitText}</strong>`,
        '超出字数上限时可提示减少章节后继续保存',
      ];
    }

    if (rights.level === 'basic') {
      return [
        `最多创建<strong>${createLimit}</strong>个剧本（写剧本/小说转剧本合计）`,
        `小说转剧本最多保存<strong>${wordLimitText}</strong>`,
        '超出字数或数量上限时可升级到高级会员',
      ];
    }

    return [
      `最多创建<strong>${createLimit}</strong>个剧本（写剧本/小说转剧本合计）`,
      `小说转剧本最多保存<strong>${wordLimitText}</strong>`,
      '支持基础创作能力，超限后可购买会员继续',
    ];
  }

  buildMembershipFromTier(tier = {}) {
    const levelInfo = this.getLevelByTierCode(tier.tier_code);
    const createLimit = this.resolveTierLimit(
      tier.script_create_limit,
      levelInfo.level === 'advanced' ? 100 : 30
    );
    const novelWordLimit = this.resolveTierLimit(
      tier.novel_word_limit,
      levelInfo.level === 'advanced' ? 2000000 : 1000000
    );

    return {
      is_vip: true,
      tier_id: tier.id || null,
      tier_code: tier.tier_code || '',
      tier_name: tier.name || '',
      level: levelInfo.level,
      level_name: levelInfo.level_name,
      level_rank: levelInfo.level_rank,
      create_limit: createLimit,
      novel_word_limit: novelWordLimit,
      novel_word_limit_text: this.formatWordLimitText(novelWordLimit),
      script_create_limit: createLimit,
    };
  }

  formatWordLimitText(limit) {
    const value = Number(limit || 0);
    if (!value) return '不限字数';
    if (value % 10000 === 0) return `${value / 10000}万字`;
    return `${value.toLocaleString()}字`;
  }

  async getMembershipByUser(user = null, userId = null) {
    const { ctx } = this;
    let currentUser = user;

    if (!currentUser && userId) {
      currentUser = await ctx.model.User.findOne({
        where: { id: userId },
        attributes: ['id', 'vip_tier_id', 'vip_expires_at'],
        raw: true,
      });
    }

    if (!currentUser) {
      return this.getFreeMembership();
    }

    const isVipActive = currentUser.vip_tier_id
      && currentUser.vip_expires_at
      && new Date(currentUser.vip_expires_at) > new Date();

    if (!isVipActive) {
      return this.getFreeMembership();
    }

    const tier = await ctx.model.VipTier.findOne({
      where: { id: currentUser.vip_tier_id },
      raw: true,
    });

    if (!tier) {
      return this.getFreeMembership();
    }

    return this.buildMembershipFromTier(tier);
  }

  async getMembershipByUserId(userId) {
    return await this.getMembershipByUser(null, userId);
  }

  getCreationLimitMessage(membership, usedCount, nextCount) {
    const nextValue = Number(nextCount || usedCount + 1);
    const createLimit = Number(membership?.create_limit || 0);
    if (membership.level === 'basic') {
      return `基础会员最多创建${createLimit}个剧本，您当前将创建第${nextValue}个，请升级到高级会员后继续。`;
    }
    if (membership.level === 'advanced') {
      return `高级会员最多创建${createLimit}个剧本，您当前将创建第${nextValue}个，请先整理或删除已有项目后再继续。`;
    }
    return `免费会员最多创建4个剧本，您当前将创建第${nextValue}个，请购买会员后继续。`;
  }

  getNovelLimitMessage(membership, totalWords) {
    const wordText = Number(totalWords || 0).toLocaleString();
    const novelWordLimitText = this.formatWordLimitText(membership?.novel_word_limit);
    if (membership.level === 'basic') {
      return `基础会员最多支持${novelWordLimitText}小说转剧本保存，当前内容约${wordText}字，请升级到高级会员后继续。`;
    }
    if (membership.level === 'advanced') {
      return `高级会员最多支持${novelWordLimitText}小说转剧本保存，当前内容约${wordText}字，请减少章节后再保存。`;
    }
    return `免费会员最多支持50万字小说转剧本保存，当前内容约${wordText}字，请购买基础会员后继续。`;
  }

  async ensureCreationAllowed(userId) {
    const { ctx, app } = this;
    if (app.config.deployMode === 'localhost') {
      return {
        membership: this.getFreeMembership(),
        used_count: 0,
        next_count: 1,
      };
    }

    const membership = await this.getMembershipByUserId(userId);
    const [scriptCount, novelCount] = await Promise.all([
      ctx.model.Script.count({ where: { user_id: userId } }),
      ctx.model.NovelProject.count({ where: { user_id: userId } }),
    ]);
    const usedCount = Number(scriptCount || 0) + Number(novelCount || 0);
    const nextCount = usedCount + 1;

    if (membership.create_limit > 0 && usedCount >= membership.create_limit) {
      ctx.throw(403, this.getCreationLimitMessage(membership, usedCount, nextCount));
    }

    return {
      membership,
      used_count: usedCount,
      next_count: nextCount,
    };
  }

  async ensureNovelSaveAllowed(userId, chapters = []) {
    const { app } = this;
    const totalWords = (Array.isArray(chapters) ? chapters : [])
      .reduce((sum, chapter) => sum + String(chapter?.content || '').length, 0);

    if (app.config.deployMode === 'localhost') {
      return {
        membership: this.getFreeMembership(),
        total_words: totalWords,
      };
    }

    const { membership } = await this.ensureCreationAllowed(userId);
    if (membership.novel_word_limit > 0 && totalWords > membership.novel_word_limit) {
      throw new Error(this.getNovelLimitMessage(membership, totalWords));
    }

    return {
      membership,
      total_words: totalWords,
    };
  }
}

module.exports = MembershipService;
