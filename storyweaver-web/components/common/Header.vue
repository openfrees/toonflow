<template>
  <header class="header">
    <div class="container header__inner">
      <!-- Logo -->
      <NuxtLink to="/" class="header__logo">
        <Icon name="lucide:clapperboard" size="24" />
        <span class="header__logo-text">知剧AI</span>
      </NuxtLink>

      <!-- 导航 -->
      <nav class="header__nav">
        <NuxtLink to="/" class="header__nav-link" active-class="active">首页</NuxtLink>
        <NuxtLink to="/category" class="header__nav-link" active-class="active">分类</NuxtLink>
        <NuxtLink to="/ranking" class="header__nav-link" active-class="active">排行</NuxtLink>
      </nav>

      <!-- 用户操作 -->
      <div class="header__actions">
        <button class="header__search-btn" @click="toggleSearch">
          <Icon name="lucide:search" size="20" />
        </button>
        <NuxtLink to="/user" class="header__user-btn">
          <Icon name="lucide:user" size="20" />
        </NuxtLink>
      </div>
    </div>
  </header>
</template>

<script setup>
/**
 * 顶部导航栏组件
 */
const toggleSearch = () => {
  // 后续实现搜索功能
}
</script>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(15, 15, 26, 0.85);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--color-border);
}

.header__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
}

.header__logo {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text);
  font-weight: 700;
  font-size: 1.2rem;
}

.header__logo-icon {
  font-size: 1.5rem;
}

.header__nav {
  display: flex;
  gap: 32px;
}

.header__nav-link {
  color: var(--color-text-secondary);
  font-size: 0.95rem;
  font-weight: 500;
  transition: color 0.2s;
  padding: 4px 0;
  border-bottom: 2px solid transparent;
}

.header__nav-link:hover,
.header__nav-link.active {
  color: var(--color-text);
  border-bottom-color: var(--color-primary);
}

.header__actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header__search-btn,
.header__user-btn {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  font-size: 1.2rem;
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  transition: all 0.2s;
}

.header__search-btn:hover,
.header__user-btn:hover {
  color: var(--color-text);
  background: var(--color-bg-card);
}
</style>
