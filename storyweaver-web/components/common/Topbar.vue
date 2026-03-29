<template>
  <header class="topbar">
    <div class="topbar__left" :class="{ 'topbar__left--compact': !showBrand }">
      <NuxtLink v-if="showBrand" to="/" class="topbar__brand">
        <span class="topbar__brand-mark">
          <span class="topbar__brand-mark-main">
            <Icon name="lucide:clapperboard" size="18" />
          </span>
          <span class="topbar__brand-mark-accent">
            <Icon name="lucide:sparkles" size="12" />
          </span>
        </span>
        <span class="topbar__brand-copy">
          <span class="topbar__brand-title">知剧AI</span>
          <span class="topbar__brand-subtitle">智能短剧创作平台</span>
        </span>
      </NuxtLink>

      <div v-if="showNav || $slots.left" class="topbar__context">
        <!-- 导航按钮（写剧本等无侧边栏页面显示） -->
        <template v-if="showNav">
          <span v-if="showBrand" class="topbar__context-divider"></span>
          <button class="topbar__nav-btn" @click="goBack" title="返回上一页">
            <Icon name="lucide:chevron-left" size="18" />
          </button>
          <button class="topbar__nav-btn" @click="goHome" title="返回首页">
            <Icon name="lucide:house" size="18" />
          </button>
          <span class="topbar__nav-divider"></span>
        </template>
        <!-- 页面可注入标题等内容 -->
        <slot name="left" />
      </div>
    </div>
    <div class="topbar__right">
      <!-- 页面可注入操作按钮 -->
      <slot name="actions" />

      <!-- 登录模块：客户端渲染（SSR时不渲染，避免水合不匹配） -->
      <ClientOnly>
        <!-- 未登录：显示登录按钮 -->
        <template v-if="!userStore.isLoggedIn">
          <button class="topbar__login-btn" @click="userStore.openLoginModal()">
            <Icon name="lucide:user" size="16" />
            <span>登录 / 注册</span>
          </button>
        </template>

        <!-- 已登录：非本地模式显示会员/快捷入口，随后显示头像 -->
        <template v-else>
          <!-- 会员状态徽章（本地模式下隐藏整个 VIP / 开会员 / 写剧本区域） -->
          <template v-if="!userStore.isLocalMode">
            <template v-if="userStore.userInfo?.isVip">
              <div
                class="topbar__vip-badge"
                :class="`topbar__vip-badge--${membershipBadgeClass}`"
                @click="navigateTo('/recharge')"
              >
                <Icon name="lucide:crown" size="13" class="topbar__vip-crown" />
                <span>{{ userStore.userInfo.membershipLevelName || userStore.userInfo.vipTierName }}</span>
              </div>
            </template>
            <template v-else>
              <div class="topbar__action-links">
                <span class="topbar__action-link" @click="navigateTo('/recharge')">开会员</span>
                <span class="topbar__action-link" @click="navigateTo('/write')">写剧本</span>
              </div>
            </template>
          </template>

          <!-- 头像 + 弹窗容器 -->
          <div ref="avatarWrapperRef" class="topbar__avatar-wrapper">
            <div class="topbar__avatar" @click="togglePopover">
              <img :src="avatarUrl" alt="头像" />
            </div>
            <!-- 用户信息弹窗 -->
            <CommonUserPopover
              :visible="showPopover"
              :user-info="userStore.userInfo"
              @close="closePopover"
              @logout="handleLogout"
              @open-profile="handleOpenProfile"
              @open-upgrade-vip="handleOpenUpgradeVip"
              @open-model-config="handleOpenModelConfig"
              @open-feedback="handleOpenFeedback"
              @open-policy="handleOpenPolicy"
            />
          </div>
        </template>
      </ClientOnly>
    </div>

    <!-- 问题反馈弹窗 -->
    <CommonFeedbackModal
      :visible="showFeedbackModal"
      @close="closeFeedbackModal"
    />
  </header>
</template>

