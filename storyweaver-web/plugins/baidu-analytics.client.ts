/**
 * 百度统计插件（仅客户端）
 * 注入统计脚本 + 监听 SPA 路由切换上报 PV，确保每个页面都能被统计到
 */
export default defineNuxtPlugin(() => {
  const router = useRouter()

  // 初始化百度统计全局数组
  window._hmt = window._hmt || []

  // 动态注入百度统计脚本
  const hm = document.createElement('script')
  hm.src = 'https://hm.baidu.com/hm.js?bddd87f4116250570c43578c45a533dc'
  document.head.appendChild(hm)

  // 监听路由切换，每次导航完成后手动上报 PV
  router.afterEach((to) => {
    nextTick(() => {
      window._hmt.push(['_trackPageview', to.fullPath])
    })
  })
})
