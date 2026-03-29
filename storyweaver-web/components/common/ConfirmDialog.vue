<template>
  <Teleport to="body">
    <Transition name="confirm-fade">
      <div v-if="visible" class="confirm-overlay" @click.self="handleCancel">
        <Transition name="confirm-zoom">
          <div v-if="visible" class="confirm-dialog">
            <div class="confirm-dialog__icon">
              <Icon :name="icon" size="40" />
            </div>
            <h3 class="confirm-dialog__title">{{ title }}</h3>
            <p class="confirm-dialog__desc" v-html="description"></p>
            <div class="confirm-dialog__actions">
              <button class="confirm-dialog__btn confirm-dialog__btn--cancel" @click="handleCancel">{{ cancelText }}</button>
              <button
                class="confirm-dialog__btn"
                :class="confirmBtnClass"
                :disabled="loading"
                @click="handleConfirm"
              >
                {{ loading ? loadingText : confirmText }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
/**
 * 通用确认弹窗组件
 * 支持自定义图标、标题、描述、按钮文案和按钮风格
 */
const props = defineProps({
  visible: { type: Boolean, default: false },
  icon: { type: String, default: 'lucide:alert-triangle' },
  title: { type: String, default: '确认操作' },
  description: { type: String, default: '' },
  cancelText: { type: String, default: '取消' },
  confirmText: { type: String, default: '确认' },
  loadingText: { type: String, default: '处理中...' },
  loading: { type: Boolean, default: false },
  /** 确认按钮风格：danger(红色) / primary(主色) */
  confirmType: { type: String, default: 'danger' },
})

const emit = defineEmits(['confirm', 'cancel', 'update:visible'])

const handleCancel = () => {
  if (props.loading) return
  emit('update:visible', false)
  emit('cancel')
}

const handleConfirm = () => {
  emit('confirm')
}

const confirmBtnClass = computed(() => {
  return props.confirmType === 'primary'
    ? 'confirm-dialog__btn--primary'
    : 'confirm-dialog__btn--danger'
})
</script>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
}

.confirm-dialog {
  background: var(--color-bg-white, #fff);
  border-radius: 16px;
  padding: 32px 28px 24px;
  width: 360px;
  max-width: 90vw;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.confirm-dialog__icon {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-warning, #f59e0b);
}

.confirm-dialog__title {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text, #1a1a1a);
  margin-bottom: 8px;
}

.confirm-dialog__desc {
  font-size: 13px;
  color: var(--color-text-secondary, #666);
  line-height: 1.6;
  margin-bottom: 24px;
}

.confirm-dialog__desc strong {
  color: var(--color-text, #1a1a1a);
}

.confirm-dialog__actions {
  display: flex;
  gap: 12px;
}

.confirm-dialog__btn {
  flex: 1;
  padding: 10px 0;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.confirm-dialog__btn--cancel {
  background: var(--color-bg, #f5f6fa);
  color: var(--color-text-secondary, #666);
  border: 1px solid var(--color-border, #e5e5e5);
}

.confirm-dialog__btn--cancel:hover {
  background: var(--color-bg-hover, #eee);
}

.confirm-dialog__btn--danger {
  background: #ef4444;
  color: #fff;
  border: none;
}

.confirm-dialog__btn--danger:hover:not(:disabled) {
  background: #dc2626;
}

.confirm-dialog__btn--danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.confirm-dialog__btn--primary {
  background: var(--color-primary, #6366f1);
  color: #fff;
  border: none;
}

.confirm-dialog__btn--primary:hover:not(:disabled) {
  filter: brightness(0.9);
}

.confirm-dialog__btn--primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 弹窗动画 */
.confirm-fade-enter-active,
.confirm-fade-leave-active {
  transition: opacity 0.2s ease;
}
.confirm-fade-enter-from,
.confirm-fade-leave-to {
  opacity: 0;
}

.confirm-zoom-enter-active {
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.confirm-zoom-leave-active {
  transition: all 0.15s ease-in;
}
.confirm-zoom-enter-from {
  opacity: 0;
  transform: scale(0.85);
}
.confirm-zoom-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
