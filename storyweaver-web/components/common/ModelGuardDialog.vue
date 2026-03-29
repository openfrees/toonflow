<template>
  <Teleport to="body">
    <Transition name="guard-fade">
      <div v-if="showGuardDialog" class="guard-overlay" @click.self="handleCancel">
        <div class="guard-dialog">
          <div class="guard-dialog__icon">
            <Icon name="lucide:brain" size="32" />
          </div>
          <h3 class="guard-dialog__title">模型未配置</h3>
          <p class="guard-dialog__desc">
            你还没有为「{{ guardSceneLabel }}」配置 AI 模型，
            请先前往模型设置页面添加并绑定模型后再使用。
          </p>
          <div class="guard-dialog__actions">
            <button class="guard-btn guard-btn--primary" @click="handleGoSetup">
              <Icon name="lucide:settings" size="14" />
              去设置模型
            </button>
            <button class="guard-btn guard-btn--ghost" @click="handleCancel">
              取消
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
/**
 * 模型未配置引导弹窗
 * 全局组件，挂载在 layout 中
 * 用户必须去设置模型才能继续使用 AI 功能
 */
const {
  showGuardDialog,
  guardSceneLabel,
  handleGoSetup,
  handleCancel,
} = useModelGuard()
</script>

<style scoped>
.guard-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  padding: 20px;
}

.guard-dialog {
  background: var(--color-bg-white);
  border-radius: 20px;
  padding: 32px;
  max-width: 380px;
  width: 100%;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.guard-dialog__icon {
  width: 60px;
  height: 60px;
  margin: 0 auto 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: var(--color-primary-bg);
  color: var(--color-primary);
}

.guard-dialog__title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 8px;
}

.guard-dialog__desc {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin: 0 0 24px;
  line-height: 1.6;
}

.guard-dialog__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.guard-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 10px 20px;
  font-size: 0.9rem;
  font-weight: 500;
  border-radius: 10px;
  transition: all 0.2s;
  font-family: inherit;
}

.guard-btn--primary {
  color: #fff;
  background: var(--color-primary-gradient);
}

.guard-btn--primary:hover {
  opacity: 0.9;
}

.guard-btn--ghost {
  color: var(--color-text-secondary);
  background: var(--color-bg);
}

.guard-btn--ghost:hover {
  color: var(--color-text);
  background: var(--color-bg-hover);
}

.guard-fade-enter-active { transition: all 0.25s ease-out; }
.guard-fade-leave-active { transition: all 0.2s ease-in; }
.guard-fade-enter-from, .guard-fade-leave-to { opacity: 0; }
.guard-fade-enter-from .guard-dialog { transform: scale(0.95) translateY(10px); }
.guard-fade-leave-to .guard-dialog { transform: scale(0.98) translateY(5px); }
</style>
