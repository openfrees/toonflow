/**
 * 知剧AI - 全站SEO集中配置
 * 所有页面的 TDK 在此统一管理，修改后运行 npm run generate:prod 重新打包即可生效
 */

export interface PageSeo {
  title: string
  description: string
  keywords?: string
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
}

/** 站点全局常量 */
export const siteConfig = {
  siteName: '知剧AI',
  siteUrl: 'https://www.zhijuu.com',
  defaultOgImage: 'https://www.zhijuu.com/og-default.png',
  /** 全站通用关键词，自动追加到每个页面的 keywords 末尾 */
  commonKeywords: '知剧,知剧AI,zhijuu,AI短剧,短剧创作平台',
}

/**
 * 各页面 SEO 配置（精确路由匹配）
 * 改 TDK 只改这里，改完 generate 一下就行，不用动页面代码
 */
export const seoConfig: Record<string, PageSeo> = {

  /* ======================== 公开页面（SSG / ISR） ======================== */

  '/': {
    title: '知剧AI - 智能短剧创作平台 | AI编剧 | 小说转剧本 | 剧本生成',
    description: '知剧AI是专业的AI短剧创作平台，提供智能编剧、小说转剧本、AI剧本生成等功能。覆盖分集大纲、角色设计、台本生成、分镜脚本全流程，让短剧创作效率提升10倍。支持一键生成完整短剧剧本，从创意到成片全流程智能辅助。',
    keywords: 'AI编剧,短剧创作,剧本生成,小说转剧本,AI写剧本,智能编剧,短剧剧本,AI剧本创作,分镜脚本,台本生成,角色设计,分集大纲,短剧制作,AI写作,微短剧,短剧编剧,鹊思,AI鹊思编剧助手,TensAI,创一AI,蛙蛙写作,可梦AI,有戏AI,StoryPlay',
    ogTitle: '知剧AI - 智能短剧创作平台',
    ogDescription: '从创意到成片剧本，全流程智能辅助。AI自动生成分集大纲、角色对白、分镜脚本，让短剧创作效率提升10倍。',
  },

  '/news': {
    title: '行业快讯 - 知剧AI | 短剧行业资讯动态',
    description: '短剧行业最新资讯、政策动态、数据报告、行业观点聚合，掌握短剧行业第一手信息。',
    keywords: '短剧行业资讯,短剧新闻,短剧政策,短剧数据报告,行业快讯,短剧行业动态',
    ogTitle: '行业快讯 - 知剧AI',
    ogDescription: '短剧行业最新资讯聚合，每日更新',
  },

  '/privacy-policy': {
    title: '隐私政策 - 知剧AI',
    description: '知剧AI隐私政策，了解我们如何收集、使用和保护您的个人信息。',
    keywords: '知剧AI隐私政策,隐私保护,个人信息保护',
    ogTitle: '隐私政策 - 知剧AI',
    ogDescription: '知剧AI隐私政策，了解我们如何收集、使用和保护您的个人信息。',
  },

  '/terms-of-service': {
    title: '用户协议 - 知剧AI',
    description: '知剧AI用户协议，使用本平台前请仔细阅读本协议的全部内容。',
    keywords: '知剧AI用户协议,服务条款,使用条款',
    ogTitle: '用户协议 - 知剧AI',
    ogDescription: '知剧AI用户协议，使用本平台前请仔细阅读本协议的全部内容。',
  },

  /* ======================== 功能页面（CSR，需登录） ======================== */

  '/works': {
    title: '我的作品 - 知剧AI智能短剧创作平台',
    description: '管理你在知剧AI创建的所有剧本和小说项目，查看创作进度，继续编辑或导出作品。',
    keywords: '我的作品,AI剧本管理,短剧作品,剧本项目,创作管理',
  },

  '/write': {
    title: 'AI写剧本 - 知剧AI | 一键生成短剧剧本',
    description: '使用知剧AI智能编剧功能，输入创意设定即可一键生成完整短剧剧本。支持智能分集大纲、角色性格设计、专业台词对白、场景描写自动生成。',
    keywords: 'AI写剧本,短剧剧本生成,AI编剧,智能写剧本,一键生成剧本,剧本创作工具,自动写剧本',
  },

  '/novel-to-script': {
    title: '小说转剧本 - 知剧AI | AI小说改编短剧',
    description: '上传或粘贴小说原文，知剧AI智能分析章节结构，自动提取情节、改编对白，一键将小说转换为专业短剧剧本格式。保留原作精髓，高效完成改编。',
    keywords: '小说转剧本,小说改编短剧,小说转短剧,AI改编,章节拆分,情节提取,对白改编,网文转剧本',
  },

  '/recharge': {
    title: '充值中心 - 知剧AI | 会员套餐购买',
    description: '知剧AI充值中心，提供包月、包季、包年的会员套餐，帮助你按创作规模解锁更多AI创作能力。',
    keywords: '知剧AI充值,知剧会员,AI写作会员,会员套餐',
  },

  '/user/profile': {
    title: '个人资料 - 知剧AI',
    description: '管理你的知剧AI账号信息，修改个人资料和头像设置。',
    keywords: '个人资料,账号管理,知剧AI账号',
  },
}

/** 动态路由前缀匹配（处理 /write/:id、/novel/:id 等） */
const prefixSeoConfig: Record<string, PageSeo> = {
  '/write/': {
    title: '剧本编辑 - 知剧AI',
    description: '使用知剧AI在线编辑短剧剧本，AI辅助优化台词、场景描写和角色设定。',
    keywords: 'AI剧本编辑,在线编辑剧本,AI写剧本,剧本修改',
  },
  '/novel/': {
    title: '小说编辑 - 知剧AI',
    description: '使用知剧AI编辑小说内容，智能拆分章节并转换为专业短剧剧本。',
    keywords: '小说编辑,AI小说转剧本,小说改编',
  },
}

/**
 * 根据路由路径获取 SEO 配置
 * 优先精确匹配 → 其次前缀匹配 → 未命中返回 null
 */
export function getSeoByRoute(path: string): PageSeo | null {
  if (seoConfig[path]) return seoConfig[path]

  for (const [prefix, seo] of Object.entries(prefixSeoConfig)) {
    if (path.startsWith(prefix)) return seo
  }

  return null
}

/**
 * 拼接完整的 keywords = 页面关键词 + 全站通用关键词
 */
export function getFullKeywords(pageSeo: PageSeo): string {
  const pageKw = pageSeo.keywords || ''
  return pageKw
    ? `${pageKw},${siteConfig.commonKeywords}`
    : siteConfig.commonKeywords
}
