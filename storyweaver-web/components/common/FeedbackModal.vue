<template>
  <div class="feedback-modal__root">
    <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="visible" class="feedback-overlay" @click.self="handleClose">
        <Transition name="modal-scale">
          <div v-if="visible" class="feedback-modal">
            <!-- 关闭按钮 -->
            <button class="feedback-modal__close" @click="handleClose">
              <Icon name="lucide:x" size="20" />
            </button>

            <!-- 标题区 -->
            <div class="feedback-modal__header">
              <h2 class="feedback-modal__title">意见反馈</h2>
            </div>

            <!-- 表单区 -->
            <div class="feedback-modal__body">
              <!-- 反馈类型 -->
              <div class="feedback-modal__field">
                <label class="feedback-modal__label">
                  反馈类型 <span class="feedback-modal__required">*</span>
                </label>
                <div class="feedback-modal__radio-group">
                  <label
                    v-for="item in typeOptions"
                    :key="item.value"
                    class="feedback-modal__radio"
                    :class="{ 'feedback-modal__radio--active': form.type === item.value }"
                  >
                    <input
                      type="radio"
                      :value="item.value"
                      v-model="form.type"
                      style="display: none"
                    />
                    <Icon :name="item.icon" class="feedback-modal__radio-icon" size="16" />
                    <span class="feedback-modal__radio-text">{{ item.label }}</span>
                  </label>
                </div>
              </div>

              <!-- 所属功能 -->
              <div class="feedback-modal__field">
                <label class="feedback-modal__label">
                  所属功能 <span class="feedback-modal__required">*</span>
                </label>
                <select v-model="form.module" class="feedback-modal__select">
                  <option value="">请选择功能模块</option>
                  <option
                    v-for="item in moduleOptions"
                    :key="item.value"
                    :value="item.value"
                  >
                    {{ item.label }}
                  </option>
                </select>
              </div>

              <!-- 建议内容 -->
              <div class="feedback-modal__field">
                <label class="feedback-modal__label">
                  建议内容 <span class="feedback-modal__required">*</span>
                </label>
                <textarea
                  v-model="form.content"
                  class="feedback-modal__textarea"
                  placeholder="请详细描述您的问题或建议，至少6个字..."
                  maxlength="500"
                  rows="5"
                ></textarea>
                <div class="feedback-modal__counter">
                  {{ form.content.length }}/500
                </div>
              </div>

              <!-- 功能截图 -->
              <div class="feedback-modal__field">
                <label class="feedback-modal__label">功能截图</label>
                <CommonImageUploader
                  v-model="form.images"
                  :api-base="feedbackApiBase"
                  :max-count="3"
                  :max-size="2"
                />
              </div>

              <!-- 联系方式 -->
              <div class="feedback-modal__field">
                <label class="feedback-modal__label">联系方式</label>
                <input
                  v-model="form.contact"
                  type="text"
                  class="feedback-modal__input"
                  placeholder="手机号或邮箱（选填）"
                  maxlength="100"
                />
              </div>

              <!-- 错误提示 -->
              <Transition name="error-fade">
                <div v-if="errorMsg" class="feedback-modal__error">
                  <Icon name="lucide:circle-x" size="16" />
                  {{ errorMsg }}
                </div>
              </Transition>

              <!-- 提交按钮 -->
              <button
                class="feedback-modal__submit"
                :disabled="submitting"
                @click="handleSubmit"
              >
                <span v-if="!submitting">提交反馈</span>
                <span v-else>提交中...</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
    </Teleport>

    <!-- 成功提示 Toast -->
    <Teleport to="body">
      <Transition name="toast-slide">
        <div v-if="showToast" class="feedback-toast">
          <div class="feedback-toast__inner">
            <Icon name="lucide:circle-check" size="20" color="#22c55e" />
            <span>提交成功，感谢您的反馈！</span>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
/**
 * 意见反馈弹窗组件
 * 支持建议/bug反馈，图片上传，表单验证
 */

const { request } = useApi()
const runtimeConfig = useRuntimeConfig()
const API_BASE = runtimeConfig.public.apiBase || ''
const SIDEBAR_API_BASE = runtimeConfig.public.sidebarApiBase || ''
const DEPLOY_MODE = runtimeConfig.public.deployMode || 'network'

/**
 * 反馈提交地址按部署模式切换：
 * localhost（Docker / Electron / 开源版）强制提交到商用后台，
 * network 优先走正常业务后端地址。
 */
