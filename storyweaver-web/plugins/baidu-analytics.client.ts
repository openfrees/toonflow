/**
 * 百度统计插件（仅客户端）
 * 通过 runtimeConfig 读取统计 key，为空则不加载
 * 注入统计脚本 + 监听 SPA 路由切换上报 PV，确保每个页面都能被统计到
 */
export default defineNuxtPlugin(() => {
  const { baiduAnalyticsKey } = useRuntimeConfig().public

  if (!baiduAnalyticsKey) return

  const router = useRouter()

  window._hmt = window._hmt || []

  const hm = document.createElement('script')
  hm.src = `https://hm.baidu.com/hm.js?${baiduAnalyticsKey}`
  document.head.appendChild(hm)

  router.afterEach((to) => {
    nextTick(() => {
      window._hmt.push(['_trackPageview', to.fullPath])
    })
  })
})
