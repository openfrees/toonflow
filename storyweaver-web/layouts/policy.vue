<template>
  <div class="policy-layout">
    <!-- 顶部导航栏 -->
    <header class="policy-header">
      <div class="policy-header__inner">
        <NuxtLink to="/" class="policy-header__back" title="返回首页">
          <Icon name="lucide:arrow-left" size="18" />
        </NuxtLink>
        <NuxtLink to="/" class="policy-header__logo">
          <span class="policy-header__logo-mark">
            <Icon name="lucide:clapperboard" size="15" />
          </span>
          <span class="policy-header__logo-line">
            <span class="policy-header__logo-name">知剧AI</span>
            <span class="policy-header__logo-dot">·</span>
            <span class="policy-header__logo-subtitle">智能短剧创作平台</span>
          </span>
        </NuxtLink>
      </div>
    </header>

    <!-- 页面内容 -->
    <main class="policy-main">
      <slot />
    </main>

    <!-- 底部 -->
    <CommonFooter />
  </div>
</template>

<script setup>
/**
 * 政策页面专用布局
 * 简洁布局：顶部导航（返回+Logo）+ 内容区 + Footer
 * 不包含侧边栏和顶栏，适用于隐私政策、用户协议等独立页面
 */
</script>

<style scoped>
.policy-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
}

/* 顶部导航栏 */
.policy-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(18px);
  border-bottom: 1px solid rgba(238, 239, 243, 0.92);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}

.policy-header__inner {
  display: flex;
  align-items: center;
  gap: 14px;
  height: 52px;
  max-width: 960px;
  margin: 0 auto;
  padding: 0 24px;
}

.policy-header__back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  color: var(--color-text-secondary);
  transition: all 0.2s;
}

.policy-header__back:hover {
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.06);
  color: var(--color-text);
}

.policy-header__logo {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--color-text);
  text-decoration: none;
}

.policy-header__logo:hover {
  color: var(--color-text);
}

.policy-header__logo-mark {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: linear-gradient(135deg, #ff6b35 0%, #f7418f 58%, #7c3aed 100%);
  color: #fff;
  box-shadow: 0 8px 16px rgba(247, 65, 143, 0.2);
}

.policy-header__logo-line {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  line-height: 1;
}

.policy-header__logo-name {
  font-size: 0.98rem;
  font-weight: 800;
  color: #111827;
}

.policy-header__logo-dot {
  color: #cbd5e1;
  font-weight: 700;
}

.policy-header__logo-subtitle {
  font-size: 0.82rem;
  font-weight: 500;
  color: #94a3b8;
}

/* 内容区域 */
.policy-main {
  flex: 1;
  max-width: 960px;
  width: 100%;
  margin: 0 auto;
  padding: 40px 24px 60px;
}

/* 响应式 */
@media (max-width: 768px) {
  .policy-header__inner {
    padding: 0 16px;
  }

  .policy-header__logo-subtitle {
    display: none;
  }

  .policy-header__logo-dot {
    display: none;
  }

  .policy-main {
    padding: 24px 16px 40px;
  }
}
</style>
