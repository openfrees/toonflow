<template>
  <Teleport to="body">
    <Transition name="payment-fade">
      <div v-if="visible" class="payment-overlay" @click.self="handleClose">
        <Transition name="payment-zoom">
          <div v-if="visible" class="payment-dialog">
            <!-- 标题区域 -->
            <div class="payment-dialog__header">
              <h3 class="payment-dialog__title">{{ tierName }}</h3>
              <button class="payment-dialog__close" @click="handleClose">
                <Icon name="lucide:x" size="20" />
              </button>
            </div>

            <!-- 支付方式选择（微信支付暂未上线，隐藏入口） -->
            <div class="payment-methods">
              <label
                class="payment-method"
                :class="{ 'payment-method--active': payMethod === 'alipay' }"
                @click="switchPayMethod('alipay')"
              >
                <span class="payment-method__radio">
                  <span class="payment-method__radio-inner"></span>
                </span>
                <span class="payment-method__label">支付宝支付</span>
              </label>
            </div>

            <!-- 支付金额信息 -->
            <div class="payment-info">
              <span class="payment-info__text">{{ payMethodLabel }}扫码支付</span>
              <span class="payment-info__price" :class="priceColorClass">{{ price }}</span>
              <span class="payment-info__unit">元</span>
            </div>

            <!-- 支付按钮区域 -->
            <div class="payment-action">
              <div class="payment-action__wrapper">
                <!-- 加载中 -->
                <div v-if="payFormLoading" class="payment-action__loading">
                  <div class="payment-action__spinner"></div>
                  <span>正在准备支付...</span>
                </div>
                <!-- 支付成功 -->
                <div v-else-if="payStatus === 'success'" class="payment-action__success">
                  <Icon name="lucide:circle-check" size="64" color="#22c55e" />
                  <span class="payment-action__success-text">支付成功！</span>
                  <span class="payment-action__success-detail">{{ tierName }} 已生效</span>
                  <button class="payment-action__done-btn" @click="handleClose">确定</button>
                </div>
                <!-- 等待支付确认（跳转支付宝后） -->
                <div v-else-if="payStatus === 'waiting'" class="payment-action__waiting">
                  <div class="payment-action__waiting-icon">
                    <div class="payment-action__pulse"></div>
                  </div>
                  <span class="payment-action__waiting-text">请在支付宝页面完成支付</span>
                  <button class="payment-action__confirm-btn" :class="{ 'is-loading': queryLoading }" @click="handleConfirmPaid" :disabled="queryLoading">
                    <span v-if="queryLoading">查询中...</span>
                    <span v-else>我已完成支付</span>
                  </button>
                  <button class="payment-action__repay-link" @click="handleRepay">遇到问题？重新支付</button>
                </div>
                <!-- 错误状态 -->
                <div v-else-if="payFormError" class="payment-action__error">
                  <span>{{ payFormError }}</span>
                  <button class="payment-action__retry" @click="createOrder">重新获取</button>
                </div>
                <!-- 支付按钮 -->
                <button v-else-if="currentOrderNo" class="payment-action__button" :class="`payment-action__button--${payMethod}`" @click="handlePayClick">
                  <Icon name="lucide:wallet" size="20" />
                  <span>立即支付 {{ price }} 元</span>
                </button>
                <!-- 占位 -->
                <div v-else class="payment-action__placeholder">
                  <span>请选择支付方式</span>
                </div>
              </div>
            </div>

            <!-- 提示文字 -->
            <p v-if="payStatus === 'success'" class="payment-tip payment-tip--success">
              <Icon name="lucide:party-popper" size="16" style="vertical-align: middle; margin-right: 4px;" />充值成功，感谢您的支持！
            </p>
            <p v-else-if="payStatus === 'waiting'" class="payment-tip payment-tip--waiting">
              支付完成后请点击「我已完成支付」，系统将自动确认
            </p>
            <p v-else-if="payStatus === 'expired'" class="payment-tip payment-tip--expired">
              订单已过期，请重新发起支付
            </p>
            <p v-else class="payment-tip" :class="tipColorClass">
              点击按钮将跳转到{{ payMethodLabel }}收银台完成支付
            </p>

            <!-- 服务条款 -->
            <p class="payment-agreement">
              支付即视作您已阅读并同意
              <span class="payment-agreement__link" :class="linkColorClass" @click="handleShowTerms">《知剧AI服务条款》</span>
            </p>

            <!-- 服务条款弹窗 -->
            <TermsModal v-model:visible="showTermsModal" />
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * 支付弹窗组件
 * 支持支付宝电脑网站支付（跳转到支付宝收银台）
 */
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import TermsModal from './TermsModal.vue'
const { showToast } = useToast()

