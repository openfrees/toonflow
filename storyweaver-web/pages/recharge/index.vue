<template>
  <div class="recharge-container">
    <!-- 主体区域：页中页布局 -->
    <main class="recharge-main">
      <!-- 会员状态卡片（已登录且有VIP时显示） -->
      <div v-if="vipInfo && vipInfo.isVip" class="vip-status-card" :class="`vip-status-card--${membershipStatusClass}`">
        <!-- 装饰光效 -->
        <div class="vip-status-card__glow"></div>
        <div class="vip-status-card__pattern"></div>
        <!-- 左侧：徽章 + 信息 -->
        <div class="vip-status-card__left">
          <div class="vip-status-card__badge">
            <Icon name="lucide:crown" class="vip-status-card__icon" size="24" />
          </div>
          <div class="vip-status-card__info">
            <div class="vip-status-card__name-row">
              <span class="vip-status-card__name">{{ vipInfo.tierName }}</span>
              <span class="vip-status-card__label">MEMBER</span>
            </div>
            <span class="vip-status-card__expires">
              <Icon name="lucide:calendar" size="13" style="vertical-align: -1px; margin-right: 4px;" />
              {{ formatExpiresAt(vipInfo.expiresAt) }} 到期
            </span>
          </div>
        </div>
        <!-- 右侧：剩余天数 + 续费 -->
        <div class="vip-status-card__right">
          <div class="vip-status-card__days">
            <span class="vip-status-card__days-num">{{ remainingDays }}</span>
            <span class="vip-status-card__days-unit">天</span>
          </div>
          <button class="vip-status-card__renew-btn" @click="scrollToCurrentTier">
            <Icon name="lucide:zap" size="14" style="vertical-align: -1px;" />
            续费
          </button>
        </div>
      </div>

      <div class="recharge-hero">
        <h2 class="recharge-hero__title">会员权益方案</h2>
        <p class="recharge-hero__subtitle">保留月付、季付、年付，按创作规模选择更适合你的会员档位。</p>
      </div>

      <div v-if="configLoading" class="recharge-state-card">
        <Icon name="lucide:loader-2" class="recharge-state-card__icon recharge-state-card__icon--spin" size="22" />
        <p class="recharge-state-card__text">套餐数据加载中，请稍候...</p>
      </div>

      <div v-else-if="configError" class="recharge-state-card recharge-state-card--error">
        <Icon name="lucide:alert-triangle" class="recharge-state-card__icon" size="22" />
        <p class="recharge-state-card__text">{{ configError }}</p>
        <button class="recharge-state-card__retry" @click="fetchVipConfig">
          重新加载
        </button>
      </div>

      <template v-else>
        <!-- Tab：会员订阅周期 -->
        <div class="recharge-tabs-row">
          <div class="recharge-tabs">
            <button
              v-for="tab in tabs"
              :key="tab.value"
              class="recharge-tabs__item"
              :class="{ 'recharge-tabs__item--active': currentTab === tab.value }"
              @click="currentTab = tab.value"
            >
              {{ tab.label }}
              <span v-if="tab.tag" class="recharge-tabs__tag">{{ tab.tag }}</span>
            </button>
          </div>
          <button class="recharge-tabs-row__action" @click="openPurchaseLog">
            <Icon name="lucide:receipt-text" size="16" />
            <span>查看充值记录</span>
          </button>
        </div>

        <!-- 会员计划内容 (月付/季付/年付) -->
        <div class="membership-cards">
          <div
            v-for="tier in displayCards"
            :key="tier.id"
            class="membership-card"
            :class="[
              `membership-card--${tier.membership_level || tier.tier_code}`,
              {
                'membership-card--current': isCurrentTier(tier),
                'membership-card--surpassed': isTierDisabled(tier),
                'membership-card--free': tier.is_virtual,
              }
            ]"
          >
            <div class="membership-card__surpassed-tag" v-if="isTierDisabled(tier)">已超越</div>
            <div class="membership-card__badge" v-if="getTierBadgeText(tier) && !isTierDisabled(tier)">{{ getTierBadgeText(tier) }}</div>
            <div class="membership-card__header">
              <h3 class="membership-card__title">{{ tier.name }}</h3>
              <div class="membership-card__price-box" v-if="!tier.is_virtual">
                <span class="membership-card__price">{{ getPrice(tier.tier_code).current }}</span>
                <span class="membership-card__unit">元/{{ getPeriodName() }}</span>
                <span class="membership-card__original" v-if="getPrice(tier.tier_code).original > 0">¥{{ getPrice(tier.tier_code).original }}</span>
              </div>
              <div v-else class="membership-card__price-box membership-card__price-box--free">
                <span class="membership-card__price">免费</span>
                <span class="membership-card__unit">当前默认</span>
              </div>
              <p class="membership-card__desc">
                <template v-if="tier.is_virtual">{{ tier.desc_text }}</template>
                <template v-else>单月{{ getPrice(tier.tier_code).monthEquivalent }}元 | {{ tier.desc_text }}</template>
              </p>
            </div>
            <div class="membership-card__body">
              <div class="membership-card__summary">
                {{ getTierSummary(tier) }}
              </div>
              <button
                class="membership-btn"
                :class="[`membership-btn--${tier.membership_level || tier.tier_code}`, { 'membership-btn--disabled': isTierDisabled(tier) }]"
                @click="handleTierClick(tier)"
              >
                {{ getTierBtnText(tier) }}
              </button>
              <ul class="membership-card__features" v-html="tier.features_html"></ul>
            </div>
          </div>
        </div>
      </template>
    </main>

    <!-- 支付弹窗 -->
    <CommonPaymentModal
      v-model:visible="paymentVisible"
      :tier-name="paymentTierName"
      :price="paymentPrice"
      :product-detail="paymentProductDetail"
      @close="onPaymentClose"
      @success="onPaymentSuccess"
    />

    <CommonPurchaseLogModal
      :visible="purchaseLogVisible"
      @close="closePurchaseLog"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '~/stores/user'
