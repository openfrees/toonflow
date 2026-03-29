<template>
  <div>
    <aside class="sidebar">
      <!-- 主导航（分组 + 分隔线） -->
      <nav class="sidebar__nav">
        <template v-for="(group, gi) in navGroups">
          <!-- 分组间分隔线 -->
          <div v-if="gi > 0" :key="`divider-${gi}`" class="sidebar__divider"></div>
          <template v-for="item in group">
            <!-- 不需要登录的页面：使用真实 <a> 标签，SEO 友好 -->
            <a
              v-if="!item.requireAuth"
              :key="item.path"
              :href="item.path"
              class="sidebar__item"
              :class="{ 'sidebar__item--active': isActive(item.path) }"
            >
              <Icon :name="item.icon" class="sidebar__item-icon" size="22" />
              <span class="sidebar__item-label">{{ item.label }}</span>
            </a>
            <!-- 需要登录的页面：使用 <a> 标签 + 点击拦截 -->
            <a
              v-else
              :key="item.path"
              href="javascript:;"
              class="sidebar__item"
              :class="{ 'sidebar__item--active': isActive(item.path) }"
              @click="handleAuthClick(item.path, $event)"
            >
              <Icon :name="item.icon" class="sidebar__item-icon" size="22" />
              <span class="sidebar__item-label">{{ item.label }}</span>
            </a>
          </template>
        </template>
      </nav>

      <!-- 底部操作 -->
      <div v-if="showSidebarFooter" class="sidebar__footer">
        <div class="sidebar__footer-row">
          <button v-if="showManualLink" type="button" class="sidebar__footer-link" @click="openManualLink">手册</button>
          <button v-if="showCustomerService" type="button" class="sidebar__footer-link" @click="openCustomerService">客服</button>
        </div>
      </div>
    </aside>

    <Teleport to="body">
      <Transition name="sidebar-modal-fade">
        <div v-if="customerServiceVisible" class="sidebar-modal" @click.self="closeCustomerService">
          <div class="sidebar-modal__card">
            <button type="button" class="sidebar-modal__close" @click="closeCustomerService">
              <Icon name="lucide:x" size="18" />
            </button>
            <h3 class="sidebar-modal__title">微信扫码进群</h3>
            <p class="sidebar-modal__desc">扫描下方二维码即可联系客服进群。</p>
            <div class="sidebar-modal__image-box">
              <img :src="customerServiceQrUrl" alt="客服群二维码" class="sidebar-modal__image" />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
/**
 * 左侧导航栏组件
 */
import { useUserStore } from '~/stores/user'

const route = useRoute()
const userStore = useUserStore()
const runtimeConfig = useRuntimeConfig()
const API_BASE = runtimeConfig.public.apiBase || ''
const SIDEBAR_API_BASE = runtimeConfig.public.sidebarApiBase || ''
const DEPLOY_MODE = runtimeConfig.public.deployMode || 'network'
const sidebarConfigBase = DEPLOY_MODE === 'localhost' ? (SIDEBAR_API_BASE || API_BASE) : API_BASE

const publicConfig = reactive({
  manual_link: '',
  customer_service_qr: '',
})
const customerServiceVisible = ref(false)

/**
 * 左下角配置中的相对资源路径，需要根据实际请求来源补全域名
 */
const resolveSidebarAssetUrl = (assetPath) => {
  const value = String(assetPath || '').trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  if (!sidebarConfigBase) return value
  return `${sidebarConfigBase}${value.startsWith('/') ? value : `/${value}`}`
}

const customerServiceQrUrl = computed(() => {
  return resolveSidebarAssetUrl(publicConfig.customer_service_qr)
})

const showManualLink = computed(() => !!String(publicConfig.manual_link || '').trim())
const showCustomerService = computed(() => !!customerServiceQrUrl.value)
const showSidebarFooter = computed(() => showManualLink.value || showCustomerService.value)

/* 导航分组：首页+作品 | 小说转剧本+写剧本 | 我的 */
const navGroups = [
  [
    { icon: 'lucide:house', label: '首页', path: '/', requireAuth: false },
    { icon: 'lucide:folder-open', label: '我的作品', path: '/works', requireAuth: true },
    // { icon: 'lucide:megaphone', label: '快讯', path: '/news', requireAuth: false },
  ],
  [
    { icon: 'lucide:book-text', label: '小说转剧本', path: '/novel-to-script', requireAuth: true },
    { icon: 'lucide:pen-line', label: '自己写剧本', path: '/write', requireAuth: true },
    // { icon: 'lucide:clapperboard', label: '拆短片', path: '/analyze', requireAuth: true },
    // { icon: 'lucide:video', label: '做短片', path: '/produce', requireAuth: true },
  ],
  [
    // { icon: 'lucide:image', label: '作图', path: '/design', requireAuth: true },
    { icon: 'lucide:bot', label: '模型设置', path: '/user/model-config', requireAuth: true },
    { icon: 'lucide:user', label: '我的', path: '/user/profile', requireAuth: true },
  ],
]

