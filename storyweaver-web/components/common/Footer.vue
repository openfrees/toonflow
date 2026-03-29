<template>
  <footer class="footer">
    <div class="container footer__inner">
      <div class="footer__links">
        <NuxtLink to="/terms-of-service" class="footer__link">用户协议</NuxtLink>
        <span class="footer__divider">|</span>
        <NuxtLink to="/privacy-policy" class="footer__link">隐私政策</NuxtLink>
      </div>
      <p class="footer__text">© {{ currentYear }} 知剧AI · 短剧内容平台</p>
    </div>
  </footer>
</template>

<script setup>
/**
 * 底部组件
 * 包含政策链接（用户协议、隐私政策）和版权信息
 */
const currentYear = new Date().getFullYear()
</script>

<style scoped>
.footer {
  border-top: 1px solid var(--color-border);
  padding: 24px 0;
  margin-top: auto;
}

.footer__inner {
  text-align: center;
}

.footer__links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 8px;
}

.footer__link {
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  text-decoration: none;
  transition: color 0.2s;
}

.footer__link:hover {
  color: var(--color-primary);
}

.footer__divider {
  color: var(--color-text-light);
  font-size: 0.75rem;
}

.footer__text {
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}
</style>