const props = defineProps({
  /** 弹窗是否可见 */
  visible: { type: Boolean, default: false },
  /** 会员等级名称，如 "黄金会员" */
  tierName: { type: String, default: '' },
  /** 支付金额 */
  price: { type: [String, Number], default: '0.00' },
  /** 商品详情(JSON对象，透传给后端) */
  productDetail: { type: Object, default: () => ({}) },
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'close'): void
  (e: 'success', orderNo: string): void
}>()

const API_BASE = useRuntimeConfig().public.apiBase

/** 当前选中的支付方式 */
const payMethod = ref<'wechat' | 'alipay'>('alipay')

/** 支付表单相关状态 */
const payFormLoading = ref(false)
const payFormHtml = ref('')
const payFormError = ref('')

/** 当前订单号 */
const currentOrderNo = ref('')

/** 支付状态: idle / pending / waiting / success / expired */
const payStatus = ref<'idle' | 'pending' | 'waiting' | 'success' | 'expired'>('idle')

/** 轮询定时器ID */
let pollTimer: ReturnType<typeof setInterval> | null = null

/** "我已完成支付"按钮加载状态 */
const queryLoading = ref(false)

/** 服务条款弹窗显示状态 */
const showTermsModal = ref(false)

/** 显示服务条款弹窗 */
const handleShowTerms = () => {
  console.log('点击了服务条款')
  showTermsModal.value = true
  console.log('showTermsModal.value:', showTermsModal.value)
}

/** 支付方式中文标签 */
const payMethodLabel = computed(() => {
  return payMethod.value === 'wechat' ? '微信' : '支付宝'
})

/** 价格颜色样式类 */
const priceColorClass = computed(() => {
  return payMethod.value === 'wechat' ? 'payment-info__price--wechat' : 'payment-info__price--alipay'
})

/** 提示文字颜色样式类 */
const tipColorClass = computed(() => {
  return payMethod.value === 'wechat' ? 'payment-tip--wechat' : 'payment-tip--alipay'
})

/** 链接颜色样式类 */
const linkColorClass = computed(() => {
  return payMethod.value === 'wechat' ? 'payment-agreement__link--wechat' : 'payment-agreement__link--alipay'
})

/**
 * 获取用户Token
 */
function getToken(): string {
  if (import.meta.client) {
    return localStorage.getItem('token') || ''
  }
  return ''
}

/**
 * 创建充值订单 → 获取支付表单 → 开始轮询
 */
async function createOrder() {
  if (payMethod.value !== 'alipay') {
    payFormError.value = '微信支付即将上线，请先使用支付宝'
    return
  }

  payFormLoading.value = true
  payFormError.value = ''
  payFormHtml.value = ''
  payStatus.value = 'pending'

  try {
    const token = getToken()
    if (!token) {
      payFormError.value = '请先登录后再充值'
      payFormLoading.value = false
      payStatus.value = 'idle'
      return
    }

    const res: any = await $fetch(`${API_BASE}/api/payment/create`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        orderType: 'vip',
        payMethod: payMethod.value,
        productDetail: props.productDetail,
      },
    })

    if (res.code !== 200 || !res.data) {
      payFormError.value = res.message || '创建订单失败'
      payFormLoading.value = false
      payStatus.value = 'idle'
      return
    }

    const { orderNo, payFormHtml: formHtml } = res.data
    currentOrderNo.value = orderNo
    payFormHtml.value = formHtml

    if (!formHtml) {
      payFormError.value = '未获取到支付表单，请检查支付宝配置'
      payStatus.value = 'idle'
    }

    /* 开始轮询订单状态 */
    startPolling()
  } catch (err: any) {
    console.error('[创建订单失败]', err)
    payFormError.value = err?.data?.message || err?.message || '网络错误，请重试'
    payStatus.value = 'idle'
  } finally {
    payFormLoading.value = false
  }
}

