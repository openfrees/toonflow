/**
 * 管理后台 - 工具函数
 */

/* 管理后台API前缀（由服务端模板注入，安全隔离） */
const ADMIN_PREFIX = window.__ADMIN_PREFIX__ || '/admin'

/* Axios 请求封装 - baseURL 使用动态前缀 */
const http = axios.create({ baseURL: ADMIN_PREFIX, timeout: 15000 })

/* 请求拦截 - 注入Token */
http.interceptors.request.use(config => {
  const token = localStorage.getItem('admin_token')
  if (token) config.headers.Authorization = 'Bearer ' + token
  return config
})

/* 响应拦截 - 统一错误处理 */
http.interceptors.response.use(
  response => {
    const res = response.data
    if (res.code !== 200) {
      ElementPlus.ElMessage.error(res.message || '请求失败')
      if (res.code === 401) {
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_userinfo')
        location.hash = '#/login'
      }
      const err = new Error(res.message)
      err.data = res.data
      return Promise.reject(err)
    }
    return res
  },
  error => {
    const status = error.response?.status
    if (status === 401) {
      ElementPlus.ElMessage.error('登录已过期')
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_userinfo')
      location.hash = '#/login'
    } else {
      ElementPlus.ElMessage.error(error.message || '网络错误')
    }
    return Promise.reject(error)
  }
)

/* ==================== API 接口 ==================== */

const API = {
  /* 认证 */
  login: data => http.post('/auth/login', data),
  getUserInfo: () => http.get('/auth/userinfo'),
  changePassword: data => http.post('/auth/change-password', data),

  /* 仪表盘 */
  dashboardStats: () => http.get('/dashboard/stats'),

  /* 短剧 */
  dramaList: params => http.get('/drama', { params }),
  dramaDetail: id => http.get('/drama/' + id),
  dramaCreate: data => http.post('/drama', data),
  dramaUpdate: (id, data) => http.put('/drama/' + id, data),
  dramaDelete: id => http.delete('/drama/' + id),
  dramaBatchStatus: data => http.post('/drama/batch-status', data),

  /* 分集 */
  episodeList: params => http.get('/episode', { params }),
  episodeCreate: data => http.post('/episode', data),
  episodeUpdate: (id, data) => http.put('/episode/' + id, data),
  episodeDelete: id => http.delete('/episode/' + id),

  /* 题材类型 */
  genreList: params => http.get('/genre', { params }),
  genreCreate: data => http.post('/genre', data),
  genreUpdate: (id, data) => http.put('/genre/' + id, data),
  genreDelete: id => http.delete('/genre/' + id),

  /* 反馈 */
  feedbackList: params => http.get('/feedback', { params }),
  feedbackDetail: id => http.get('/feedback/' + id),
  feedbackReply: (id, data) => http.post('/feedback/' + id + '/reply', data),
  feedbackUpdateStatus: (id, data) => http.put('/feedback/' + id + '/status', data),
  feedbackStats: () => http.get('/feedback/stats'),

  /* 兑换码 */
  redeemGenerate: data => http.post('/redeem/generate', data),
  redeemList: params => http.get('/redeem', { params }),
  redeemUpdateStatus: (id, data) => http.put('/redeem/' + id + '/status', data),
  redeemDelete: id => http.delete('/redeem/' + id),
  redeemLogList: params => http.get('/redeem/log', { params }),

  /* VIP 配置 */
  vipTiers: () => http.get('/vip/tiers'),
  vipTierCreate: data => http.post('/vip/tiers', data),
  vipTierUpdate: (id, data) => http.put('/vip/tiers/' + id, data),
  vipTierDelete: id => http.delete('/vip/tiers/' + id),
  vipPlans: () => http.get('/vip/plans'),
  vipPlanCreate: data => http.post('/vip/plans', data),
  vipPlanUpdate: (id, data) => http.put('/vip/plans/' + id, data),
  vipPlanDelete: id => http.delete('/vip/plans/' + id),
  vipPrices: () => http.get('/vip/prices'),
  vipPriceSet: data => http.post('/vip/prices', data),

  /* 订单管理 */
  orderStats: () => http.get('/order/stats'),
  orderList: params => http.get('/order', { params }),

  /* 用户管理 */
  userStats: () => http.get('/user/stats'),
  userSearch: keyword => http.get('/user/search', { params: { keyword } }),
  userList: params => http.get('/user', { params }),
  userUpdateStatus: (id, data) => http.put('/user/' + id + '/status', data),
  userDestroy: id => http.delete('/user/' + id),

  /* 系统配置 */
  systemConfigList: () => http.get('/system/config'),
  systemConfigSave: data => http.post('/system/config', data),
}
