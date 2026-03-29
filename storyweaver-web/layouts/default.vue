<template>
  <div class="app-layout">
    <!-- 顶部全宽品牌栏 -->
    <CommonTopbar />

    <div class="app-shell">
      <!-- 左侧边栏 -->
      <CommonSidebar />

      <!-- 右侧主区域 -->
      <div class="app-content">
        <!-- 页面内容 -->
        <main class="app-main">
          <slot />
        </main>
      </div>
    </div>

    <!-- 全局登录弹窗 -->
    <CommonLoginModal
      :visible="userStore.showLoginModal"
      @close="userStore.closeLoginModal()"
      @success="handleLoginSuccess"
    />

    <!-- 全局模型配置守卫弹窗 -->
    <CommonModelGuardDialog />
  </div>
</template>

<script setup>
/**
 * 默认布局组件
 * 包含侧边栏、顶栏、页面内容区域
 * 集成全局登录弹窗
 */
import { useUserStore } from '~/stores/user'

const userStore = useUserStore()

/** 登录成功回调 */
const handleLoginSuccess = () => {
  /* 登录成功后，如果有目标路径，则跳转 */
  if (userStore.targetPath) {
    navigateTo(userStore.targetPath)
  }
}

</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  padding-top: 72px;
}

.app-shell {
  flex: 1;
  display: flex;
  min-height: calc(100vh - 72px);
}

.app-content {
  flex: 1;
  margin-left: var(--sidebar-width);
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 72px);
  min-width: 0;
}

.app-main {
  flex: 1;
  padding: 20px 28px;
}
</style>