const { showToast } = useToast()
const userStore = useUserStore()

// 开源模式下禁止访问充值页面，直接跳回首页
if (userStore.isLocalMode) {
  navigateTo('/', { replace: true })
}

// 路由中间件：需要登录才能访问
definePageMeta({
  middleware: 'auth'
})

useSeo()

const API_BASE = useRuntimeConfig().public.apiBase
const { resolveMembershipInfo } = useMembershipRights()

const defaultVipConfig = {
  tabs: [],
  freeTier: null,
  tiers: [],
}
const configResp = ref<any>(defaultVipConfig)
const configLoading = ref(true)
const configError = ref('')

const tabs = computed(() => configResp.value.tabs || [])
const freeTier = computed(() => configResp.value.freeTier || null)
const tiers = computed(() => configResp.value.tiers || [])
const displayCards = computed(() => {
  const cards: any[] = []
  if (freeTier.value) cards.push(freeTier.value)
  cards.push(...tiers.value)
  return cards
})

const route = useRoute()
const qTab = String(route.query.tab || '')
const initTab = ['month', 'quarter', 'year'].includes(qTab) ? qTab : 'month'
const currentTab = ref(initTab)
const purchaseLogVisible = ref(false)

/* =========== 用户VIP信息 =========== */
const vipInfo = ref<{
  isVip: boolean
  tierCode: string | null
  tierName: string | null
  expiresAt: string | null
  isExpired: boolean
  sortOrder: number
  membershipLevel?: string
  createLimit?: number
  novelWordLimit?: number
} | null>(null)

/** 获取充值页套餐配置 */
async function fetchVipConfig() {
  configLoading.value = true
  configError.value = ''

  try {
    const res: any = await $fetch(`${API_BASE}/api/vip/config`)
    if (res?.code === 200 && res.data) {
      configResp.value = {
        tabs: res.data.tabs || [],
        freeTier: res.data.freeTier || null,
        tiers: res.data.tiers || [],
      }
      return
    }

    throw new Error(res?.message || '套餐数据加载失败')
  } catch (err: any) {
    configResp.value = defaultVipConfig
    configError.value = err?.message || '套餐数据加载失败，请稍后重试'
    console.warn('[获取充值配置失败]', err)
  } finally {
    configLoading.value = false
  }
}

