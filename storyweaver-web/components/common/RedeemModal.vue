<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="visible" class="redeem-modal__overlay" @click.self="handleClose">
        <div class="redeem-modal">
          <!-- 关闭按钮 -->
          <button class="redeem-modal__close" @click="handleClose">✕</button>

          <!-- 顶部渐变头部 -->
          <div class="redeem-modal__header">
            <div class="redeem-modal__header-content">
              <Icon name="lucide:ticket" class="redeem-modal__header-icon" size="36" />
              <div class="redeem-modal__header-text">
                <span class="redeem-modal__header-title">兑换码</span>
                <span class="redeem-modal__header-desc">输入兑换码完成兑换</span>
              </div>
            </div>
          </div>

          <!-- 主体内容 -->
          <div class="redeem-modal__body">
            <!-- 输入框 -->
            <div class="redeem-modal__input-group">
              <label class="redeem-modal__label">兑换码</label>
              <div
                :class="['redeem-modal__input-wrapper', { 'redeem-modal__input-wrapper--error': !!errorMsg }]"
              >
                <input
                  ref="inputRef"
                  v-model="redeemCode"
                  type="text"
                  class="redeem-modal__input"
                  placeholder="请输入兑换码"
                  maxlength="32"
                  @keyup.enter="handleRedeem"
                  @input="clearResult"
                />
                <!-- 清空按钮 -->
                <button
                  v-if="redeemCode"
                  class="redeem-modal__clear-btn"
                  @click="handleClear"
                >
                  <Icon name="lucide:circle-x" size="16" />
                </button>
              </div>
            </div>

            <!-- 兑换按钮 -->
            <button
              class="redeem-modal__submit"
              :disabled="!redeemCode.trim() || loading"
              @click="handleRedeem"
            >
              <span v-if="loading" class="redeem-modal__spinner"></span>
              {{ loading ? '兑换中...' : '立即兑换' }}
            </button>

            <!-- 结果提示 -->
            <Transition name="result-fade">
              <div v-if="resultType" :class="['redeem-modal__result', `redeem-modal__result--${resultType}`]">
                <span class="redeem-modal__result-icon">
                  <Icon :name="resultType === 'success' ? 'lucide:circle-check' : 'lucide:circle-x'" size="18" />
                </span>
                <span class="redeem-modal__result-text">{{ resultMsg }}</span>
              </div>
            </Transition>

            <!-- 提示说明 -->
            <div class="redeem-modal__tips">
              <div class="redeem-modal__tips-title">温馨提示</div>
              <ul class="redeem-modal__tips-list">
                <li>兑换码不区分大小写</li>
                <li>每个兑换码仅可使用一次</li>
                <li>兑换成功后权益将尽快生效</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
/**
 * 兑换码弹窗组件
 * 用户输入兑换码完成兑换，对接后端 API
 */
const { useApi } = await import('~/composables/useApi.js')
const { post } = useApi()

const props = defineProps({
  /** 是否可见 */
  visible: Boolean,
})
const emit = defineEmits(['close', 'success'])

/** 输入框引用 */
const inputRef = ref(null)

/** 兑换码 */
const redeemCode = ref('')

/** 加载状态 */
const loading = ref(false)

/** 结果类型：success / error / null */
const resultType = ref(null)

/** 结果消息 */
const resultMsg = ref('')

/** 错误消息（输入框红框） */
const errorMsg = ref('')

/** 关闭弹窗 */
const handleClose = () => {
  resetState()
  emit('close')
}

/** 清空输入 */
const handleClear = () => {
  redeemCode.value = ''
  resultType.value = null
  resultMsg.value = ''
  errorMsg.value = ''
  inputRef.value?.focus()
}

/** 清除结果提示 */
const clearResult = () => {
  if (resultType.value) {
    resultType.value = null
    resultMsg.value = ''
  }
  if (errorMsg.value) {
    errorMsg.value = ''
  }
}

/** 重置所有状态 */
const resetState = () => {
  redeemCode.value = ''
  loading.value = false
  resultType.value = null
  resultMsg.value = ''
  errorMsg.value = ''
}

/** 兑换操作 - 调用后端API */
const handleRedeem = async () => {
  const code = redeemCode.value.trim()
  if (!code) {
    errorMsg.value = '请输入兑换码'
    return
  }
  if (loading.value) return

  loading.value = true
  resultType.value = null

  try {
    const res = await post('/api/redeem/use', { code })
    if (res.code === 200) {
      resultType.value = 'success'
      resultMsg.value = '兑换成功！权益已生效'
      errorMsg.value = ''
      emit('success', res.data)
    } else {
      resultType.value = 'error'
      resultMsg.value = res.message || '兑换失败'
      errorMsg.value = res.message || '兑换失败'
    }
  } catch (err) {
    resultType.value = 'error'
    resultMsg.value = err.message || '兑换失败，请稍后重试'
    errorMsg.value = err.message || '兑换失败'
  }

  loading.value = false
}

/** 弹窗打开时自动聚焦输入框 */
watch(() => props.visible, (val) => {
  if (val) {
    resetState()
    nextTick(() => {
      inputRef.value?.focus()
    })
  }
})
</script>