const feedbackApiBase = DEPLOY_MODE === 'localhost'
  ? (SIDEBAR_API_BASE || API_BASE)
  : (API_BASE || SIDEBAR_API_BASE)

const props = defineProps({
  /** 是否可见 */
  visible: Boolean,
})

const emit = defineEmits(['close', 'success'])

/** 反馈类型选项 */
const typeOptions = [
  { value: 'suggestion', label: '建议', icon: 'lucide:lightbulb' },
  { value: 'bug', label: 'Bug', icon: 'lucide:bug' },
]

/** 功能模块选项 */
const moduleOptions = [
  { value: 'write_script', label: '自己写剧本' },
  { value: 'novel_to_script', label: '小说转剧本' },
  { value: 'model_settings', label: '模型设置' },
  { value: 'other', label: '其他功能' },
]

/** 表单数据 */
const form = reactive({
  type: 'suggestion',
  module: '',
  content: '',
  images: [],
  contact: '',
})

/** 错误信息 */
const errorMsg = ref('')

/** 提交中状态 */
const submitting = ref(false)

/** 成功Toast显示状态 */
const showToast = ref(false)

/**
 * 关闭弹窗
 */
const handleClose = () => {
  if (submitting.value) return
  emit('close')
}

/**
 * 显示错误信息（3秒后自动清除）
 * @param {string} msg - 错误信息
 */
const showError = (msg) => {
  errorMsg.value = msg
  setTimeout(() => {
    errorMsg.value = ''
  }, 3000)
}

/**
 * 表单验证
 * @returns {boolean} 是否通过验证
 */
const validateForm = () => {
  if (!form.type) {
    showError('请选择反馈类型')
    return false
  }

  if (!form.module) {
    showError('请选择所属功能')
    return false
  }

  if (!form.content.trim()) {
    showError('请输入建议内容')
    return false
  }

  if (form.content.trim().length < 6) {
    showError('建议内容至少6个字')
    return false
  }

  if (form.content.length > 500) {
    showError('建议内容最多500字')
    return false
  }

  /* 验证联系方式格式（如果填写了） */
  if (form.contact.trim()) {
    const phonePattern = /^1[3-9]\d{9}$/
    const emailPattern = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/
    if (!phonePattern.test(form.contact) && !emailPattern.test(form.contact)) {
      showError('联系方式格式不正确，请输入手机号或邮箱')
      return false
    }
  }

  return true
}

/**
 * 提交反馈
 */
const handleSubmit = async () => {
  /* 验证表单 */
  if (!validateForm()) return

  submitting.value = true
  errorMsg.value = ''

  try {
    const res = await request('/api/feedback/submit', {
      method: 'POST',
      baseURL: feedbackApiBase,
      body: {
        type: form.type,
        module: form.module,
        content: form.content.trim(),
        images: form.images,
        contact: form.contact.trim() || null,
      },
    })

    if (res.code === 200) {
      /* 提交成功：显示Toast → 关闭弹窗 → 重置表单 */
      emit('close')
      showToast.value = true
      setTimeout(() => { showToast.value = false }, 2500)
      emit('success')

      /* 重置表单 */
      form.type = 'suggestion'
      form.module = ''
      form.content = ''
      form.images = []
      form.contact = ''
    } else {
      showError(res.message || '提交失败')
    }

  } catch (err) {
    showError(err.message || '网络错误，请稍后重试')
  } finally {
    submitting.value = false
  }
}

/** 监听弹窗显示，重置错误信息 */
watch(() => props.visible, (val) => {
  if (val) {
    errorMsg.value = ''
  }
})
</script>

<style scoped>
.feedback-modal__root {
  display: contents;
}

/* ========================================
 * 遮罩层
 * ======================================== */
.feedback-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

/* ========================================
 * 弹窗主体
 * ======================================== */
.feedback-modal {
  position: relative;
  width: 600px;
  max-height: 90vh;
  background: #fff;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 4px 20px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

/* 关闭按钮 */
.feedback-modal__close {
  position: absolute;
  top: 10px;
  right: 12px;
  z-index: 10;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.8);
  transition: all 0.2s;
}

.feedback-modal__close:hover {
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
}

/* ========================================
 * 标题区
 * ======================================== */
