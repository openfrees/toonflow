/**
 * 登录鉴权中间件
 * 用于保护需要登录才能访问的页面
 *
 * 使用方式：在页面中添加
 * definePageMeta({ middleware: 'auth' })
 */
export default defineNuxtRouteMiddleware((to, from) => {
  const userStore = useUserStore()

  // 初始化用户状态（从localStorage恢复，会自动检查token是否过期）
  userStore.init()

  // 如果未登录，跳转到首页
  if (!userStore.isLoggedIn) {
    return navigateTo('/')
  }
})