<style scoped>
/* ========== 遮罩层 ========== */
.redeem-modal__overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(4px);
}

/* ========== 弹窗主体 ========== */
.redeem-modal {
  width: 420px;
  background: var(--color-bg-white, #fff);
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* ========== 关闭按钮 ========== */
.redeem-modal__close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
  z-index: 10;
  border: none;
}

.redeem-modal__close:hover {
  background: rgba(255, 255, 255, 0.4);
}

/* ========== 顶部渐变头部 ========== */
.redeem-modal__header {
  background: linear-gradient(135deg, #6366f1, #a855f7, #ec4899);
  padding: 32px 28px 24px;
  position: relative;
  overflow: hidden;
}

/* 装饰光斑 */
.redeem-modal__header::before {
  content: '';
  position: absolute;
  top: -40px;
  right: -40px;
  width: 140px;
  height: 140px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 50%;
  filter: blur(20px);
}

.redeem-modal__header::after {
  content: '';
  position: absolute;
  bottom: -30px;
  left: -20px;
  width: 100px;
  height: 100px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 50%;
  filter: blur(18px);
}

.redeem-modal__header-content {
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
  z-index: 1;
}

.redeem-modal__header-icon {
  color: #fff;
}

.redeem-modal__header-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.redeem-modal__header-title {
  font-size: 1.4rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: 1px;
}

.redeem-modal__header-desc {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.8);
}

/* ========== 主体内容 ========== */
.redeem-modal__body {
  padding: 28px;
}

/* ========== 输入框 ========== */
.redeem-modal__input-group {
  margin-bottom: 20px;
}

.redeem-modal__label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text, #333);
  margin-bottom: 8px;
}

.redeem-modal__input-wrapper {
  display: flex;
  align-items: center;
  height: 48px;
  border: 1.5px solid var(--color-border, #e5e5e5);
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s;
  background: var(--color-bg-white, #fff);
}

.redeem-modal__input-wrapper:focus-within {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.redeem-modal__input-wrapper--error {
  border-color: var(--color-danger, #ef4444);
}

.redeem-modal__input-wrapper--error:focus-within {
  border-color: var(--color-danger, #ef4444);
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.redeem-modal__input {
  flex: 1;
  height: 100%;
  padding: 0 16px;
  font-size: 0.95rem;
  color: var(--color-text, #333);
  border: none;
  outline: none;
  background: transparent;
  letter-spacing: 1px;
  font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
}

.redeem-modal__input::placeholder {
  color: var(--color-text-light, #bbb);
  letter-spacing: 0;
  font-family: inherit;
}

/* 清空按钮 */
.redeem-modal__clear-btn {
  width: 36px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--color-text-light, #bbb);
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.2s;
}

.redeem-modal__clear-btn:hover {
  color: var(--color-text-secondary, #999);
}

/* ========== 兑换按钮 ========== */
.redeem-modal__submit {
  width: 100%;
  height: 48px;
  background: linear-gradient(135deg, #6366f1, #a855f7);
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.redeem-modal__submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.45);
}

.redeem-modal__submit:active:not(:disabled) {
  transform: translateY(0);
}

.redeem-modal__submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* 加载动画 */
.redeem-modal__spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: redeem-spin 0.6s linear infinite;
}

@keyframes redeem-spin {
  to { transform: rotate(360deg); }
}

/* ========== 结果提示 ========== */
.redeem-modal__result {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  margin-top: 16px;
  border-radius: 10px;
  font-size: 0.88rem;
  font-weight: 500;
}

.redeem-modal__result--success {
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.2);
  color: #16a34a;
}

.redeem-modal__result--error {
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.redeem-modal__result-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.redeem-modal__result-text {
  line-height: 1.4;
}

/* ========== 提示说明 ========== */
.redeem-modal__tips {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--color-border-light, #f2f3f7);
}

.redeem-modal__tips-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-secondary, #999);
  margin-bottom: 8px;
}

.redeem-modal__tips-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.redeem-modal__tips-list li {
  font-size: 0.78rem;
  color: var(--color-text-light, #b0b0be);
  padding-left: 14px;
  position: relative;
}

.redeem-modal__tips-list li::before {
  content: '·';
  position: absolute;
  left: 2px;
  font-weight: 700;
  color: var(--color-text-light, #b0b0be);
}

/* ========== 弹窗动画 ========== */
.modal-fade-enter-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-fade-leave-active {
  transition: all 0.2s ease-in;
}

.modal-fade-enter-from {
  opacity: 0;
}

.modal-fade-enter-from .redeem-modal {
  transform: scale(0.92) translateY(20px);
  opacity: 0;
}

.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-leave-to .redeem-modal {
  transform: scale(0.96) translateY(10px);
  opacity: 0;
}

/* 结果提示动画 */
.result-fade-enter-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.result-fade-leave-active {
  transition: all 0.2s ease-in;
}

.result-fade-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.result-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ========== 响应式 ========== */
@media (max-width: 480px) {
  .redeem-modal {
    width: calc(100vw - 32px);
  }

  .redeem-modal__header {
    padding: 24px 20px 20px;
  }

  .redeem-modal__body {
    padding: 20px;
  }
}
</style>