const isActive = (path) => {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

/**
 * 拉取侧边栏公开配置
 * 这里只读取手册链接和客服二维码，不暴露后台其他系统配置
 */
const loadPublicConfig = async () => {
  try {
    const res = await $fetch('/api/system/public-config', {
      baseURL: sidebarConfigBase,
    })
    if (res?.code === 200 && res.data) {
      publicConfig.manual_link = String(res.data.manual_link || '').trim()
      publicConfig.customer_service_qr = String(res.data.customer_service_qr || '').trim()
    }
  } catch (error) {
    publicConfig.manual_link = ''
    publicConfig.customer_service_qr = ''
    console.error('加载侧边栏公开配置失败:', error)
  }
}

/**
 * 打开后台配置的手册链接
 */
const openManualLink = () => {
  const rawLink = String(publicConfig.manual_link || '').trim()
  if (!rawLink) return
  const link = /^https?:\/\//i.test(rawLink) ? rawLink : `https://${rawLink}`

  window.open(link, '_blank', 'noopener,noreferrer')
}

/**
 * 打开客服二维码弹窗
 */
const openCustomerService = () => {
  if (!customerServiceQrUrl.value) return

  customerServiceVisible.value = true
}

const closeCustomerService = () => {
  customerServiceVisible.value = false
}

/**
 * 处理需要登录的导航点击
 * @param {string} path - 目标路径
 * @param {Event} event - 点击事件
 */
const handleAuthClick = (path, event) => {
  event.preventDefault()

  if (userStore.isLoggedIn) {
    // 已登录：直接跳转
    navigateTo(path)
  } else {
    // 未登录：弹出登录弹窗，传入目标路径
    userStore.openLoginModal(path)
  }
}

onMounted(() => {
  loadPublicConfig()
})
</script>

<style scoped>
.sidebar {
  position: fixed;
  left: 0;
  top: 72px;
  bottom: 0;
  width: var(--sidebar-width);
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(14px);
  border-right: 1px solid rgba(238, 239, 243, 0.9);
  display: flex;
  flex-direction: column;
  z-index: 100;
  padding: 18px 0 16px;
  box-shadow: 8px 0 24px rgba(17, 24, 39, 0.03);
}

.sidebar__nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 10px;
}

.sidebar__divider {
  height: 1px;
  background: linear-gradient(90deg, rgba(238, 239, 243, 0), rgba(238, 239, 243, 1), rgba(238, 239, 243, 0));
  margin: 10px 10px;
}

.sidebar__item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 6px;
  border-radius: 14px;
  color: var(--color-text-secondary);
  transition: all 0.2s ease;
  text-decoration: none;
}

.sidebar__item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%) scaleY(0);
  width: 3px;
  height: 60%;
  border-radius: 0 3px 3px 0;
  background: var(--color-primary);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar__item:hover {
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 8px 18px rgba(17, 24, 39, 0.05);
}

.sidebar__item:hover .sidebar__item-icon {
  transform: scale(1.12);
}

.sidebar__item--active {
  color: var(--color-primary) !important;
  background: linear-gradient(180deg, rgba(255, 107, 53, 0.1), rgba(247, 65, 143, 0.08)) !important;
  box-shadow: 0 10px 24px rgba(255, 107, 53, 0.12);
}

.sidebar__item--active::before {
  transform: translateY(-50%) scaleY(1);
}

.sidebar__item--active .sidebar__item-icon {
  color: var(--color-primary);
}

.sidebar__item-icon {
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease, color 0.2s ease;
}

.sidebar__item-label {
  font-size: 0.76rem;
  font-weight: 500;
  white-space: nowrap;
  transition: color 0.2s ease;
}

.sidebar__footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 10px 4px;
  border-top: 1px solid var(--color-border);
}

.sidebar__footer-row {
  display: flex;
  gap: 12px;
}

.sidebar__footer-link {
  border: 0;
  background: transparent;
  font-size: 0.65rem;
  color: var(--color-text-light);
  cursor: pointer;
  transition: color 0.2s;
  padding: 0;
}

.sidebar__footer-link:hover {
  color: var(--color-primary);
}

.sidebar-modal {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.42);
  padding: 20px;
}

.sidebar-modal__card {
  position: relative;
  width: min(320px, 100%);
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 18px 60px rgba(15, 23, 42, 0.22);
  padding: 28px 24px 24px;
  text-align: center;
}

.sidebar-modal__close {
  position: absolute;
  top: 14px;
  right: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 999px;
  background: #f8fafc;
  color: #64748b;
  cursor: pointer;
}

.sidebar-modal__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text);
}

.sidebar-modal__desc {
  margin: 10px 0 0;
  font-size: 0.84rem;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.sidebar-modal__image-box {
  margin-top: 18px;
  border-radius: 16px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  background: #fff;
  padding: 12px;
}

.sidebar-modal__image {
  display: block;
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: contain;
}

.sidebar-modal-fade-enter-active,
.sidebar-modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.sidebar-modal-fade-enter-from,
.sidebar-modal-fade-leave-to {
  opacity: 0;
}
</style>
