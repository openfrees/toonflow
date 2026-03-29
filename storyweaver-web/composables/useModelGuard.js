/**
 * 模型配置守卫 composable
 * AI 调用前检查用户是否已配置对应场景的模型
 * 未配置则弹出引导弹窗，必须去设置才能使用
 */
import { useUserStore } from '~/stores/user'

/** 全局响应式状态（跨组件共享） */
const showGuardDialog = ref(false)
const guardSceneLabel = ref('')
const guardResolve = ref(null)

export const useModelGuard = () => {
  const userStore = useUserStore()
  const { get } = useApi()
  const router = useRouter()

  let configStatusCache = null
  let cacheTime = 0

  /**
   * 获取配置状态（带缓存，5分钟）
   */
  const fetchConfigStatus = async () => {
    const now = Date.now()
    if (configStatusCache && now - cacheTime < 5 * 60 * 1000) {
      return configStatusCache
    }
    try {
      const res = await get('/api/model-config/status')
      if (res.code === 200) {
        configStatusCache = res.data
        cacheTime = now
        return res.data
      }
    } catch {}
    return { scriptGen: false, imageGen: false }
  }

  /** 清除缓存（用户保存模型设置后调用） */
  const clearCache = () => {
    configStatusCache = null
    cacheTime = 0
  }

  /**
   * 静默检查指定场景是否已配置模型（不弹窗，纯布尔判断）
   * @param {'script_gen' | 'image_gen'} sceneCode
   * @returns {Promise<boolean>}
   */
  const isModelConfigured = async (sceneCode) => {
    if (!userStore.isLoggedIn) return false
    const status = await fetchConfigStatus()
    return sceneCode === 'script_gen' ? !!status.scriptGen : !!status.imageGen
  }

  /**
   * 检查指定场景是否已配置模型（前置守卫）
   * 返回 true 表示已配置可继续，false 表示未配置（用户选了取消或去设置）
   * @param {'script_gen' | 'image_gen'} sceneCode
   * @returns {Promise<boolean>}
   */
  const checkModelConfig = async (sceneCode) => {
    if (!userStore.isLoggedIn) return false

    const status = await fetchConfigStatus()
    const isConfigured = sceneCode === 'script_gen' ? status.scriptGen : status.imageGen

    if (isConfigured) return true

    const label = sceneCode === 'script_gen' ? '剧本生成' : '图片生成'
    return _showDialog(label)
  }

  /**
   * 直接触发守卫弹窗（后端返回 4001 时调用）
   * @param {string} label - 场景标签文字
   * @returns {Promise<boolean>}
   */
  const triggerGuardDialog = (label) => {
    return _showDialog(label || '模型')
  }

  /**
   * 检查 fetch 响应是否为 4001 模型未配置错误（SSE 接口专用）
   * 如果是 4001，弹出引导弹窗并返回 true（调用方应中断后续流程）
   * @param {Response} response - fetch 的原始 Response 对象
   * @returns {Promise<boolean>} true=是4001已处理，false=正常响应
   */
  const checkSseResponse = async (response) => {
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('text/event-stream')) return false

    try {
      const data = await response.clone().json()
      if (data.code === 4001) {
        const label = data.message?.includes('图片') ? '图片生成' : '剧本生成'
        _showDialog(label)
        return true
      }
    } catch {}
    return false
  }

  /** 内部：显示弹窗并返回 Promise */
  const _showDialog = (label) => {
    guardSceneLabel.value = label
    return new Promise((resolve) => {
      guardResolve.value = resolve
      showGuardDialog.value = true
    })
  }

  /** 用户选择「去设置」 */
  const handleGoSetup = () => {
    showGuardDialog.value = false
    if (guardResolve.value) guardResolve.value(false)
    guardResolve.value = null
    router.push('/user/model-config')
  }

  /** 用户选择「取消」或关闭弹窗 */
  const handleCancel = () => {
    showGuardDialog.value = false
    if (guardResolve.value) guardResolve.value(false)
    guardResolve.value = null
  }

  return {
    showGuardDialog,
    guardSceneLabel,
    isModelConfigured,
    checkModelConfig,
    triggerGuardDialog,
    checkSseResponse,
    handleGoSetup,
    handleCancel,
    clearCache,
  }
}