/** 获取用户VIP信息 */
async function fetchVipInfo() {
  const token = localStorage.getItem('token')
  if (!token) return

  try {
    const res: any = await $fetch(`${API_BASE}/api/user/vip-info`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.code === 200 && res.data) {
      vipInfo.value = res.data
    }
  } catch (err) {
    console.warn('[获取VIP信息失败]', err)
  }
}

onMounted(() => {
  fetchVipConfig()
  fetchVipInfo()
})

/** 格式化到期时间 */
const formatExpiresAt = (dateStr: string | null) => {
  if (!dateStr) return '未知'
  return dateStr.split(' ')[0] // 只显示日期部分
}

/** 计算剩余天数 */
const remainingDays = computed(() => {
  if (!vipInfo.value?.expiresAt) return 0
  const now = new Date()
  const expires = new Date(vipInfo.value.expiresAt)
  const diff = expires.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
})

const membershipStatusClass = computed(() => {
  return vipInfo.value?.membershipLevel === 'advanced' ? 'advanced' : 'basic'
})

/** 滚动到当前等级卡片区域 */
const scrollToCurrentTier = () => {
  const el = document.querySelector('.membership-card--current') || document.querySelector('.membership-cards')
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

/** 判断是否是当前VIP等级 */
const isCurrentTier = (tier: any) => {
  if (tier?.is_virtual) return !vipInfo.value?.isVip
  if (!vipInfo.value?.isVip) return false
  const currentMembership = resolveMembershipInfo({
    membershipLevel: vipInfo.value?.membershipLevel,
    membershipLevelName: vipInfo.value?.tierName,
    membershipLevelRank: vipInfo.value?.sortOrder,
    membershipCreateLimit: vipInfo.value?.createLimit,
    membershipNovelWordLimit: vipInfo.value?.novelWordLimit,
  } as any)
  return currentMembership.level === (tier.membership_level || 'basic')
}

/** 获取tier的sort_order */
const getTierSortOrder = (tier: any) => {
  return tier.sort_order || 0
}

/** 判断该等级是否被禁用（高等级会员不能买低等级） */
const isTierDisabled = (tier: any) => {
  if (tier?.is_virtual) return false
  if (!vipInfo.value?.isVip) return false
  return getTierSortOrder(tier) < Number(vipInfo.value.sortOrder || 0)
}

/** 获取按钮文案 */
const getTierBtnText = (tier: any) => {
  if (tier?.is_virtual) return vipInfo.value?.isVip ? '已包含免费权益' : '当前方案'
  if (!vipInfo.value?.isVip) return '立即开通'
  if (isTierDisabled(tier)) return '已包含在当前会员中'
  if (isCurrentTier(tier)) return '立即续费'
  if (getTierSortOrder(tier) > Number(vipInfo.value.sortOrder || 0)) return '立即升级'
  return '立即开通'
}

/** 获取角标文案（当前等级显示"当前"） */
const getTierBadgeText = (tier: any) => {
  if (isCurrentTier(tier)) return '当前'
  return tier.badge || ''
}

/** 点击会员卡片按钮 */
const handleTierClick = (tier: any) => {
  if (tier?.is_virtual) return
  if (isTierDisabled(tier)) {
    showToast(`您当前是${vipInfo.value?.tierName}，该权益已包含在内`, 'warning')
    return
  }
  openPayment(tier)
}

const getPrice = (tierCode: string) => {
  const tier = tiers.value.find((t: any) => t.tier_code === tierCode)
  if (!tier || !tier.prices) return { current: '0.00', original: '0.00', monthEquivalent: '0.00' }
  const period = currentTab.value
  return tier.prices[period] || { current: '0.00', original: '0.00', monthEquivalent: '0.00' }
}

const getPeriodName = () => {
  const map: Record<string, string> = {
    month: '月',
    quarter: '季',
    year: '年'
  }
  return map[currentTab.value] || '月'
}

const getTierSummary = (tier: any) => {
  if (tier?.is_virtual) return '默认开放基础创作能力'
  if ((tier?.membership_level || tier?.tier_code) === 'advanced') {
    return '适合高频创作团队和长篇小说转剧本'
  }
  return '适合个人作者和中轻度创作需求'
}

/** 充值记录入口迁移到充值页，弱化顶部浮窗曝光感 */
const openPurchaseLog = () => {
  purchaseLogVisible.value = true
}

const closePurchaseLog = () => {
  purchaseLogVisible.value = false
}

/* =========== 支付弹窗相关 =========== */
/** 支付弹窗是否可见 */
const paymentVisible = ref(false)
/** 当前选中的会员等级名称 */
const paymentTierName = ref('')
/** 当前选中套餐的价格 */
const paymentPrice = ref('0.00')
/** 商品详情 */
const paymentProductDetail = ref<Record<string, any>>({})

/**
 * 打开支付弹窗
 * @param tier 会员等级对象
 */
const openPayment = (tier: any) => {
  const priceInfo = getPrice(tier.tier_code)
  const periodMap: Record<string, string> = { month: '包月', quarter: '包季', year: '包年' }
  const periodLabel = periodMap[currentTab.value] || '包月'
  paymentTierName.value = `${tier.name}(${periodLabel})`
  paymentPrice.value = priceInfo.current
  paymentProductDetail.value = {
    tierCode: tier.tier_code,
    planCode: currentTab.value,
    tierName: tier.name,
  }
  paymentVisible.value = true
}

/** 支付弹窗关闭回调 */
const onPaymentClose = () => {
  paymentVisible.value = false
}

/** 支付成功回调 */
const onPaymentSuccess = (orderNo: string) => {
  console.log('支付成功，订单号:', orderNo)
  /* 刷新用户VIP信息（充值页卡片） */
  fetchVipInfo()
  /* 刷新用户Store（会员状态等实时同步） */
  userStore.fetchUserInfo()
}
</script>

<style scoped>
/* =========== 容器 =========== */
.recharge-container {
  /* 移除100vh和渐变背景，适应作为页中页嵌入的情况 */
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background-color: var(--color-bg, #f6f8fc);
  padding: 32px 24px 60px;
}

/* =========== 主体 =========== */
.recharge-main {
  max-width: 1080px;
  margin: 0 auto;
}

/* =========== VIP状态卡片（升级版） =========== */
.vip-status-card {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 32px;
  border-radius: 16px;
  margin-bottom: 28px;
  overflow: hidden;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border: 1px solid rgba(217, 169, 56, 0.2);
}

/* 装饰光效层 */
.vip-status-card__glow {
  position: absolute;
  top: -50%;
  right: -20%;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%);
  pointer-events: none;
}

/* 装饰纹理层 */
.vip-status-card__pattern {
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
    120deg,
    transparent,
    transparent 40px,
    rgba(255,255,255,0.06) 40px,
    rgba(255,255,255,0.06) 42px
  );
  pointer-events: none;
}

