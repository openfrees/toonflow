/**
 * AI功能访问守卫
 * 统一处理登录、会员两类前置校验
 * localhost模式下自动跳过VIP检查
 */
export const useAccessGuard = () => {
  const userStore = useUserStore()

  const guardDialog = reactive({
    visible: false,
    icon: 'lucide:crown',
    title: '',
    description: '',
    confirmText: '',
    type: '',
  })

  const hasVipAccess = () => {
    if (userStore.isLocalMode) return true
    return Boolean(userStore.userInfo?.membershipLevel || userStore.userInfo?.id)
  }

  const openVipDialog = (actionName = '当前功能') => {
    guardDialog.icon = 'lucide:crown'
    guardDialog.title = '需要开通会员'
    guardDialog.description = `${actionName}需要会员权限，开通会员后即可继续使用该 AI 能力。`
    guardDialog.confirmText = '去开通会员'
    guardDialog.type = 'vip'
    guardDialog.visible = true
  }

  const handleGuardConfirm = () => {
    guardDialog.visible = false
    navigateTo('/recharge')
  }

  const ensureAccess = (options = {}) => {
    const {
      actionName = '当前功能',
      requireLogin = true,
      requireVip = true,
      silent = false,
    } = options

    if (requireLogin && !userStore.isLoggedIn) {
      if (!silent) {
        userStore.openLoginModal()
      }
      return false
    }

    /* localhost模式下跳过VIP校验 */
    if (userStore.isLocalMode) return true

    if (requireVip && !hasVipAccess()) {
      if (!silent) {
        openVipDialog(actionName)
      }
      return false
    }

    return true
  }

  return {
    guardDialog,
    hasVipAccess,
    openVipDialog,
    handleGuardConfirm,
    ensureAccess,
  }
}
