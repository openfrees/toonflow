import { defineStore } from 'pinia'

/**
 * 用户状态管理 Store
 * 管理登录态、用户信息、登录弹窗状态
 * 根据 deployMode 适配 network / localhost 模式
 */
export const useUserStore = defineStore('user', () => {
  /** 用户信息 */
  const userInfo = ref(null)

  /** JWT Token */
  const token = ref('')

  /** 后端API基础地址（从 runtimeConfig 读取） */
  const apiBase = useRuntimeConfig().public.apiBase

  /** 部署模式 */
  const deployMode = useRuntimeConfig().public.deployMode

  /** 是否为本地开源模式 */
  const isLocalMode = computed(() => deployMode === 'localhost')

  /** 是否已登录 */
  const isLoggedIn = computed(() => !!token.value)

  /** 登录弹窗是否显示 */
  const showLoginModal = ref(false)

  /** 登录成功后的目标路径（用于登录后跳转） */
  const targetPath = ref('')

  /**
   * 初始化 - 从localStorage恢复登录态
   * 仅在客户端执行，会校验token是否已过期
   * localhost 模式下放宽过期检查（token 有效期 365 天）
   */
  const init = () => {
    if (!process.client) return

    const savedToken = localStorage.getItem('token')
    const savedUserInfo = localStorage.getItem('userInfo')

    if (savedToken) {
      if (_isTokenExpired(savedToken)) {
        localStorage.removeItem('token')
        localStorage.removeItem('userInfo')
        token.value = ''
        userInfo.value = null
        return
      }
      token.value = savedToken
    }
    if (savedUserInfo) {
      try {
        userInfo.value = JSON.parse(savedUserInfo)
      } catch {
        userInfo.value = null
      }
    }

    fetchUserInfo()
  }

  /**
   * 检查JWT token是否已过期
   * @param {string} jwtToken - JWT字符串
   * @returns {boolean} 是否已过期
   * @private
   */
  const _isTokenExpired = (jwtToken) => {
    try {
      const parts = jwtToken.split('.')
      if (parts.length !== 3) return true
      const payload = JSON.parse(atob(parts[1]))
      if (!payload.exp) return false
      return payload.exp * 1000 < Date.now() - 30000
    } catch {
      return true
    }
  }

  /**
   * 从服务端拉取最新用户信息并同步到store和localStorage
   */
  const fetchUserInfo = async () => {
    if (!token.value) return
    try {
      const res = await $fetch('/api/auth/userinfo', {
        baseURL: apiBase,
        headers: { Authorization: `Bearer ${token.value}` },
      })
      if (res.code === 200 && res.data) {
        userInfo.value = res.data
        if (process.client) {
          localStorage.setItem('userInfo', JSON.stringify(res.data))
        }
      }
    } catch (err) {
      console.error('获取用户信息失败:', err.message)
    }
  }

  /**
   * 设置登录信息
   * @param {object} data - 包含token和userInfo
   */
  const setLogin = (data) => {
    token.value = data.token
    userInfo.value = data.userInfo

    if (process.client) {
      localStorage.setItem('token', data.token)
      localStorage.setItem('userInfo', JSON.stringify(data.userInfo))
    }
  }

  /**
   * 退出登录
   * 清除登录信息并跳转到首页
   */
  const logout = () => {
    token.value = ''
    userInfo.value = null

    if (process.client) {
      localStorage.removeItem('token')
      localStorage.removeItem('userInfo')

      navigateTo('/')
    }
  }

  /**
   * 打开登录弹窗
   * @param {string} path - 登录成功后要跳转的目标路径（可选）
   */
  const openLoginModal = (path = '') => {
    showLoginModal.value = true
    targetPath.value = path
  }

  /**
   * 关闭登录弹窗
   */
  const closeLoginModal = () => {
    showLoginModal.value = false
    targetPath.value = ''
  }

  /**
   * 局部更新用户信息（如修改昵称、头像后）
   * @param {object} data - 需要更新的字段
   */
  const updateUserInfo = (data) => {
    if (!userInfo.value) return
    userInfo.value = { ...userInfo.value, ...data }

    if (process.client) {
      localStorage.setItem('userInfo', JSON.stringify(userInfo.value))
    }
  }

  return {
    userInfo,
    token,
    isLoggedIn,
    isLocalMode,
    deployMode,
    showLoginModal,
    targetPath,
    init,
    fetchUserInfo,
    setLogin,
    logout,
    openLoginModal,
    closeLoginModal,
    updateUserInfo,
  }
})
