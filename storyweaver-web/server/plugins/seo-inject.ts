import { getSeoByRoute, getFullKeywords, siteConfig } from '../../config/seo'

/**
 * Nitro 插件：nuxt generate 时为所有页面（含 CSR 页面）注入正确的 TDK
 *
 * 背景：CSR 页面（ssr: false）的 useSeoMeta 只在浏览器执行，
 *       生成的静态 HTML 里只有 nuxt.config 里的全局默认 TDK。
 *       搜索引擎抓到的就是千篇一律的默认值，这不行。
 *
 * 原理：render:html 钩子在 HTML 输出前触发（SSR 和 CSR 都会），
 *       我们根据路由替换 <title> 和 <meta>，确保每个页面都有专属 TDK。
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', (html: any, { event }: any) => {
    const rawPath = event.path || event.node?.req?.url || '/'
    const path = rawPath.split('?')[0].replace(/\/+$/, '') || '/'

    const seo = getSeoByRoute(path)
    if (!seo) return

    const keywords = getFullKeywords(seo)
    const ogTitle = seo.ogTitle || seo.title
    const ogDesc = seo.ogDescription || seo.description
    const ogImage = seo.ogImage || siteConfig.defaultOgImage
    const ogUrl = `${siteConfig.siteUrl}${path}`

    // Step 1: 替换 <title>
    html.head = html.head.map((chunk: string) =>
      chunk.replace(/<title>[^<]*<\/title>/, `<title>${esc(seo.title)}</title>`)
    )

    // Step 2: 清除已有的 SEO meta（防止 SSR 页面与 useSeoMeta 产生重复标签）
    html.head = html.head.map((chunk: string) =>
      chunk
        .replace(/<meta[^>]*name="description"[^>]*>\s*/g, '')
        .replace(/<meta[^>]*name="keywords"[^>]*>\s*/g, '')
        .replace(/<meta[^>]*property="og:[^"]*"[^>]*>\s*/g, '')
        .replace(/<meta[^>]*name="twitter:[^"]*"[^>]*>\s*/g, '')
        .replace(/<meta[^>]*name="og:[^"]*"[^>]*>\s*/g, '')
    )

    // Step 3: 注入完整的 SEO meta
    html.head.push([
      `<meta name="description" content="${esc(seo.description)}">`,
      `<meta name="keywords" content="${esc(keywords)}">`,
      `<meta property="og:type" content="website">`,
      `<meta property="og:site_name" content="${esc(siteConfig.siteName)}">`,
      `<meta property="og:title" content="${esc(ogTitle)}">`,
      `<meta property="og:description" content="${esc(ogDesc)}">`,
      `<meta property="og:image" content="${ogImage}">`,
      `<meta property="og:url" content="${ogUrl}">`,
      `<meta name="twitter:card" content="summary_large_image">`,
      `<meta name="twitter:title" content="${esc(ogTitle)}">`,
      `<meta name="twitter:description" content="${esc(ogDesc)}">`,
      `<meta name="twitter:image" content="${ogImage}">`,
    ].join('\n'))
  })
})

/** HTML 属性值转义 */
function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
