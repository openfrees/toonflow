/**
 * API请求封装 composable
 * 基于 Nuxt3 的 $fetch，统一处理请求/响应/错误
 * 包含 4001 模型未配置错误的自动拦截
 */
import { useUserStore } from '~/stores/user'

/**
 * 封装API请求
 * - 从Pinia store读取JWT Token，保证与登录态同步
 * - 统一错误处理
 * - 401自动清除登录态（store + localStorage 同步清除）
 * - 4001自动弹出模型配置引导弹窗
 */
export const useApi = () => {
  const userStore = useUserStore()
  /** 后端API基础地址（从 runtimeConfig 读取，支持环境变量覆盖） */
  const API_BASE = useRuntimeConfig().public.apiBase

  /**
   * 通用请求方法
   * @param {string} url - 接口路径（如 /api/auth/login）
   * @param {object} options - 请求配置
   * @returns {Promise<object>} 响应数据 { code, message, data }
   */
  const request = async (url, options = {}) => {
    /* 从Pinia store获取Token，保证与登录态同步 */
    const token = userStore.token || ''
    const requestBaseURL = options.baseURL || API_BASE

    try {
      const response = await $fetch(`${requestBaseURL}${url}`, {
        method: options.method || 'GET',
        body: options.body,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      })

      /* 拦截 4001：模型未配置，弹出引导弹窗 */
      if (response && response.code === 4001 && process.client) {
        const { triggerGuardDialog } = useModelGuard()
        const label = response.message?.includes('图片') ? '图片生成' : '剧本生成'
        triggerGuardDialog(label)
        throw new Error(response.message || '请先配置AI模型')
      }

      return response
    } catch (error) {
      /* 如果是我们主动抛出的4001错误，直接向上传递 */
      if (error.message?.includes('模型')) {
        throw error
      }

      /* 处理HTTP错误 */
      const statusCode = error?.response?.status || error?.statusCode

      if (statusCode === 401 && process.client) {
        /* Token过期/无效，同步清除store和localStorage */
        userStore.logout()
        userStore.openLoginModal()
      }

      /* 尝试提取后端返回的错误信息 */
      const errorData = error?.response?._data || error?.data

      /* 拦截后端返回的 4001 错误（通过 HTTP error 返回的情况） */
      if (errorData && errorData.code === 4001 && process.client) {
        const { triggerGuardDialog } = useModelGuard()
        const label = errorData.message?.includes('图片') ? '图片生成' : '剧本生成'
        triggerGuardDialog(label)
        throw new Error(errorData.message || '请先配置AI模型')
      }

      if (errorData && errorData.message) {
        throw new Error(errorData.message)
      }

      throw new Error('网络请求失败，请稍后重试')
    }
  }

  /** GET 请求 */
  const get = (url, headers, baseURL) =>
    request(url, { method: 'GET', headers, baseURL })

  /** POST 请求 */
  const post = (url, body, headers, baseURL) =>
    request(url, { method: 'POST', body, headers, baseURL })

  /** PUT 请求 */
  const put = (url, body, baseURL) =>
    request(url, { method: 'PUT', body, baseURL })

  /** DELETE 请求 */
  const del = (url, baseURL) =>
    request(url, { method: 'DELETE', baseURL })

  return { request, get, post, put, del }
}