/* --- 基础会员主题 --- */
.vip-status-card--basic {
  background: linear-gradient(135deg, #fef9e7 0%, #fde68a 50%, #f6d365 100%);
  border-color: rgba(217, 169, 56, 0.25);
  box-shadow: 0 4px 20px rgba(217, 169, 56, 0.12);
}
.vip-status-card--basic .vip-status-card__badge {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.35);
}
.vip-status-card--basic .vip-status-card__name { color: #92400e; }
.vip-status-card--basic .vip-status-card__label { color: #b45309; opacity: 0.5; }
.vip-status-card--basic .vip-status-card__expires { color: #a16207; }
.vip-status-card--basic .vip-status-card__days-num { color: #92400e; }
.vip-status-card--basic .vip-status-card__days-unit { color: #a16207; }
.vip-status-card--basic .vip-status-card__renew-btn {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: #fff;
  box-shadow: 0 3px 10px rgba(245, 158, 11, 0.3);
}
.vip-status-card--basic .vip-status-card__renew-btn:hover {
  box-shadow: 0 5px 16px rgba(245, 158, 11, 0.45);
}

/* --- 黑金主题 --- */
.vip-status-card--advanced {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%);
  border-color: rgba(212, 175, 55, 0.3);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.25);
}
.vip-status-card--advanced .vip-status-card__glow {
  background: radial-gradient(circle, rgba(212, 175, 55, 0.15) 0%, transparent 70%);
}
.vip-status-card--advanced .vip-status-card__pattern {
  background-image: repeating-linear-gradient(
    120deg,
    transparent,
    transparent 40px,
    rgba(212, 175, 55, 0.04) 40px,
    rgba(212, 175, 55, 0.04) 42px
  );
}
.vip-status-card--advanced .vip-status-card__badge {
  background: linear-gradient(135deg, #d4af37, #b8860b);
  box-shadow: 0 4px 12px rgba(212, 175, 55, 0.35);
}
.vip-status-card--advanced .vip-status-card__icon { color: #1a1a2e; }
.vip-status-card--advanced .vip-status-card__name { color: #d4af37; }
.vip-status-card--advanced .vip-status-card__label { color: #d4af37; opacity: 0.4; }
.vip-status-card--advanced .vip-status-card__expires { color: rgba(212, 175, 55, 0.7); }
.vip-status-card--advanced .vip-status-card__days-num { color: #d4af37; }
.vip-status-card--advanced .vip-status-card__days-unit { color: rgba(212, 175, 55, 0.7); }
.vip-status-card--advanced .vip-status-card__renew-btn {
  background: linear-gradient(135deg, #d4af37, #b8860b);
  color: #1a1a2e;
  font-weight: 700;
  box-shadow: 0 3px 10px rgba(212, 175, 55, 0.3);
}
.vip-status-card--advanced .vip-status-card__renew-btn:hover {
  box-shadow: 0 5px 16px rgba(212, 175, 55, 0.5);
}

/* --- 通用子元素 --- */
.vip-status-card__left {
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
  z-index: 1;
}

.vip-status-card__badge {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f59e0b, #d97706);
  flex-shrink: 0;
}

.vip-status-card__icon {
  color: #fff;
}

.vip-status-card__info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.vip-status-card__name-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.vip-status-card__name {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.5px;
}

.vip-status-card__label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
}

.vip-status-card__expires {
  font-size: 13px;
  display: flex;
  align-items: center;
}

.vip-status-card__right {
  display: flex;
  align-items: center;
  gap: 20px;
  position: relative;
  z-index: 1;
}

.vip-status-card__days {
  display: flex;
  align-items: baseline;
  gap: 2px;
  text-align: right;
}

.vip-status-card__days-num {
  font-size: 32px;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.vip-status-card__days-unit {
  font-size: 13px;
  font-weight: 600;
}

.vip-status-card__renew-btn {
  border: none;
  padding: 10px 22px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 4px;
}

.vip-status-card__renew-btn:hover {
  transform: translateY(-1px);
}

.vip-status-card__renew-btn:active {
  transform: translateY(0);
}

.recharge-hero {
  text-align: center;
  margin-bottom: 32px;
}

.recharge-hero__title {
  font-size: 2.2rem;
  font-weight: 800;
  color: var(--color-text, #333);
  margin-bottom: 8px;
  letter-spacing: 1px;
}

.recharge-hero__subtitle {
  font-size: 1rem;
  color: #666;
}

.recharge-tabs-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin: 0 auto 40px;
}

.recharge-tabs-row__action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 999px;
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.78);
  color: #64748b;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.recharge-tabs-row__action:hover {
  border-color: rgba(100, 116, 139, 0.38);
  background: rgba(255, 255, 255, 0.94);
  color: #334155;
}

.recharge-state-card {
  background: #fff;
  border-radius: 20px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
  padding: 40px 24px;
  margin: 0 auto 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}

.recharge-state-card--error {
  border-color: rgba(239, 68, 68, 0.16);
}

.recharge-state-card__icon {
  color: #64748b;
}

.recharge-state-card__icon--spin {
  animation: recharge-spin 0.9s linear infinite;
}

.recharge-state-card__text {
  margin: 0;
  font-size: 14px;
  color: #475569;
}

.recharge-state-card__retry {
  border: none;
  border-radius: 10px;
  padding: 10px 18px;
  background: #111;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

@keyframes recharge-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* =========== Tab 切换 =========== */
.recharge-tabs {
  display: flex;
  justify-content: center;
  gap: 8px;
  background: #fff;
  padding: 6px;
  border-radius: 40px;
  width: fit-content;
  box-shadow: 0 4px 15px rgba(0,0,0,0.03);
  border: 1px solid rgba(0,0,0,0.04);
}

.recharge-tabs__item {
  position: relative;
  border: none;
  background: transparent;
  padding: 10px 28px;
  border-radius: 30px;
  font-size: 1rem;
  font-weight: 500;
  color: #666;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.recharge-tabs__item:hover {
  color: #333;
}

.recharge-tabs__item--active {
  background: #111;
  color: #fff;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
.recharge-tabs__item--active:hover {
  color: #fff;
}

.recharge-tabs__tag {
  position: absolute;
  top: -8px;
  right: -8px;
  background: linear-gradient(90deg, #ff6b35, #ff3b3b);
  color: #fff;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 8px 8px 8px 0;
  font-weight: bold;
  box-shadow: 0 2px 4px rgba(255, 59, 59, 0.2);
}

/* =========== 会员卡片 Grid =========== */
.membership-cards {
  display: grid;
  /* 由原本4列改为3列，因为去掉了非会员卡片 */
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  align-items: stretch;
}

.membership-card {
  position: relative;
  background: #fff;
  border-radius: 20px;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 16px rgba(0,0,0,0.03);
  border: 1px solid rgba(0,0,0,0.06);
  overflow: hidden;
}

.membership-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 16px 32px rgba(0,0,0,0.06);
}

/* 各等级主题色定义 */
.membership-card--free { border-top: 6px solid #94a3b8; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); }
.membership-card--free:hover { border-color: #94a3b8; }

.membership-card--basic { border-top: 6px solid #ffca28; }
.membership-card--basic:hover { border-color: #ffb300; }

.membership-card--advanced { border-top: 6px solid #212121; background: linear-gradient(180deg, #ffffff 0%, #fffcf5 100%); }
.membership-card--advanced:hover { border-color: #000; }

.membership-card__badge {
  position: absolute;
  top: 0;
  right: 0;
  background: #ff6b35;
  color: #fff;
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 0 14px 0 10px;
  font-weight: bold;
}
.membership-card--advanced .membership-card__badge {
  background: linear-gradient(90deg, #d4af37, #f3e5f5);
  color: #333;
}

.membership-card__header {
  margin-bottom: 24px;
  border-bottom: 1px solid rgba(0,0,0,0.04);
  padding-bottom: 24px;
}

.membership-card__title {
  font-size: 1.4rem;
  font-weight: 700;
  margin: 0 0 16px 0;
}

.membership-card__price-box {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 8px;
}

.membership-card__price {
  font-size: 2.5rem;
  font-weight: 800;
  line-height: 1;
}

.membership-card__price-box--free .membership-card__price {
  font-size: 2rem;
}

.membership-card__unit {
  font-size: 0.9rem;
  color: #666;
}

.membership-card__original {
  font-size: 0.9rem;
  color: #999;
  text-decoration: line-through;
  margin-left: 8px;
}

.membership-card__desc {
  font-size: 0.85rem;
  color: #888;
  margin: 0;
}

.membership-card__body {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.membership-card__summary {
  background: rgba(0,0,0,0.02);
  padding: 12px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.95rem;
  margin-bottom: 24px;
  line-height: 1.6;
}

/* 按钮样式 */
.membership-btn {
  width: 100%;
  padding: 14px;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  border: none;
  transition: all 0.3s;
  margin-bottom: 24px;
}

.membership-btn--free {
  background: #e2e8f0;
  color: #475569;
  box-shadow: none;
}
.membership-btn--free:hover {
  box-shadow: none;
  background: #e2e8f0;
}

.membership-btn--basic {
  background: linear-gradient(99deg, #31c47a 3%, #80d943 98%, #abe425 149%);
  color: #fff;
  box-shadow: 0 4px 15px rgba(34, 197, 94, 0.25);
}
.membership-btn--basic:hover {
  box-shadow: 0 6px 20px rgba(34, 197, 94, 0.35);
  background: linear-gradient(99deg, #31c47a 3%, #80d943 98%, #abe425 149%);
  opacity: .8;
}

.membership-btn--advanced {
  background: linear-gradient(82deg, #37373733 1%, #fff1e133), #000;
  color: #fff;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.25);
}
.membership-btn--advanced:hover {
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  background: linear-gradient(82deg, #37373733 1%, #fff1e133), #000;
  opacity: .8;
}

/* 禁用按钮（高等级会员不能买低等级） */
.membership-btn--disabled {
  background: #e5e7eb !important;
  color: #9ca3af !important;
  cursor: not-allowed !important;
  box-shadow: none !important;
  opacity: 1 !important;
}

.membership-btn--disabled:hover {
  transform: none !important;
  box-shadow: none !important;
}

/* 已超越的低等级卡片置灰 */
.membership-card--surpassed {
  opacity: 0.55;
  filter: grayscale(0.4);
  pointer-events: auto;
}

.membership-card--surpassed:hover {
  transform: none;
  box-shadow: 0 4px 16px rgba(0,0,0,0.03);
}

.membership-card__surpassed-tag {
  position: absolute;
  top: 0;
  right: 0;
  background: linear-gradient(135deg, #9ca3af, #6b7280);
  color: #fff;
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 0 14px 0 10px;
  font-weight: bold;
  z-index: 2;
}

/* 当前等级卡片高亮边框 */
.membership-card--current {
  border: 2px solid #f59e0b;
  position: relative;
}

/* 权益列表 */
.membership-card__features {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
}

.membership-card__features li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 0.9rem;
  color: #555;
  line-height: 1.5;
}

.membership-card__features :deep(.color-gold) {
  color: #b78a28;
}

.membership-card__features :deep(.icon-check) {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: #22c55e;
  stroke-width: 3;
  flex-shrink: 0;
  margin-top: 3px;
}

.membership-card__features :deep(.icon-dot) {
  width: 18px;
  height: 18px;
  fill: #ccc;
  flex-shrink: 0;
  margin-top: 3px;
}

.membership-card--advanced .membership-card__features :deep(.icon-check) { stroke: #d4af37; }

.membership-card__features :deep(.text-highlight) {
  color: #22c55e;
  font-weight: 600;
}
.membership-card--advanced .membership-card__features :deep(.text-highlight) { color: #d4af37; }

/* =========== 响应式适配 =========== */
@media (max-width: 1024px) {
  .membership-cards {
    /* 平板端调整为按情况显示，如果太挤就改为2列 */
    gap: 16px;
  }
}

@media (max-width: 860px) {
  .membership-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .recharge-hero__title {
    font-size: 1.8rem;
  }
  .recharge-tabs-row {
    flex-direction: column;
    gap: 12px;
    margin-bottom: 24px;
  }
  .recharge-tabs {
    flex-wrap: wrap;
    border-radius: 16px;
    padding: 8px;
  }
  .recharge-tabs__item {
    padding: 8px 16px;
    font-size: 0.95rem;
  }
  .membership-cards {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  .vip-status-card {
    flex-direction: column;
    gap: 16px;
    text-align: center;
    padding: 20px;
  }
  .vip-status-card__left {
    justify-content: center;
  }
  .vip-status-card__right {
    justify-content: center;
  }
}

</style>
