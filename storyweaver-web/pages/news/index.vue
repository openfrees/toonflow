<template>
  <div class="news">
    <!-- 页面标题 -->
    <div class="news__header">
      <h1 class="news__heading">
        <Icon name="lucide:megaphone" class="news__heading-icon" size="20" />
        行业快讯
      </h1>
      <p class="news__subtitle">短剧行业资讯聚合，每日更新</p>
    </div>

    <!-- 分类标签 -->
    <div class="news__toolbar">
      <div class="news__tags">
        <button
          v-for="tag in categories"
          :key="tag.value"
          class="news__tag"
          :class="{ 'news__tag--active': activeCategory === tag.value }"
          @click="activeCategory = tag.value"
        >
          {{ tag.label }}
        </button>
      </div>
    </div>

    <!-- 快讯列表 -->
    <div class="news__list">
      <div
        v-for="(item, index) in filteredList"
        :key="index"
        class="news__item"
        @click="handleClick(item)"
      >
        <!-- 内容区 -->
        <div class="news__item-content">
          <div class="news__item-time">{{ item.time }}</div>
          <h3 class="news__item-title">{{ item.title }}</h3>
          <p class="news__item-summary">{{ item.summary }}</p>
          <div class="news__item-footer">
            <span class="news__item-source">{{ item.source }}</span>
            <span v-if="item.category" class="news__item-category">{{ item.category }}</span>
          </div>
        </div>
        <!-- 右侧箭头 -->
        <div class="news__item-arrow">
          <Icon name="lucide:chevron-right" size="16" />
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="!filteredList.length" class="news__empty">
        <Icon name="lucide:inbox" size="48" />
        <p class="news__empty-text">暂无快讯</p>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="totalPages > 1" class="news__pagination">
      <button
        class="news__page-btn"
        :disabled="page <= 1"
        @click="goPage(page - 1)"
      >
        <Icon name="lucide:chevron-left" size="14" />
      </button>
      <template v-for="p in pageList" :key="p">
        <span v-if="p === '...'" class="news__page-ellipsis">...</span>
        <button
          v-else
          class="news__page-btn"
          :class="{ 'news__page-btn--active': p === page }"
          @click="goPage(p)"
        >
          {{ p }}
        </button>
      </template>
      <button
        class="news__page-btn"
        :disabled="page >= totalPages"
        @click="goPage(page + 1)"
      >
        <Icon name="lucide:chevron-right" size="14" />
      </button>
    </div>
  </div>
</template>

<script setup>
/**
 * 行业快讯页面 - 短剧行业资讯聚合
 * 布局：default（Sidebar + Topbar）
 * 渲染策略：ISR，3小时缓存
 */

useSeo()

/* 分类标签 */
const categories = [
  { label: '全部', value: 'all' },
  { label: '新剧', value: 'new_drama' },
  { label: '政策', value: 'policy' },
  { label: '数据', value: 'data' },
  { label: '观点', value: 'opinion' },
  { label: '活动', value: 'event' },
  { label: '其他', value: 'other' },
]
const activeCategory = ref('all')

/* Mock数据 - 后续接入后端API */
const newsList = ref([
  {
    time: '2026年02月14日 09:30',
    title: '短剧出海：2024年中国短剧海外市场规模突破50亿美元',
    summary: '据最新行业报告显示，中国短剧在海外市场持续高速增长，东南亚和北美成为主要增长引擎。',
    source: '影视产业观察', category: '数据', categoryValue: 'data', url: '',
  },
  {
    time: '2026年02月14日 08:45',
    title: '广电总局发布短剧内容审核新规，强化未成年人保护',
    summary: '国家广播电视总局发布关于加强网络微短剧管理的通知，要求平台建立健全内容审核机制。',
    source: '广电总局官网', category: '政策', categoryValue: 'policy', url: '',
  },
  {
    time: '2026年02月14日 08:15',
    title: '《重生之我在霸总短剧里当编剧》单日充值破千万',
    summary: '由知名MCN机构出品的竖屏短剧上线首周表现亮眼，单日充值金额突破千万大关。',
    source: '短剧观察', category: '新剧', categoryValue: 'new_drama', url: '',
  },
  {
    time: '2026年02月13日 17:50',
    title: 'AI辅助编剧工具在短剧行业的应用前景分析',
    summary: '随着大语言模型技术的成熟，AI辅助编剧工具正在改变短剧内容生产流程。',
    source: '科技日报', category: '观点', categoryValue: 'opinion', url: '',
  },
  {
    time: '2026年02月13日 15:20',
    title: '2025短剧行业峰会将于下月在杭州举办',
    summary: '由中国网络视听节目服务协会主办的2025短剧行业峰会定于下月15日在杭州举办。',
    source: '中国网络视听', category: '活动', categoryValue: 'event', url: '',
  },
  {
    time: '2026年02月13日 10:00',
    title: '抖音短剧日活突破2亿，平台加码创作者扶持计划',
    summary: '抖音官方数据显示短剧日活用户突破2亿大关，平台宣布投入10亿流量扶持优质短剧创作者。',
    source: '36氪', category: '数据', categoryValue: 'data', url: '',
  },
  {
    time: '2026年02月12日 16:30',
    title: '快手短剧推出"星芒计划"，签约百位编剧',
    summary: '快手短剧宣布推出星芒计划，面向全网签约百位优质编剧，提供保底收入和流量扶持。',
    source: '快手官方', category: '新剧', categoryValue: 'new_drama', url: '',
  },
  {
    time: '2026年02月12日 14:20',
    title: '短剧版权保护新规出台，盗版行为最高罚款500万',
    summary: '国家版权局联合多部门发布短剧版权保护专项行动方案，加大对盗版短剧的打击力度。',
    source: '国家版权局', category: '政策', categoryValue: 'policy', url: '',
  },
  {
    time: '2026年02月12日 11:00',
    title: '竖屏短剧制作成本分析：从10万到1000万的差距',
    summary: '业内人士深度分析竖屏短剧制作成本构成，揭示不同预算级别的制作差异和投资回报率。',
    source: '娱乐资本论', category: '观点', categoryValue: 'opinion', url: '',
  },
  {
    time: '2026年02月11日 19:45',
    title: '微信小程序短剧月流水突破30亿，成新增长极',
    summary: '微信生态内短剧小程序月度总流水突破30亿元，成为短剧分发的重要渠道。',
    source: '微信公开课', category: '数据', categoryValue: 'data', url: '',
  },
  {
    time: '2026年02月11日 09:15',
    title: '韩国短剧市场爆发，中国团队加速出海布局',
    summary: '韩国短剧市场规模同比增长300%，多家中国短剧公司宣布进军韩国市场。',
    source: '出海观察', category: '新剧', categoryValue: 'new_drama', url: '',
  },
  {
    time: '2026年02月10日 15:30',
    title: '短剧行业人才报告：编剧薪资涨幅达40%',
    summary: '最新行业人才报告显示，短剧编剧平均薪资同比上涨40%，优质编剧供不应求。',
    source: '猎聘网', category: '数据', categoryValue: 'data', url: '',
  },
])

