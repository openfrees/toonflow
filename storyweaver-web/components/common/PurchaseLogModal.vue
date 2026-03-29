<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="visible" class="purchase-modal__overlay" @click.self="emit('close')">
        <div class="purchase-modal">
          <!-- 关闭按钮 -->
          <button class="purchase-modal__close" @click="emit('close')">✕</button>

          <!-- 顶部标题区 -->
          <div class="purchase-modal__header">
            <div class="purchase-modal__total">
              <Icon name="lucide:shopping-bag" class="purchase-modal__total-icon" size="36" />
              <div class="purchase-modal__total-info">
                <span class="purchase-modal__total-label">购买记录</span>
                <span class="purchase-modal__total-desc">所有充值订单一览</span>
              </div>
            </div>
          </div>

          <!-- 订单列表 -->
          <div class="purchase-modal__list" ref="listRef" @scroll="handleScroll">
            <!-- 加载中（首次） -->
            <div v-if="loading && orderList.length === 0" class="purchase-modal__loading">
              <span class="purchase-modal__spinner"></span>
              <span>加载中...</span>
            </div>

            <!-- 空状态 -->
            <div v-else-if="!loading && orderList.length === 0" class="purchase-modal__empty">
              <Icon name="lucide:inbox" class="purchase-modal__empty-icon" size="40" color="#ccc" />
              <span>暂无购买记录</span>
            </div>

            <!-- 订单项 -->
            <template v-else>
              <div
                v-for="item in orderList"
                :key="item.id"
                class="purchase-modal__item"
              >
                <div class="purchase-modal__item-left">
                  <span :class="['purchase-modal__item-badge', `purchase-modal__item-badge--${item.orderType}`]">
                    {{ item.orderType === 'vip' ? 'V' : '积' }}
                  </span>
                  <div class="purchase-modal__item-info">
                    <span class="purchase-modal__item-name">{{ item.productName || item.orderTypeText }}</span>
                    <span class="purchase-modal__item-meta">
                      {{ item.payMethodText }} · {{ item.paidAt || item.createdAt }}
                    </span>
                  </div>
                </div>
                <div class="purchase-modal__item-right">
                  <span class="purchase-modal__item-amount">¥{{ item.amount }}</span>
                  <span :class="['purchase-modal__item-status', `purchase-modal__item-status--${item.status}`]">
                    {{ item.statusText }}
                  </span>
                </div>
              </div>

              <!-- 滚动加载中 -->
              <div v-if="loading && orderList.length > 0" class="purchase-modal__loading purchase-modal__loading--inline">
                <span class="purchase-modal__spinner"></span>
                <span>加载中...</span>
              </div>

              <!-- 没有更多了 -->
              <div v-if="!hasMore && orderList.length > 0 && !loading" class="purchase-modal__nomore">
                — 没有更多数据了 —
              </div>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
/**
 * 购买记录弹窗组件
 * 展示用户充值订单列表，滚动触底自动加载更多
 */

const { get } = useApi()

const props = defineProps({
  /** 是否可见 */
  visible: Boolean,
})
const emit = defineEmits(['close'])

/** 订单列表数据 */
const orderList = ref([])

/** 分页状态 */
const currentPage = ref(1)
const pageSize = 15
const totalCount = ref(0)
const loading = ref(false)

/** 列表容器引用 */
const listRef = ref(null)

/** 是否还有更多数据 */
const hasMore = computed(() => orderList.value.length < totalCount.value)

/**
 * 获取购买记录
 * @param reset - 是否重置列表（弹窗打开时为true）
 */
const fetchOrders = async (reset = false) => {
  if (loading.value) return

  if (reset) {
    currentPage.value = 1
    orderList.value = []
  }

  loading.value = true

  try {
    const res = await get(
      `/api/payment/orders?page=${currentPage.value}&pageSize=${pageSize}`
    )

    if (res.code === 200 && res.data) {
      if (reset) {
        orderList.value = res.data.list
      } else {
        orderList.value.push(...res.data.list)
      }
      totalCount.value = res.data.pagination.total
    }
  } catch (err) {
    console.error('获取购买记录失败:', err.message)
  } finally {
    loading.value = false
  }
}

/** 滚动触底自动加载 */
const handleScroll = () => {
  if (!listRef.value || loading.value || !hasMore.value) return
  const { scrollTop, scrollHeight, clientHeight } = listRef.value
  /* 距离底部50px时触发加载 */
  if (scrollTop + clientHeight >= scrollHeight - 50) {
    currentPage.value++
    fetchOrders(false)
  }
}

