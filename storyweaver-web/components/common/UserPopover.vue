<template>
  <Transition name="popover-fade">
    <div v-show="visible" class="user-popover">
      <!-- 顶部：头像 + 昵称（简洁白卡样式，参考图1） -->
      <div class="user-popover__header">
        <div class="user-popover__avatar">
          <img :src="avatarUrl" alt="头像" />
        </div>
        <span class="user-popover__name">{{ userInfo?.nickname || '未设置昵称' }}</span>
      </div>
      <!-- 第一条横线：与第二条一致，非全宽，两端留白 -->
      <div class="user-popover__menu-divider" />

      <!-- 菜单列表：个人资料、会员升级、模型设置、问题反馈、政策与协议、退出登录 -->
      <div class="user-popover__menu">
        <div
          v-for="item in menuItems"
          :key="item.action"
          class="user-popover__menu-item"
          @click="handleMenuClick(item.action)"
        >
          <Icon :name="item.icon" class="user-popover__menu-icon" size="18" />
          <span class="user-popover__menu-label">{{ item.label }}</span>
        </div>
        <div class="user-popover__menu-divider" />
        <div
          class="user-popover__menu-item"
          @click="handleMenuClick('logout')"
        >
          <Icon name="lucide:log-out" class="user-popover__menu-icon" size="18" />
          <span class="user-popover__menu-label">退出登录</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
/**
 * 用户信息弹窗组件
 * 点击头像弹出，展示头像+昵称及菜单列表（个人资料/会员升级/模型设置/问题反馈/政策与协议/退出登录）
 */
import { useUserStore } from '~/stores/user'

/** 后端API基础地址 */
const apiBase = useRuntimeConfig().public.apiBase
const userStore = useUserStore()

/** 默认头像 */
const defaultAvatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=user1'

const props = defineProps({
  /** 是否可见 */
  visible: Boolean,
  /** 用户信息 */
  userInfo: { type: Object, default: null },
})

const emit = defineEmits([
  'close',
  'logout',
  'openProfile',
  'openUpgradeVip',
  'openModelConfig',
  'openFeedback',
  'openPolicy',
])

/** 头像展示URL：相对路径拼接域名，完整URL直接用 */
const avatarUrl = computed(() => {
  const avatar = props.userInfo?.avatar
  if (!avatar) return defaultAvatar
  if (avatar.startsWith('http')) return avatar
  return `${apiBase}${avatar}`
})

/** 菜单项配置：开源模式下隐藏会员升级入口 */
const allMenuItems = [
  { icon: 'lucide:user', label: '个人资料', action: 'profile' },
  { icon: 'lucide:crown', label: '升级会员', action: 'upgradeVip' },
  { icon: 'lucide:brain', label: '模型设置', action: 'modelConfig' },
  { icon: 'lucide:message-circle', label: '问题反馈', action: 'feedback' },
  { icon: 'lucide:file-text', label: '政策与协议', action: 'policy' },
]
const localHiddenActions = ['upgradeVip']
const menuItems = computed(() =>
  userStore.isLocalMode
    ? allMenuItems.filter(item => !localHiddenActions.includes(item.action))
    : allMenuItems
)

/** 菜单点击处理 */
const handleMenuClick = (action) => {
  switch (action) {
    case 'profile':
      emit('openProfile')
      break
    case 'upgradeVip':
      emit('openUpgradeVip')
      break
    case 'modelConfig':
      emit('openModelConfig')
      break
    case 'feedback':
      emit('openFeedback')
      break
    case 'policy':
      emit('openPolicy')
      break
    case 'logout':
      emit('logout')
      return
    default:
      break
  }
  emit('close')
}
</script>

<style scoped>
.user-popover {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 220px;
  background: var(--color-bg-white);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  z-index: 1000;
}

/* ========== 顶部：头像 + 昵称（简洁白卡，参考图1） ========== */
.user-popover__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 16px 0;
}

.user-popover__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  border: 1px solid var(--color-border);
  flex-shrink: 0;
}

.user-popover__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-popover__name {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text);
}

/* ========== 菜单列表（纵向，参考图1） ========== */
.user-popover__menu {
  padding: 8px 0;
}

.user-popover__menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.2s;
}

.user-popover__menu-item:hover {
  background: var(--color-bg-hover, #f5f5f5);
}

.user-popover__menu-icon {
  line-height: 1;
  width: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
}

.user-popover__menu-label {
  font-size: 0.875rem;
  color: var(--color-text);
}

.user-popover__menu-divider {
  height: 1px;
  background: var(--color-border);
  margin: 6px 12px;
}

/* ========== 弹窗动画 ========== */
.popover-fade-enter-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.popover-fade-leave-active {
  transition: all 0.2s ease-in;
}

.popover-fade-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.96);
}

.popover-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}
</style>