/* 按分类过滤 */
const categoryFiltered = computed(() => {
  if (activeCategory.value === 'all') return newsList.value
  return newsList.value.filter(item => item.categoryValue === activeCategory.value)
})

/* 分页 */
const page = ref(1)
const pageSize = 5
const total = computed(() => categoryFiltered.value.length)
const totalPages = computed(() => Math.ceil(total.value / pageSize))
const filteredList = computed(() => {
  const start = (page.value - 1) * pageSize
  return categoryFiltered.value.slice(start, start + pageSize)
})

/* 分页页码列表（带省略号） */
const pageList = computed(() => {
  const t = totalPages.value
  const c = page.value
  if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1)
  const pages = []
  pages.push(1)
  if (c > 3) pages.push('...')
  for (let i = Math.max(2, c - 1); i <= Math.min(t - 1, c + 1); i++) {
    pages.push(i)
  }
  if (c < t - 2) pages.push('...')
  pages.push(t)
  return pages
})

const goPage = (p) => {
  if (p < 1 || p > totalPages.value) return
  page.value = p
}

/* 切换分类时重置页码 */
watch(activeCategory, () => { page.value = 1 })

/* 点击跳转 */
const handleClick = (item) => {
  if (item.url) {
    window.open(item.url, '_blank')
  }
}
</script>
<style scoped>
.news { padding: 0; }

.news__header { margin-bottom: 24px; }

.news__heading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 22px;
  font-weight: 800;
  color: var(--color-text);
  margin-bottom: 6px;
}

.news__subtitle {
  font-size: 13px;
  color: var(--color-text-secondary);
}

/* 工具栏 */
.news__toolbar {
  margin-bottom: 20px;
}

/* 分类标签 */
.news__tags {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.news__tag {
  padding: 5px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  transition: all 0.2s;
}

.news__tag:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

.news__tag--active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.news__tag--active:hover {
  background: var(--color-primary-light);
  color: #fff;
}

/* 快讯列表 */
.news__list {
  position: relative;
}

.news__item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px 20px;
  background: var(--color-bg-white);
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.news__item:hover {
  box-shadow: var(--shadow-sm);
  border-color: var(--color-primary-light);
}

/* 内容区 */
.news__item-content {
  flex: 1;
  min-width: 0;
}

.news__item-time {
  font-size: 12px;
  color: var(--color-text-light);
  margin-bottom: 4px;
  font-variant-numeric: tabular-nums;
}

.news__item-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.5;
  margin-bottom: 6px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.news__item-summary {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.news__item-footer {
  display: flex;
  align-items: center;
  gap: 8px;
}

.news__item-source {
  font-size: 11px;
  color: var(--color-text-light);
}

.news__item-category {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 4px;
  background: var(--color-primary-bg);
  color: var(--color-primary);
  font-weight: 500;
}

/* 右侧箭头 */
.news__item-arrow {
  display: flex;
  align-items: center;
  padding-top: 4px;
  color: var(--color-text-light);
  flex-shrink: 0;
  transition: color 0.2s;
}

.news__item:hover .news__item-arrow {
  color: var(--color-primary);
}
/* 空状态 */
.news__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80px 0;
  color: var(--color-text-light);
}

.news__empty-text {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-top: 12px;
}

/* 分页 */
.news__pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 24px;
  padding-bottom: 20px;
}

.news__page-btn {
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: 13px;
  transition: all 0.2s;
}

.news__page-btn:hover:not(:disabled):not(.news__page-btn--active) {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

.news__page-btn--active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.news__page-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.news__page-ellipsis {
  font-size: 13px;
  color: var(--color-text-light);
  padding: 0 4px;
}

/* 响应式 */
@media (max-width: 900px) {
  .news__tags {
    flex-wrap: wrap;
  }
}
</style>