<script setup>
/**
 * 顶部工具栏组件
 * 未登录：显示登录/注册按钮
 * 已登录：显示会员、用户头像及弹窗
 */
import { useUserStore } from '~/stores/user'

defineProps({
  /** 是否显示返回导航按钮（写剧本等无侧边栏页面使用） */
  showNav: { type: Boolean, default: false },
  /** 是否显示品牌 Logo（默认布局显示，编辑内页隐藏） */
  showBrand: { type: Boolean, default: true },
})

const userStore = useUserStore()
const router = useRouter()

/** 后端API基础地址 */
const apiBase = useRuntimeConfig().public.apiBase

/** 默认头像 */
const defaultAvatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=user1'

const membershipBadgeClass = computed(() => {
  return userStore.userInfo?.membershipLevel === 'advanced' ? 'advanced' : 'basic'
})

/** 头像展示URL：相对路径拼接域名 */
const avatarUrl = computed(() => {
  const avatar = userStore.userInfo?.avatar
  if (!avatar) return defaultAvatar
  if (avatar.startsWith('http')) return avatar
  return `${apiBase}${avatar}`
})

/** 返回作品列表（写剧本页面统一返回/works） */
const goBack = () => {
  navigateTo('/works')
}

/** 返回首页（走 Vue Router，支持页面级路由守卫拦截） */
const goHome = () => {
  navigateTo('/')
}

/** 弹窗显示状态 */
const showPopover = ref(false)

/** 问题反馈弹窗显示状态 */
const showFeedbackModal = ref(false)

/** 头像容器引用，用于检测点击外部区域 */
const avatarWrapperRef = ref(null)

/** 切换弹窗显示/隐藏 */
const togglePopover = () => {
  showPopover.value = !showPopover.value
}

/** 关闭弹窗 */
const closePopover = () => {
  showPopover.value = false
}

/** 退出登录 */
const handleLogout = () => {
  userStore.logout()
  closePopover()
}

/** 跳转到个人资料页面 */
const handleOpenProfile = () => {
  closePopover()
  router.push('/user/profile')
}

/** 跳转到模型设置页面 */
const handleOpenModelConfig = () => {
  closePopover()
  router.push('/user/model-config')
}

/** 跳转到会员升级页 */
const handleOpenUpgradeVip = () => {
  closePopover()
  router.push('/recharge')
}

/** 打开问题反馈弹窗 */
const handleOpenFeedback = () => {
  closePopover()
  showFeedbackModal.value = true
}

/** 关闭问题反馈弹窗 */
const closeFeedbackModal = () => {
  showFeedbackModal.value = false
}

/** 跳转到政策与协议页面 */
const handleOpenPolicy = () => {
  closePopover()
  router.push('/terms-of-service')
}

/**
 * 点击外部区域关闭弹窗
 * 监听 document 点击事件，判断是否点击在弹窗容器外
 */
const handleClickOutside = (event) => {
  if (!showPopover.value) return
  if (!avatarWrapperRef.value) return
  if (!avatarWrapperRef.value.contains(event.target)) {
    closePopover()
  }
}

