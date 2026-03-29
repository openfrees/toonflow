import type { PageSeo } from '~/config/seo'
import { getSeoByRoute, getFullKeywords, siteConfig } from '~/config/seo'

/**
 * 全站统一 SEO composable
 * 自动读取 config/seo.ts 中当前路由的 TDK 配置，一行搞定
 *
 * @param overrides 可选，页面级覆盖（动态页面可传入运行时标题等）
 *
 * @example
 * // 静态页面 —— 直接调用，自动匹配路由
 * useSeo()
 *
 * // 动态页面 —— 覆盖部分字段
 * useSeo({ title: `${dramaName} - 知剧AI` })
 */
export function useSeo(overrides?: Partial<PageSeo>) {
  const route = useRoute()
  const path = route.path

  const routeSeo = getSeoByRoute(path)
  if (!routeSeo && !overrides) return

  const config: Partial<PageSeo> = { ...routeSeo, ...overrides }
  if (!config.title) return

  const keywords = getFullKeywords(config as PageSeo)
  const ogTitle = config.ogTitle || config.title
  const ogDesc = config.ogDescription || config.description

  useSeoMeta({
    title: config.title,
    description: config.description,
    keywords,
    ogType: 'website',
    ogTitle,
    ogDescription: ogDesc,
    ogImage: config.ogImage || siteConfig.defaultOgImage,
    ogUrl: `${siteConfig.siteUrl}${path}`,
    ogSiteName: siteConfig.siteName,
    twitterCard: 'summary_large_image',
    twitterTitle: ogTitle,
    twitterDescription: ogDesc,
    twitterImage: config.ogImage || siteConfig.defaultOgImage,
  })
}
