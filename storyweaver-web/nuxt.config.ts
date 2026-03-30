import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Nuxt3 配置
 * 核心策略：SSG优先，能静态渲染就静态渲染
 */

const isDev = process.env.NODE_ENV !== 'production'

export default defineNuxtConfig({
  /* 开启SSR（SSG基于SSR） */
  ssr: true,

  /**
   * 运行时配置
   * 开发环境默认 http://127.0.0.1:7006
   * 生产环境通过环境变量 NUXT_PUBLIC_API_BASE 覆盖
   */
  runtimeConfig: {
    public: {
      apiBase: 'http://127.0.0.1:7006',
      /* 左下角手册/客服专用接口域名
       * localhost 模式下优先走这里，默认指向官方商用接口 */
      sidebarApiBase: 'https://api.zhijuu.com',
      /* 部署模式：network=商用线上 / localhost=本地开源
       * 通过环境变量 NUXT_PUBLIC_DEPLOY_MODE 覆盖 */
      deployMode: 'network',
      /* 平台外链配置：前台页面在 localhost / network 模式下统一复用 */
      baiduAnalyticsKey: '',
      officialSiteUrl: 'https://www.zhijuu.com',
      giteeRepoUrl: 'https://gitee.com/open_free/toonflow',
      githubRepoUrl: 'https://github.com/open_free/toonflow',
    },
  },

  /* 开发服务器 */
  devServer: {
    port: 7005,
    host: '0.0.0.0',
  },

  /* Vite 配置：允许 cpolar 域名访问 */
  vite: {
    server: {
      allowedHosts: true
    },
  },

  /* 开发工具 */
  devtools: { enabled: true },

  /* 特性开关 */
  features: {
    /**
     * 将组件scoped CSS内联到SSR HTML中，消除FOUC闪烁
     * 默认true，开发和生产都内联（Nuxt生产构建时会自动优化提取）
     */
    inlineStyles: true,
  },

  /* 模块 */
  modules: ['@pinia/nuxt', '@nuxt/icon'],

  /* 路由级渲染规则 */
  routeRules: {
    // --- 不需要登录的页面 ---
    '/': { prerender: true }, // 首页：SSG预渲染（SEO友好，百度爬虫可抓取）
    '/about': { swr: 86400 }, // 关于我们：伪静态，缓存1天
    '/privacy-policy': { prerender: true },    /* 隐私政策 - 绝对静止 SSG */
    '/terms-of-service': { prerender: true },  /* 用户协议 - 绝对静止 SSG */
    '/news/**': { swr: 10800 },                /* 行业快讯 - ISR，缓存3小时 */

    // --- 需要登录的页面 (CSR 客户端渲染) ---
    '/user/**': { ssr: false },            /* 用户中心 */
    '/write/**': { ssr: false },           /* 写剧本 */
    '/works/**': { ssr: false },           /* 作品列表 */
    '/novel-to-script/**': { ssr: false }, /* 小说转剧本 */
    '/novel/**': { ssr: false },           /* 小说编辑 */
    '/recharge/**': { ssr: false },        /* 充值页面 */
  },

  /* Nitro服务引擎配置 */
  nitro: {
    prerender: {
      crawlLinks: true,
      ignore: ['/produce', '/design', '/analyze', '/review']
    },
  },

  /* 全局CSS */
  css: ['~/assets/css/main.css'],

  /* 应用配置 */
  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      title: '知剧AI - 智能短剧创作平台',
      meta: [
        { name: 'description', content: '知剧AI是专业的AI短剧创作平台，提供智能编剧、小说转剧本、剧本生成等全流程创作工具。' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
    },
  },

  /**
   * 开发环境：通过 render:html hook 将全局CSS内联到 <head>，消除FOUC闪烁
   * 生产环境：Nuxt自动提取为独立CSS文件（带hash缓存），不走此逻辑
   */
  hooks: {
    'render:html'(html) {
      if (isDev) {
        const cssPath = resolve(__dirname, 'assets/css/main.css')
        const css = readFileSync(cssPath, 'utf-8')
        html.head.push(`<style data-dev-inline="main">${css}</style>`)
      }
    },
  },

  /* 兼容性日期 */
  compatibilityDate: '2025-01-01',
})