/**
 * 处理支付按钮点击 - 提交表单跳转到支付宝
 */
function handlePayClick() {
  if (!payFormHtml.value) {
    payFormError.value = '支付表单未生成，请重试'
    return
  }

  /* 创建临时div并插入表单HTML */
  const div = document.createElement('div')
  div.innerHTML = payFormHtml.value
  document.body.appendChild(div)

  /* 查找表单并在新窗口提交（不替换当前页面） */
  const form = div.querySelector('form')
  if (form) {
    form.setAttribute('target', '_blank')
    form.submit()
    /* 跳转支付宝后，切换到等待支付确认状态 */
    payStatus.value = 'waiting'
  } else {
    payFormError.value = '支付表单格式错误'
  }

  /* 清理临时div */
  setTimeout(() => {
    document.body.removeChild(div)
  }, 100)
}

/**
 * 用户点击"我已完成支付" → 主动查询一次订单状态
 */
async function handleConfirmPaid() {
  if (!currentOrderNo.value) return

  queryLoading.value = true
  try {
    const token = getToken()
    if (!token) return

    const res: any = await $fetch(`${API_BASE}/api/payment/query`, {
      params: { orderNo: currentOrderNo.value },
      headers: { Authorization: `Bearer ${token}` },
    })

    if (res.code === 200 && res.data) {
      const { status } = res.data
      if (status === 1) {
        stopPolling()
        payStatus.value = 'success'
        emit('success', currentOrderNo.value)
      } else if (status === 2) {
        stopPolling()
        payStatus.value = 'expired'
      } else {
        /* 还没支付成功，提示用户 */
        showToast('暂未检测到支付结果，请稍后再试或在支付宝完成支付', 'warning')
      }
    }
  } catch (err) {
    console.warn('[查询支付结果失败]', err)
    showToast('查询失败，请稍后再试', 'error')
  } finally {
    queryLoading.value = false
  }
}

/**
 * 用户点击"遇到问题？重新支付" → 重新创建订单
 */
function handleRepay() {
  stopPolling()
  payStatus.value = 'idle'
  currentOrderNo.value = ''
  payFormHtml.value = ''
  payFormError.value = ''
  createOrder()
}

/**
 * 开始轮询查询订单状态
 * 每3秒查询一次，最多轮询300次（15分钟）
 */
function startPolling() {
  stopPolling()
  let pollCount = 0
  const maxPoll = 300 // 15分钟 / 3秒 = 300次

  pollTimer = setInterval(async () => {
    pollCount++

    if (pollCount > maxPoll) {
      stopPolling()
      payStatus.value = 'expired'
      return
    }

    try {
      const token = getToken()
      if (!token || !currentOrderNo.value) return

      const res: any = await $fetch(`${API_BASE}/api/payment/query`, {
        params: { orderNo: currentOrderNo.value },
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.code === 200 && res.data) {
        const { status } = res.data

        if (status === 1) {
          /* 支付成功 */
          stopPolling()
          payStatus.value = 'success'
          emit('success', currentOrderNo.value)
        } else if (status === 2) {
          /* 订单已过期 */
          stopPolling()
          payStatus.value = 'expired'
        }
      }
    } catch (err) {
      /* 查询失败不中断轮询，静默重试 */
      console.warn('[轮询查询失败]', err)
    }
  }, 3000)
}

/**
 * 停止轮询
 */
function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

/**
 * 切换支付方式
 */
function switchPayMethod(method: 'wechat' | 'alipay') {
  if (method === payMethod.value) return
  payMethod.value = method
  stopPolling()
  payFormHtml.value = ''
  payFormError.value = ''
  payStatus.value = 'idle'
  currentOrderNo.value = ''

  /* 自动请求新支付方式的支付表单 */
  if (method === 'alipay') {
    createOrder()
  } else {
    payFormError.value = '微信支付即将上线，请先使用支付宝'
  }
}

/** 关闭弹窗 */
const handleClose = () => {
  stopPolling()
  emit('update:visible', false)
  emit('close')

  /* 重置状态（延迟重置，避免关闭动画期间闪烁） */
  setTimeout(() => {
    payFormHtml.value = ''
    payFormError.value = ''
    currentOrderNo.value = ''
    payStatus.value = 'idle'
    payFormLoading.value = false
    queryLoading.value = false
  }, 300)
}

/**
 * 监听弹窗打开 → 自动创建订单
 */
watch(() => props.visible, (newVal) => {
  if (newVal && payMethod.value === 'alipay') {
    createOrder()
  }
  if (!newVal) {
    stopPolling()
  }
})

/** 组件销毁时清理定时器 */
onBeforeUnmount(() => {
  stopPolling()
})
</script>

<style scoped>
/* =========== 蒙层 =========== */
.payment-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
}