onMounted(() => {
  userStore.init()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.topbar {
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(18px);
  border-bottom: 1px solid rgba(238, 239, 243, 0.92);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 110;
}

.topbar__left {
  display: flex;
  align-items: center;
  gap: 18px;
  min-width: 0;
}

.topbar__left--compact {
  gap: 8px;
}

.topbar__right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.topbar__brand {
  display: flex;
  align-items: center;
  gap: 14px;
  color: var(--color-text);
  text-decoration: none;
  flex-shrink: 0;
}

.topbar__brand:hover {
  color: var(--color-text);
}

.topbar__brand-mark {
  position: relative;
  width: 42px;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.topbar__brand-mark-main {
  width: 42px;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: linear-gradient(135deg, #ff6b35 0%, #f7418f 55%, #7c3aed 100%);
  color: #fff;
  box-shadow: 0 12px 26px rgba(247, 65, 143, 0.24);
}

.topbar__brand-mark-accent {
  position: absolute;
  top: -4px;
  right: -3px;
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #fff5f8;
  color: #f7418f;
  box-shadow: 0 8px 14px rgba(247, 65, 143, 0.18);
}

.topbar__brand-copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
  line-height: 1.1;
}

.topbar__brand-title {
  font-size: 1.02rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: #111827;
}

.topbar__brand-subtitle {
  font-size: 0.72rem;
  color: #94a3b8;
  letter-spacing: 0.08em;
}

.topbar__context {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.topbar__context-divider {
  width: 1px;
  align-self: stretch;
  background: linear-gradient(180deg, rgba(226, 232, 240, 0), rgba(226, 232, 240, 1), rgba(226, 232, 240, 0));
}

/* ====== 导航按钮（返回/首页） ====== */
.topbar__nav-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text-secondary);
  transition: all 0.2s;
}

.topbar__nav-btn:hover {
  background: var(--color-primary-bg);
  color: var(--color-primary);
}

.topbar__nav-divider {
  width: 1px;
  height: 20px;
  background: var(--color-border);
}

/* ====== 非会员：操作链接 ====== */
.topbar__action-links {
  display: flex;
  align-items: center;
  gap: 4px;
}

.topbar__action-link {
  padding: 5px 12px;
  border-radius: 18px;
  color: var(--color-primary, #22c55e);
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
  background: transparent;
}

.topbar__action-link:first-child {
  background: linear-gradient(135deg, #f0fdf4, #dcfce7);
}

.topbar__action-link:hover {
  background: linear-gradient(135deg, #dcfce7, #bbf7d0);
  transform: translateY(-1px);
}

/* ====== VIP等级徽章 ====== */
.topbar__vip-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 14px;
  border-radius: 18px;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.25s ease;
  letter-spacing: 0.03em;
  position: relative;
  overflow: hidden;
}

.topbar__vip-badge:hover {
  transform: translateY(-1px);
}

.topbar__vip-crown {
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.15));
}

/* 基础会员 */
.topbar__vip-badge--basic {
  background: linear-gradient(135deg, #fef3c7, #fcd34d);
  color: #78350f;
  box-shadow: 0 2px 8px rgba(252, 211, 77, 0.3);
}

.topbar__vip-badge--basic:hover {
  box-shadow: 0 4px 16px rgba(252, 211, 77, 0.45);
}

/* 高级会员 —— 高级质感 */
.topbar__vip-badge--advanced {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%);
  color: #d4af37;
  box-shadow: 0 2px 10px rgba(26, 26, 46, 0.4), inset 0 1px 0 rgba(212, 175, 55, 0.15);
  border: 1px solid rgba(212, 175, 55, 0.2);
}

.topbar__vip-badge--advanced:hover {
  box-shadow: 0 4px 18px rgba(26, 26, 46, 0.5), inset 0 1px 0 rgba(212, 175, 55, 0.25);
  border-color: rgba(212, 175, 55, 0.35);
}

.topbar__vip-badge--advanced .topbar__vip-crown {
  color: #d4af37;
  filter: drop-shadow(0 0 3px rgba(212, 175, 55, 0.5));
}

/* ====== 头像 ====== */
.topbar__avatar-wrapper {
  position: relative;
}

.topbar__avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid var(--color-border);
  cursor: pointer;
  transition: all 0.25s;
}

.topbar__avatar:hover {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
}

.topbar__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ====== 登录按钮 ====== */
.topbar__login-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  background: var(--color-primary-gradient);
  color: #fff;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  transition: all 0.3s;
  box-shadow: 0 2px 8px rgba(255, 107, 53, 0.3);
}

.topbar__login-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 107, 53, 0.4);
}

@media (max-width: 900px) {
  .topbar {
    padding: 0 18px;
  }

  .topbar__brand-subtitle {
    display: none;
  }
}
</style>
