<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="visible" class="novel-params-modal-overlay" @click.self="handleClose">
        <Transition name="modal-scale">
          <div v-if="visible" class="novel-params-modal">
            <div class="novel-params-modal__header">
              <h2 class="novel-params-modal__title">修改创作参数</h2>
            </div>

            <div class="novel-params-modal__body">
              <NovelParamsPanel v-model="localParams" />
            </div>

            <div class="novel-params-modal__footer">
              <button class="novel-params-modal__btn novel-params-modal__btn--cancel" @click="handleClose">取消</button>
              <button class="novel-params-modal__btn novel-params-modal__btn--confirm" @click="handleConfirm">确认修改</button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
/**
 * 小说转剧本 - 参数编辑弹窗
 * 字段：集数、时长、受众性别、题材类型、画风风格、画面比例
 * 点击确认直接保存，不做二次确认
 */
const props = defineProps({
  visible: Boolean,
  modelValue: {
    type: Object,
    default: () => ({}),
  },
})

const emit = defineEmits(['close', 'update:modelValue', 'save'])

const localParams = ref({})

watch(() => props.visible, (val) => {
  if (val) {
    localParams.value = JSON.parse(JSON.stringify(props.modelValue))
  }
})

const handleClose = () => {
  emit('close')
}

const handleConfirm = () => {
  emit('update:modelValue', { ...localParams.value })
  emit('save', { ...localParams.value })
  emit('close')
}
</script>

<style scoped>
.novel-params-modal-overlay {
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

.novel-params-modal {
  position: relative;
  width: 520px;
  max-height: 85vh;
  background: #fff;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 4px 20px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

.novel-params-modal__header {
  padding: 16px 32px;
  background: linear-gradient(135deg, #ff6b35, #f7418f);
  color: #fff;
  position: relative;
  overflow: hidden;
}

.novel-params-modal__header::before {
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

.novel-params-modal__title {
  font-size: 18px;
  font-weight: 700;
  position: relative;
  z-index: 1;
}

.novel-params-modal__body {
  flex: 1;
  padding: 0;
  overflow-y: auto;
}

.novel-params-modal__body :deep(.params-panel) {
  border: none;
  border-radius: 0;
}

.novel-params-modal__footer {
  display: flex;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--color-border-light);
}

.novel-params-modal__btn {
  flex: 1;
  height: 40px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.novel-params-modal__btn--cancel {
  background: var(--color-bg);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.novel-params-modal__btn--cancel:hover {
  background: var(--color-bg-hover);
}

.novel-params-modal__btn--confirm {
  background: var(--color-primary-gradient);
  color: #fff;
  box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
}

.novel-params-modal__btn--confirm:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(255, 107, 53, 0.4);
}

/* 动画 */
.modal-fade-enter-active { transition: opacity 0.3s ease; }
.modal-fade-leave-active { transition: opacity 0.25s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }

.modal-scale-enter-active { transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
.modal-scale-leave-active { transition: all 0.25s ease-in; }
.modal-scale-enter-from { opacity: 0; transform: scale(0.9) translateY(20px); }
.modal-scale-leave-to { opacity: 0; transform: scale(0.95) translateY(10px); }

@media (max-width: 600px) {
  .novel-params-modal {
    width: calc(100vw - 32px);
    max-height: 90vh;
  }
}
</style>
