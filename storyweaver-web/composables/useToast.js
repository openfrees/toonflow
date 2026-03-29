/**
 * 全局Toast提示 composable
 * 页面正中上方展示，支持 success / error / warning 类型
 * 用法：const { showToast } = useToast()
 *       showToast('操作成功', 'success')
 *       showToast('出错了', 'error')
 */

/* 全局响应式状态（跨组件共享） */
const toastState = reactive({
  visible: false,
  message: '',
  type: 'error', /* success | error | warning */
})

let timer = null

/**
 * 显示Toast
 * @param {string} message - 提示文案
 * @param {'success'|'error'|'warning'} [type='error'] - 类型
 * @param {number} [duration=3500] - 自动关闭时间(ms)
 */
const showToast = (message, type = 'error', duration = 3500) => {
  if (timer) clearTimeout(timer)
  toastState.message = message
  toastState.type = type
  toastState.visible = true
  timer = setTimeout(() => {
    toastState.visible = false
  }, duration)
}

export const useToast = () => {
  return { toastState, showToast }
}