/** 监听弹窗显示，自动加载数据 */
watch(() => props.visible, (val) => {
  if (val) {
    fetchOrders(true)
  }
})
</script>

<style scoped>
/* ========== 遮罩层 ========== */
.purchase-modal__overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(4px);
}

/* ========== 弹窗主体 ========== */
.purchase-modal {
  width: 480px;
  max-height: 80vh;
  background: var(--color-bg-white, #fff);
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* ========== 关闭按钮 ========== */
.purchase-modal__close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
  z-index: 10;
  border: none;
}

.purchase-modal__close:hover {
  background: rgba(255, 255, 255, 0.4);
}
/* ========== 顶部标题区 ========== */
.purchase-modal__header {
  background: linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7);
  padding: 32px 28px 24px;
  position: relative;
  overflow: hidden;
}

.purchase-modal__header::before {
  content: '';
  position: absolute;
  top: -40px;
  right: -40px;
  width: 140px;
  height: 140px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 50%;
  filter: blur(20px);
}

.purchase-modal__total {
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
  z-index: 1;
}

.purchase-modal__total-icon {
  color: #fff;
}

.purchase-modal__total-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.purchase-modal__total-label {
  font-size: 1.4rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: 1px;
}

.purchase-modal__total-desc {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.75);
}

/* ========== 订单列表 ========== */
.purchase-modal__list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
  max-height: 400px;
}
/* ========== 加载中 ========== */
.purchase-modal__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 0;
  color: var(--color-text-secondary, #999);
  font-size: 0.85rem;
}

.purchase-modal__loading--inline {
  padding: 16px 0;
}

.purchase-modal__spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-border, #eee);
  border-top-color: #8b5cf6;
  border-radius: 50%;
  animation: purchase-spin 0.6s linear infinite;
}

@keyframes purchase-spin {
  to { transform: rotate(360deg); }
}

/* ========== 空状态 ========== */
.purchase-modal__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px 0;
  color: var(--color-text-secondary, #999);
  font-size: 0.88rem;
}

/* ========== 订单项 ========== */
.purchase-modal__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 28px;
  transition: background 0.15s;
}

.purchase-modal__item:hover {
  background: var(--color-bg, #f8f8f8);
}

.purchase-modal__item-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}
/* ========== 订单项徽章 ========== */
.purchase-modal__item-badge {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 700;
  flex-shrink: 0;
}

.purchase-modal__item-badge--vip {
  background: rgba(245, 158, 11, 0.12);
  color: #d97706;
}

.purchase-modal__item-badge--points {
  background: rgba(99, 102, 241, 0.12);
  color: #6366f1;
}

.purchase-modal__item-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.purchase-modal__item-name {
  font-size: 0.88rem;
  color: var(--color-text, #333);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.purchase-modal__item-meta {
  font-size: 0.75rem;
  color: var(--color-text-secondary, #999);
}

/* ========== 订单项右侧 ========== */
.purchase-modal__item-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  flex-shrink: 0;
  margin-left: 12px;
}

.purchase-modal__item-amount {
  font-size: 1.05rem;
  font-weight: 700;
  color: #ef4444;
}

.purchase-modal__item-status {
  font-size: 0.72rem;
  padding: 1px 6px;
  border-radius: 4px;
}

.purchase-modal__item-status--0 {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
}

.purchase-modal__item-status--1 {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.purchase-modal__item-status--2 {
  background: rgba(156, 163, 175, 0.15);
  color: #9ca3af;
}

.purchase-modal__item-status--3 {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}
/* ========== 没有更多 ========== */
.purchase-modal__nomore {
  text-align: center;
  padding: 16px 0 20px;
  font-size: 0.78rem;
  color: var(--color-text-secondary, #ccc);
}

/* ========== 弹窗动画 ========== */
.modal-fade-enter-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-fade-leave-active {
  transition: all 0.2s ease-in;
}

.modal-fade-enter-from {
  opacity: 0;
}

.modal-fade-enter-from .purchase-modal {
  transform: scale(0.92) translateY(20px);
  opacity: 0;
}

.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-leave-to .purchase-modal {
  transform: scale(0.96) translateY(10px);
  opacity: 0;
}
</style>