/* =========== 弹窗主体 =========== */
.payment-dialog {
  background: #fff;
  border-radius: 16px;
  padding: 36px 40px 28px;
  width: 420px;
  max-width: 92vw;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
  position: relative;
}

/* =========== 头部标题 =========== */
.payment-dialog__header {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-bottom: 28px;
  border-width: 0;
  border-color: rgb(229 231 235);
  border-bottom-width: 1px;
  border-style: solid;
  padding-bottom: 15px;
}

.payment-dialog__title {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
  letter-spacing: 0.5px;
}

.payment-dialog__close {
  position: absolute;
  right: -8px;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #999;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.payment-dialog__close:hover {
  background: #f5f5f5;
  color: #333;
}

/* =========== 支付方式切换 =========== */
.payment-methods {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 40px;
  margin-bottom: 28px;
}

.payment-method {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s;
  position: relative;
}

.payment-method__radio {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid #d9d9d9;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.25s;
  flex-shrink: 0;
}

.payment-method__radio-inner {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: transparent;
  transition: all 0.25s;
  transform: scale(0);
}

/* 微信支付选中态 - 绿色 */
.payment-method--active .payment-method__radio {
  border-color: #22c55e;
}

.payment-method--active .payment-method__radio-inner {
  background: #22c55e;
  transform: scale(1);
}

/* 支付宝选中态 - 蓝色 */
.payment-method--active:last-child .payment-method__radio {
  border-color: #1677ff;
}

.payment-method--active:last-child .payment-method__radio-inner {
  background: #1677ff;
}

.payment-method__label {
  font-size: 15px;
  color: #333;
  font-weight: 500;
}

/* 微信支付「即将上线」标签 */
.payment-method__badge {
  position: absolute;
  top: -10px;
  right: -14px;
  background: linear-gradient(90deg, #ff6b35, #ff3b3b);
  color: #fff;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 6px;
  font-weight: bold;
  white-space: nowrap;
}

/* =========== 支付金额信息 =========== */
.payment-info {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 6px;
  margin-bottom: 24px;
}

.payment-info__text {
  font-size: 18px;
  color: #333;
  font-weight: 500;
}

.payment-info__price {
  font-size: 32px;
  font-weight: 800;
  line-height: 1;
}

.payment-info__price--wechat {
  color: #22c55e;
}

.payment-info__price--alipay {
  color: #1677ff;
}

.payment-info__unit {
  font-size: 18px;
  color: #333;
  font-weight: 500;
}

/* =========== 支付按钮区域 =========== */
.payment-action {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}

.payment-action__wrapper {
  width: 100%;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 加载动画 */
.payment-action__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #999;
  font-size: 13px;
}

.payment-action__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #eee;
  border-top-color: #1677ff;
  border-radius: 50%;
  animation: action-spin 0.8s linear infinite;
}

@keyframes action-spin {
  to { transform: rotate(360deg); }
}

/* 支付成功 */
.payment-action__success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.payment-action__success-text {
  color: #22c55e;
  font-size: 16px;
  font-weight: 600;
}

.payment-action__success-detail {
  color: #666;
  font-size: 14px;
}

