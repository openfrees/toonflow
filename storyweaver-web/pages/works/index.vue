<template>
  <div class="works">
    <!-- 页面标题 -->
    <div class="works__header">
      <div class="works__header-left">
        <h1 class="works__heading">
          <Icon name="lucide:folder-open" class="works__heading-icon" size="20" />
          我的作品
        </h1>
        <p class="works__subtitle">管理你创建的所有剧本和小说项目</p>
      </div>
      <div v-if="!loading && displayList.length > 0" class="works__create-split">
        <button type="button" class="works__create-action works__create-action--left" @click="navigateTo('/write')">
          <Icon name="lucide:pen-line" size="15" />
          <span>写剧本</span>
        </button>
        <span class="works__create-divider" aria-hidden="true"></span>
        <button type="button" class="works__create-action works__create-action--right" @click="navigateTo('/novel-to-script')">
          <Icon name="lucide:book-open" size="15" />
          <span>小说改编</span>
        </button>
      </div>
    </div>

    <!-- Tab 切换 -->
    <div class="works__tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="works__tab"
        :class="{ 'works__tab--active': activeTab === tab.key }"
        @click="switchTab(tab.key)"
      >
        <Icon :name="tab.icon" size="15" />
        <span>{{ tab.label }}</span>
        <span v-if="tab.count !== null" class="works__tab-count">{{ tab.count }}</span>
      </button>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="works__loading">
      <Icon name="lucide:loader-2" class="works__loading-icon" size="24" />
      <span>加载中...</span>
    </div>

    <!-- 空状态 -->
    <div v-else-if="!displayList.length" class="works__empty">
      <div class="works__empty-icon"><Icon :name="emptyIcon" size="48" /></div>
      <p class="works__empty-text">{{ emptyText }}</p>
      <div v-if="isAllTabEmptyState" class="works__create-split works__create-split--empty">
        <button type="button" class="works__create-action works__create-action--left" @click="navigateTo('/write')">
          <Icon name="lucide:pen-line" size="15" />
          <span>写剧本</span>
        </button>
        <span class="works__create-divider" aria-hidden="true"></span>
        <button type="button" class="works__create-action works__create-action--right" @click="navigateTo('/novel-to-script')">
          <Icon name="lucide:book-open" size="15" />
          <span>小说改编</span>
        </button>
      </div>
      <button v-else class="works__empty-btn" @click="navigateTo(emptyAction.path)">{{ emptyAction.label }}</button>
    </div>

    <!-- 作品列表 -->
    <div v-else class="works__grid">
      <div
        v-for="item in displayList"
        :key="`${item._type}-${item.id}`"
        class="works__card"
        :class="[`works__card--${item._type}`]"
        @click="handleCardClick(item)"
      >
        <!-- 左侧封面 -->
        <div class="works__card-cover">
          <img
            v-if="item.cover"
            :src="getImageUrl(item.cover)"
            :alt="item.title"
            class="works__card-cover-img"
          />
          <div v-else class="works__card-cover-placeholder">
            <Icon :name="item._type === 'novel' ? 'lucide:book-open' : 'lucide:file'" size="16" />
          </div>
        </div>
        <!-- 右侧信息 -->
        <div class="works__card-info">
          <h3 class="works__card-title">{{ item.title || '未命名作品' }}</h3>
          <p v-if="item.synopsis" class="works__card-synopsis">{{ item.synopsis }}</p>
          <div class="works__card-meta">
            <span class="works__card-type-badge" :class="`works__card-type-badge--${item._type}`">
              {{ item._type === 'novel' ? '小说' : '剧本' }}
            </span>
            <span v-if="item.gender" class="works__card-tag works__card-tag--gender" :class="`works__card-tag--${item.gender}`">{{ item.gender }}</span>
            <span v-if="getGenreDisplay(item)" class="works__card-tag">{{ getGenreDisplay(item) }}</span>
          </div>
          <div class="works__card-footer">
            <span class="works__card-episodes">{{ getEpisodeProgress(item) }}</span>
            <span class="works__card-time">{{ formatTime(item._createdAt) }}</span>
          </div>
        </div>

        <!-- 右上角三点菜单 -->
        <div class="works__card-menu" @click.stop>
          <button class="works__card-menu-btn" @click.stop="toggleMenu(`${item._type}-${item.id}`)">
            <span class="works__card-menu-dots">···</span>
          </button>
          <div v-if="activeMenu === `${item._type}-${item.id}`" class="works__card-dropdown">
            <button class="works__card-dropdown-item works__card-dropdown-item--danger" @click.stop="handleDelete(item)">
              <Icon name="lucide:trash-2" size="14" /> 删除
            </button>
          </div>
        </div>
      </div>

      <!-- 加载更多 -->
      <div v-if="hasMore" class="works__load-more">
        <button class="works__load-more-btn" :disabled="loadingMore" @click="loadMore">
          {{ loadingMore ? '加载中...' : '加载更多' }}
        </button>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <Teleport to="body">
      <Transition name="confirm-fade">
        <div v-if="confirmVisible" class="confirm-overlay" @click.self="cancelDelete">
          <Transition name="confirm-zoom">
            <div v-if="confirmVisible" class="confirm-dialog">
              <div class="confirm-dialog__icon"><Icon name="lucide:trash-2" size="40" color="#ef4444" /></div>
              <h3 class="confirm-dialog__title">确认删除</h3>
              <p class="confirm-dialog__desc">
                确定删除{{ confirmTarget?._type === 'novel' ? '小说项目' : '剧本' }}「<strong>{{ confirmTarget?.title || '未命名作品' }}</strong>」吗？<br/>删除后不可恢复。
              </p>
              <div class="confirm-dialog__actions">
                <button class="confirm-dialog__btn confirm-dialog__btn--cancel" @click="cancelDelete">取消</button>
                <button class="confirm-dialog__btn confirm-dialog__btn--danger" :disabled="deleting" @click="confirmDelete">
                  {{ deleting ? '删除中...' : '确认删除' }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
definePageMeta({ middleware: 'auth' })

useSeo()

const { showToast } = useToast()
const { get, del } = useApi()
const apiBase = useRuntimeConfig().public.apiBase

const getImageUrl = (path) => {
  if (!path) return ''
  if (path.startsWith('http')) return path
  return `${apiBase}${path}`
}

/* ======== Tab 定义 ======== */
const activeTab = ref('all')
const scriptTotal = ref(0)
const novelTotal = ref(0)

const tabs = computed(() => [
  { key: 'all', label: '全部作品', icon: 'lucide:layers', count: scriptTotal.value + novelTotal.value },
  { key: 'script', label: '自研剧本', icon: 'lucide:pen-line', count: scriptTotal.value },
  { key: 'novel', label: '小说转剧本', icon: 'lucide:book-open', count: novelTotal.value },
])

/* ======== 数据状态 ======== */
const scriptList = ref([])
const novelList = ref([])
const loading = ref(true)
const loadingMore = ref(false)
const scriptPage = ref(1)
const novelPage = ref(1)
const pageSize = 20
const scriptHasMore = ref(false)
const novelHasMore = ref(false)

/* 当前展示列表（根据Tab过滤 + 按时间降序混排） */
const displayList = computed(() => {
  let items = []
  if (activeTab.value === 'all') {
    items = [...scriptList.value, ...novelList.value]
  } else if (activeTab.value === 'script') {
    items = [...scriptList.value]
  } else {
    items = [...novelList.value]
  }
  items.sort((a, b) => new Date(b._createdAt) - new Date(a._createdAt))
  return items
})

const hasMore = computed(() => {
  if (activeTab.value === 'all') return scriptHasMore.value || novelHasMore.value
  if (activeTab.value === 'script') return scriptHasMore.value
  return novelHasMore.value
})

/* 空状态文案随Tab变化 */
const emptyIcon = computed(() => {
  if (activeTab.value === 'novel') return 'lucide:book-open'
  return 'lucide:file-text'
})
const emptyText = computed(() => {
  if (activeTab.value === 'script') return '还没有创建过剧本'
  if (activeTab.value === 'novel') return '还没有小说转剧本项目'
  return '还没有创建过作品'
})
const emptyAction = computed(() => {
  if (activeTab.value === 'novel') return { path: '/novel-to-script', label: '去小说改编' }
  return { path: '/write', label: '去写剧本' }
})
const isAllTabEmptyState = computed(() => activeTab.value === 'all')

/* ======== 三点菜单 ======== */
const activeMenu = ref(null)
const toggleMenu = (key) => { activeMenu.value = activeMenu.value === key ? null : key }
const closeMenu = () => { activeMenu.value = null }
onMounted(() => { if (process.client) document.addEventListener('click', closeMenu) })
onUnmounted(() => { if (process.client) document.removeEventListener('click', closeMenu) })

/* ======== 工具方法 ======== */
const getGenreDisplay = (item) => {
  if (item._type === 'novel') {
    const genres = item.genres
    if (Array.isArray(genres) && genres.length > 0) return genres.join('/')
    return ''
  }
  if (item.genre_names && item.genre_names.length > 0) return item.genre_names.join('/')
  if (item.params?.genre) return item.params.genre
  return ''
}

const getEpisodeProgress = (item) => {
  if (item._type === 'novel') {
    return `${item.total_episodes || 0}集`
  }
  const created = item.created_episodes || 0
  const total = item.total_episodes || 0
  return `${created}集/${total}集`
}

const formatTime = (timeStr) => {
  if (!timeStr) return ''
  const d = new Date(timeStr)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${h}:${min}`
}

/* ======== 卡片点击 ======== */
const handleCardClick = (item) => {
  if (item._type === 'novel') {
    navigateTo(`/novel/${item.id}`)
  } else {
    navigateTo(`/write/${item.id}`)
  }
}

/* ======== 删除逻辑 ======== */
const confirmVisible = ref(false)
const confirmTarget = ref(null)
const deleting = ref(false)

const handleDelete = (item) => {
  activeMenu.value = null
  confirmTarget.value = item
  confirmVisible.value = true
}

const cancelDelete = () => {
  if (deleting.value) return
  confirmVisible.value = false
  confirmTarget.value = null
}

const confirmDelete = async () => {
  if (deleting.value || !confirmTarget.value) return
  deleting.value = true
  const item = confirmTarget.value

  try {
    const apiPath = item._type === 'novel' ? `/api/novel-project/${item.id}` : `/api/script/${item.id}`
    const res = await del(apiPath)
    if (res.code === 200) {
      if (item._type === 'novel') {
        novelList.value = novelList.value.filter(i => i.id !== item.id)
        novelTotal.value--
      } else {
        scriptList.value = scriptList.value.filter(i => i.id !== item.id)
        scriptTotal.value--
      }
      showToast('删除成功', 'success')
    } else {
      showToast(res.message || '删除失败', 'error')
    }
  } catch {
    showToast('删除失败', 'error')
  } finally {
    deleting.value = false
    confirmVisible.value = false
    confirmTarget.value = null
  }
}

/* ======== 数据加载 ======== */

/** 标准化剧本数据，统一加 _type 和 _createdAt */
const normalizeScript = (item) => ({
  ...item,
  _type: 'script',
  _createdAt: item.createdAt || item.created_at,
})

/** 标准化小说项目数据 */
const normalizeNovel = (item) => ({
  ...item,
  _type: 'novel',
  _createdAt: item.createdAt || item.created_at,
})

const fetchScripts = async (isLoadMore = false) => {
  try {
    const res = await get(`/api/script?page=${scriptPage.value}&pageSize=${pageSize}`)
    if (res.code === 200 && res.data) {
      const rows = (res.data.list || res.data.rows || []).map(normalizeScript)
      scriptTotal.value = res.data.pagination?.total || res.data.count || 0
      if (isLoadMore) {
        scriptList.value.push(...rows)
      } else {
        scriptList.value = rows
      }
      scriptHasMore.value = scriptList.value.length < scriptTotal.value
    }
  } catch (err) {
    console.error('获取剧本列表失败:', err.message)
  }
}

const fetchNovels = async (isLoadMore = false) => {
  try {
    const res = await get(`/api/novel-project?page=${novelPage.value}&pageSize=${pageSize}`)
    if (res.code === 200 && res.data) {
      const rows = (res.data.list || res.data.rows || []).map(normalizeNovel)
      novelTotal.value = res.data.pagination?.total || res.data.count || 0
      if (isLoadMore) {
        novelList.value.push(...rows)
      } else {
        novelList.value = rows
      }
      novelHasMore.value = novelList.value.length < novelTotal.value
    }
  } catch (err) {
    console.error('获取小说项目列表失败:', err.message)
  }
}

/* Tab 切换 */
const switchTab = (key) => {
  activeTab.value = key
}

/* 加载更多（根据当前Tab决定加载哪个数据源） */
const loadMore = async () => {
  if (loadingMore.value) return
  loadingMore.value = true
  try {
    if (activeTab.value === 'all') {
      const tasks = []
      if (scriptHasMore.value) { scriptPage.value++; tasks.push(fetchScripts(true)) }
      if (novelHasMore.value) { novelPage.value++; tasks.push(fetchNovels(true)) }
      await Promise.all(tasks)
    } else if (activeTab.value === 'script') {
      scriptPage.value++
      await fetchScripts(true)
    } else {
      novelPage.value++
      await fetchNovels(true)
    }
  } finally {
    loadingMore.value = false
  }
}

/* 初始化：并行加载两个列表 */
onMounted(async () => {
  await Promise.all([fetchScripts(), fetchNovels()])
  loading.value = false
})
</script>

<style scoped>
.works { padding: 0; }

.works__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
}

.works__header-left {
  flex: 1;
  min-width: 0;
}

.works__heading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 22px;
  font-weight: 800;
  color: var(--color-text);
  margin-bottom: 6px;
}

.works__heading-icon { font-size: 24px; }

.works__subtitle {
  font-size: 13px;
  color: var(--color-text-secondary);
}

/* 创建按钮 */
.works__create-split {
  position: relative;
  display: flex;
  align-items: center;
  background: linear-gradient(90deg, #9E36FF 0%, #FF4472 55%, #FFAA4C 100%);
  color: #fff;
  border-radius: 999px;
  box-shadow: 0 4px 12px rgba(158, 54, 255, 0.3);
  transition: transform 0.2s, box-shadow 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
  overflow: hidden;
}

.works__create-split:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(158, 54, 255, 0.4);
}

.works__create-action {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  background: transparent;
  transition: background 0.2s ease, transform 0.2s ease;
}

.works__create-action:hover {
  background: rgba(255, 255, 255, 0.14);
}

.works__create-action:active {
  background: rgba(255, 255, 255, 0.2);
}

.works__create-action--left {
  padding-right: 18px;
}

.works__create-action--right {
  padding-left: 18px;
}

.works__create-divider {
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: 50%;
  width: 1.5px;
  background: rgba(255, 255, 255, 0.9);
  transform: translateX(-50%) rotate(20deg);
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.25);
  pointer-events: none;
}

/* ======== Tab 切换 ======== */
.works__tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  padding: 4px;
  background: var(--color-bg, #f5f6fa);
  border-radius: 12px;
  width: fit-content;
}

.works__tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: transparent;
  transition: all 0.2s;
  cursor: pointer;
  white-space: nowrap;
}

.works__tab:hover {
  color: var(--color-text);
  background: rgba(0, 0, 0, 0.03);
}

.works__tab--active {
  color: var(--color-text);
  background: var(--color-bg-white, #fff);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  font-weight: 600;
}

.works__tab-count {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.06);
  color: var(--color-text-secondary);
  font-weight: 500;
  min-width: 18px;
  text-align: center;
}

.works__tab--active .works__tab-count {
  background: linear-gradient(90deg, #9E36FF 0%, #FF4472 100%);
  color: #fff;
}

/* 加载中 */
.works__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 80px 0;
  color: var(--color-text-secondary);
  font-size: 14px;
}

.works__loading-icon { font-size: 20px; }

/* 空状态 */
.works__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80px 0;
}

.works__empty-icon { font-size: 48px; margin-bottom: 16px; }

.works__empty-text {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-bottom: 20px;
}

.works__create-split--empty {
  margin-top: 4px;
}

.works__empty-btn {
  padding: 10px 28px;
  background: linear-gradient(90deg, #9E36FF 0%, #FF4472 55%, #FFAA4C 100%);
  color: #fff;
  border-radius: 24px;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(158, 54, 255, 0.3);
  transition: transform 0.2s;
}

.works__empty-btn:hover { transform: translateY(-2px); }

/* 三列网格 */
.works__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

/* 卡片 */
.works__card {
  position: relative;
  display: flex;
  align-items: stretch;
  background: var(--color-bg-white);
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  border-left: 3px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
  overflow: hidden;
}

.works__card:hover {
  box-shadow: var(--shadow);
}

.works__card--script:hover {
  border-left-color: #9E36FF;
}

.works__card--novel:hover {
  border-left-color: #f59e0b;
}

/* 左侧封面 */
.works__card-cover {
  width: 90px;
  min-height: 110px;
  flex-shrink: 0;
  margin: 10px 0 10px 10px;
  border-radius: 8px;
  background: #f5f6fa;
  overflow: hidden;
}

.works__card-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.works__card-cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  background: linear-gradient(135deg, #f0f0f5 0%, #e8e8f0 100%);
}
.works__card-cover-placeholder .iconify {
  background-color: #a8a8ac;
  width: 1.2em;
  height: 1.2em;
}

/* 右侧信息 */
.works__card-info {
  flex: 1;
  min-width: 0;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 0;
}

.works__card-type-badge {
  flex-shrink: 0;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
  line-height: 1.6;
}

.works__card-type-badge--script {
  background: #f3e8ff;
  color: #9E36FF;
}

.works__card-type-badge--novel {
  background: #fef3c7;
  color: #d97706;
}

.works__card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-right: 28px;
  margin-bottom: 4px;
}

/* 剧情梗概 */
.works__card-synopsis {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
}

.works__card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
  overflow: hidden;
}

.works__card-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: #f5f6fa;
  color: var(--color-text-secondary);
}

.works__card-tag--gender { font-weight: 500; }
.works__card-tag--男频 { background: #e0f7ff; color: #49ccf9; }
.works__card-tag--女频 { background: #fdf2f8; color: #ec4899; }
.works__card-tag--通用 { background: #f0fdf4; color: #16a34a; }

/* 底部 */
.works__card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  gap: 8px;
}

.works__card-episodes {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.works__card-time {
  font-size: 12px;
  color: var(--color-text-light);
  text-align: right;
  white-space: nowrap;
}

/* 三点菜单 */
.works__card-menu {
  position: absolute;
  top: 10px;
  right: 10px;
}

.works__card-menu-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--color-text-light);
  transition: all 0.2s;
  font-size: 16px;
  letter-spacing: 1px;
}

.works__card-menu-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

.works__card-menu-dots {
  line-height: 1;
  transform: rotate(90deg);
  display: inline-block;
}

/* 下拉菜单 */
.works__card-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: var(--shadow-lg);
  min-width: 100px;
  z-index: 10;
  overflow: hidden;
}

.works__card-dropdown-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 10px 14px;
  font-size: 13px;
  background: none;
  color: var(--color-text);
  transition: background 0.15s;
  white-space: nowrap;
}

.works__card-dropdown-item:hover { background: var(--color-bg-hover); }
.works__card-dropdown-item--danger { color: var(--color-danger); }
.works__card-dropdown-item--danger:hover { background: #fef2f2; }

/* 加载更多 */
.works__load-more {
  grid-column: 1 / -1;
  display: flex;
  justify-content: center;
  padding: 16px 0;
}

.works__load-more-btn {
  padding: 8px 24px;
  background: var(--color-bg);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  border-radius: 20px;
  font-size: 13px;
  transition: all 0.2s;
}

.works__load-more-btn:hover:not(:disabled) {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

.works__load-more-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 响应式 */
@media (max-width: 1200px) {
  .works__grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 900px) {
  .works__grid { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
  .works__header {
    flex-direction: column;
    align-items: stretch;
  }

  .works__create-split {
    align-self: flex-end;
  }

  .works__tabs {
    width: 100%;
    overflow-x: auto;
  }
}

/* ========== 删除确认弹窗 ========== */
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

.confirm-dialog__icon { font-size: 40px; margin-bottom: 12px; }

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

.confirm-dialog__desc strong { color: var(--color-text, #1a1a1a); }

.confirm-dialog__actions { display: flex; gap: 12px; }

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

.confirm-dialog__btn--cancel:hover { background: var(--color-bg-hover, #eee); }

.confirm-dialog__btn--danger {
  background: #ef4444;
  color: #fff;
  border: none;
}

.confirm-dialog__btn--danger:hover:not(:disabled) { background: #dc2626; }

.confirm-dialog__btn--danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 弹窗动画 */
.confirm-fade-enter-active,
.confirm-fade-leave-active { transition: opacity 0.2s ease; }
.confirm-fade-enter-from,
.confirm-fade-leave-to { opacity: 0; }

.confirm-zoom-enter-active { transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
.confirm-zoom-leave-active { transition: all 0.15s ease-in; }
.confirm-zoom-enter-from { opacity: 0; transform: scale(0.85); }
.confirm-zoom-leave-to { opacity: 0; transform: scale(0.95); }
</style>