.feedback-modal__header {
  padding: 16px 32px;
  background: linear-gradient(135deg, #ff6b35, #f7418f);
  color: #fff;
  position: relative;
  overflow: hidden;
}

.feedback-modal__header::before {
  content: '';
  position: absolute;
  top: -40px;
  right: -40px;
  width: 160px;
  height: 160px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  filter: blur(30px);
}

.feedback-modal__title {
  font-size: 18px;
  font-weight: 700;
  position: relative;
  z-index: 1;
}

/* ========================================
 * 表单区
 * ======================================== */
.feedback-modal__body {
  flex: 1;
  padding: 16px 28px 20px;
  overflow-y: auto;
}

.feedback-modal__field {
  margin-bottom: 12px;
}

.feedback-modal__label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #333;
  margin-bottom: 4px;
}

.feedback-modal__required {
  color: #ef4444;
  margin-left: 2px;
}

/* ========================================
 * 单选按钮组
 * ======================================== */
.feedback-modal__radio-group {
  display: flex;
  gap: 12px;
}

.feedback-modal__radio {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border: 2px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background: #fff;
}

.feedback-modal__radio:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-bg);
}

.feedback-modal__radio--active {
  border-color: var(--color-primary);
  background: var(--color-primary-bg);
  color: var(--color-primary);
}

.feedback-modal__radio-icon {
  font-size: 16px;
}

.feedback-modal__radio-text {
  font-size: 13px;
  font-weight: 500;
}

/* ========================================
 * 下拉选择框
 * ======================================== */
.feedback-modal__select {
  width: 100%;
  height: 36px;
  padding: 0 12px;
  font-size: 13px;
  color: #333;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  outline: none;
  transition: all 0.3s;
  background: #fff;
  cursor: pointer;
}

.feedback-modal__select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-bg);
}

/* ========================================
 * 文本域
 * ======================================== */
.feedback-modal__textarea {
  width: 100%;
  padding: 8px 12px;
  font-size: 13px;
  color: #333;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  outline: none;
  transition: all 0.3s;
  resize: vertical;
  font-family: inherit;
  line-height: 1.5;
}

.feedback-modal__textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-bg);
}

.feedback-modal__textarea::placeholder {
  color: #bbb;
}

.feedback-modal__counter {
  text-align: right;
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

/* ========================================
 * 输入框
 * ======================================== */
.feedback-modal__input {
  width: 100%;
  height: 36px;
  padding: 0 12px;
  font-size: 13px;
  color: #333;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  outline: none;
  transition: all 0.3s;
}

.feedback-modal__input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-bg);
}

.feedback-modal__input::placeholder {
  color: #bbb;
}

/* ========================================
 * 错误提示
 * ======================================== */
.feedback-modal__error {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  margin-bottom: 10px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #ef4444;
  font-size: 12px;
}

/* ========================================
 * 提交按钮
 * ======================================== */
.feedback-modal__submit {
  width: 100%;
  height: 40px;
  background: var(--color-primary-gradient);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
}

.feedback-modal__submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(255, 107, 53, 0.4);
}

.feedback-modal__submit:active:not(:disabled) {
  transform: translateY(0);
}

.feedback-modal__submit:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

/* ========================================
 * 动画
 * ======================================== */
.modal-fade-enter-active {
  transition: opacity 0.3s ease;
}

.modal-fade-leave-active {
  transition: opacity 0.25s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-scale-enter-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-scale-leave-active {
  transition: all 0.25s ease-in;
}

.modal-scale-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(20px);
}

.modal-scale-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}

.error-fade-enter-active {
  transition: all 0.3s ease;
}

.error-fade-leave-active {
  transition: all 0.2s ease;
}

.error-fade-enter-from,
.error-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* ========================================
 * 响应式
 * ======================================== */

/* ========================================
 * 成功Toast
 * ======================================== */
.feedback-toast {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10001;
  pointer-events: none;
}

.feedback-toast__inner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
  font-size: 14px;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
}

/* Toast动画 */
.toast-slide-enter-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-slide-leave-active {
  transition: all 0.3s ease-in;
}

.toast-slide-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px) scale(0.9);
}

.toast-slide-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-10px);
}

@media (max-width: 640px) {
  .feedback-modal {
    width: calc(100vw - 32px);
    max-height: 95vh;
  }

  .feedback-modal__header {
    padding: 14px 20px;
  }

  .feedback-modal__body {
    padding: 14px 16px 16px;
  }

  .feedback-modal__radio-group {
    flex-direction: column;
  }
}
</style>
