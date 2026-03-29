/**
 * 管理后台 - Vue3 SPA 入口
 * 使用 hash 路由模式，由 EggJS 渲染入口 HTML
 */
;(function () {
  const { createApp } = Vue
  const { createRouter, createWebHashHistory } = VueRouter

  const isLocal = window.__DEPLOY_MODE__ === 'localhost'

  /* localhost 模式下需要隐藏的路由路径 */
  const localHiddenRoutes = ['feedback', 'redeem', 'redeem-log', 'vip-config', 'order']

  /* ==================== 路由配置 ==================== */
  const allChildren = [
    { path: 'dashboard', component: DashboardPage },
    { path: 'drama', component: DramaListPage },
    { path: 'drama/edit/:id?', component: DramaEditPage },
    { path: 'genre', component: GenrePage },
    { path: 'feedback', component: FeedbackPage },
    { path: 'redeem', component: RedeemPage },
    { path: 'redeem-log', component: RedeemLogPage },
    { path: 'vip-config', component: VipConfigPage },
    { path: 'order', component: OrderPage },
    { path: 'user', component: UserPage },
    { path: 'system-config', component: SystemConfigPage },
  ]

  const children = isLocal
    ? allChildren.filter(r => !localHiddenRoutes.includes(r.path))
    : allChildren

  const routes = [
    { path: '/login', component: LoginPage, meta: { noAuth: true } },
    {
      path: '/',
      component: AdminLayout,
      redirect: '/dashboard',
      children,
    },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ]

  const router = createRouter({
    history: createWebHashHistory(),
    routes,
  })

  /* 路由守卫：localhost 模式下跳过登录检查 */
  router.beforeEach((to, from, next) => {
    if (isLocal) {
      to.path === '/login' ? next('/dashboard') : next()
      return
    }
    const token = localStorage.getItem('admin_token')
    if (to.meta.noAuth) {
      token && to.path === '/login' ? next('/dashboard') : next()
    } else {
      token ? next() : next('/login')
    }
  })

  /* ==================== 创建应用 ==================== */
  const app = createApp({ template: '<router-view />' })

  /* 注册 Element Plus */
  app.use(ElementPlus, { locale: ElementPlusLocaleZhCn })

  /* 注册所有 Element Plus 图标 */
  for (const [key, comp] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, comp)
  }

  app.use(router)
  app.mount('#admin-app')
})()
