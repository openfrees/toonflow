<template>
  <div class="app-layout app-layout--write">
    <!-- 全宽主区域 -->
    <div class="app-content app-content--write">
      <!-- 顶栏（带返回按钮） -->
      <CommonTopbar show-nav :show-brand="false">
        <template #left>
          <div id="topbar-left-slot"></div>
        </template>
        <template #actions>
          <div id="topbar-actions-slot"></div>
        </template>
      </CommonTopbar>

      <!-- 页面内容 -->
      <main class="app-main app-main--write">
        <slot />
      </main>
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
 * 写剧本专用布局
 * 不包含左侧Sidebar，全宽展示，Topbar带返回导航
 */
import { useUserStore } from '~/stores/user'

const userStore = useUserStore()

const handleLoginSuccess = () => {}
</script>

<style scoped>
.app-layout--write {
  height: 100vh;
  min-height: 100vh;
  display: flex;
}

.app-content--write {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-top: 72px;
}

.app-main--write {
  flex: 1;
  padding: 20px 28px;
  overflow: hidden;
  display: flex;
}
</style>

<!-- Teleport slot容器样式（不能scoped，因为是ID选择器） -->
<style>
#topbar-left-slot,
#topbar-actions-slot {
  display: contents;
}
</style>