.payment-action__done-btn {
  margin-top: 4px;
  padding: 10px 48px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.payment-action__done-btn:hover {
  background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
}

/* 等待支付确认 */
.payment-action__waiting {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.payment-action__waiting-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.payment-action__pulse {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #1677ff;
  animation: pulse-ring 1.5s ease-in-out infinite;
}

@keyframes pulse-ring {
  0% { transform: scale(0.8); opacity: 1; box-shadow: 0 0 0 0 rgba(22, 119, 255, 0.5); }
  70% { transform: scale(1); opacity: 0.8; box-shadow: 0 0 0 16px rgba(22, 119, 255, 0); }
  100% { transform: scale(0.8); opacity: 1; box-shadow: 0 0 0 0 rgba(22, 119, 255, 0); }
}

.payment-action__waiting-text {
  color: #333;
  font-size: 15px;
  font-weight: 500;
}

.payment-action__confirm-btn {
  padding: 10px 36px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #1677ff 0%, #0958d9 100%);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.payment-action__confirm-btn:hover {
  background: linear-gradient(135deg, #0958d9 0%, #003eb3 100%);
  box-shadow: 0 4px 12px rgba(22, 119, 255, 0.3);
}

.payment-action__confirm-btn.is-loading {
  opacity: 0.7;
  cursor: not-allowed;
}

.payment-action__repay-link {
  border: none;
  background: transparent;
  color: #999;
  font-size: 13px;
  cursor: pointer;
  text-decoration: underline;
  transition: color 0.2s;
}

.payment-action__repay-link:hover {
  color: #666;
}

/* 错误状态 */
.payment-action__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: #ff4d4f;
  font-size: 13px;
  text-align: center;
  padding: 0 8px;
}

.payment-action__retry {
  border: 1px solid #1677ff;
  background: transparent;
  color: #1677ff;
  padding: 6px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
  font-weight: 500;
}

.payment-action__retry:hover {
  background: #1677ff;
  color: #fff;
}

/* 支付按钮 */
.payment-action__button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 32px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.payment-action__button--wechat {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
}

.payment-action__button--wechat:hover {
  background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
  box-shadow: 0 6px 16px rgba(34, 197, 94, 0.4);
  transform: translateY(-2px);
}

.payment-action__button--alipay {
  background: linear-gradient(135deg, #1677ff 0%, #0958d9 100%);
}

.payment-action__button--alipay:hover {
  background: linear-gradient(135deg, #0958d9 0%, #003eb3 100%);
  box-shadow: 0 6px 16px rgba(22, 119, 255, 0.4);
  transform: translateY(-2px);
}

.payment-action__button:active {
  transform: translateY(0);
}

/* 占位 */
.payment-action__placeholder {
  color: #ccc;
  font-size: 14px;
}

/* =========== 提示文字 =========== */
.payment-tip {
  font-size: 13px;
  margin: 0 0 16px;
  font-weight: 500;
}

.payment-tip--wechat {
  color: #22c55e;
}

.payment-tip--alipay {
  color: #1677ff;
}

.payment-tip--success {
  color: #22c55e;
  font-size: 15px;
}

.payment-tip--waiting {
  color: #1677ff;
}

.payment-tip--expired {
  color: #ff4d4f;
}

/* =========== 服务条款 =========== */
.payment-agreement {
  font-size: 12px;
  color: #999;
  margin: 0;
  line-height: 1.6;
}

.payment-agreement__link {
  text-decoration: none;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.payment-agreement__link--wechat {
  color: #22c55e;
}

.payment-agreement__link--alipay {
  color: #1677ff;
}

.payment-agreement__link:hover {
  text-decoration: underline;
  opacity: 0.8;
}

/* =========== 弹窗进出动画 =========== */
.payment-fade-enter-active,
.payment-fade-leave-active {
  transition: opacity 0.25s ease;
}
.payment-fade-enter-from,
.payment-fade-leave-to {
  opacity: 0;
}

.payment-zoom-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.payment-zoom-leave-active {
  transition: all 0.18s ease-in;
}
.payment-zoom-enter-from {
  opacity: 0;
  transform: scale(0.85);
}
.payment-zoom-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* =========== 响应式适配 =========== */
@media (max-width: 480px) {
  .payment-dialog {
    padding: 28px 20px 20px;
    width: 92vw;
  }

  .payment-methods {
    gap: 24px;
  }

  .payment-info__price {
    font-size: 26px;
  }

  .payment-qrcode__wrapper {
    width: 180px;
    height: 180px;
  }
}
</style>
