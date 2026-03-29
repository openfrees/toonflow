<template>
  <Teleport to="body">
    <Transition name="g-toast">
      <div v-if="toastState.visible" class="g-toast" :class="`g-toast--${toastState.type}`">
        <!-- 图标 -->
        <svg v-if="toastState.type === 'success'" class="g-toast__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <svg v-else-if="toastState.type === 'error'" class="g-toast__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <svg v-else class="g-toast__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span class="g-toast__text">{{ toastState.message }}</span>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
const { toastState } = useToast()
</script>

<style scoped>
.g-toast {
  position: fixed;
  top: 36px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 99999;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.5;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(8px);
  max-width: 480px;
  word-break: break-all;
}

/* 成功 */
.g-toast--success {
  background: #f0faf0;
  border: 1px solid #b7eb8f;
  color: #389e0d;
}
.g-toast--success .g-toast__icon { color: #52c41a; }

/* 错误 */
.g-toast--error {
  background: #fff1f0;
  border: 1px solid #ffa39e;
  color: #cf1322;
}
.g-toast--error .g-toast__icon { color: #ff4d4f; }

/* 警告 */
.g-toast--warning {
  background: #fffbe6;
  border: 1px solid #ffe58f;
  color: #ad6800;
}
.g-toast--warning .g-toast__icon { color: #faad14; }

.g-toast__icon {
  flex-shrink: 0;
}

.g-toast__text {
  flex: 1;
}

/* 动画 */
.g-toast-enter-active {
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.g-toast-leave-active {
  transition: all 0.25s ease-in;
}
.g-toast-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px) scale(0.92);
}
.g-toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-12px);
}
</style>
