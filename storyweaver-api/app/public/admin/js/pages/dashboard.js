/**
 * 仪表盘页面组件
 */
const DashboardPage = {
  template: `
    <div>
      <div class="page-header">
        <h2 class="page-title">仪表盘</h2>
        <span class="page-date">{{ today }}</span>
      </div>

      <!-- 统计卡片 -->
      <div class="stats-grid">
        <div v-for="(card, idx) in cards" :key="card.label" class="stat-card">
          <div class="stat-icon" :class="'stat-icon-' + (idx + 1)">{{ card.icon }}</div>
          <div>
            <div class="stat-value">{{ card.value }}</div>
            <div class="stat-label">{{ card.label }}</div>
          </div>
        </div>
      </div>

      <!-- 快捷操作 -->
      <div class="quick-section">
        <h3 class="section-title">快捷操作</h3>
        <div class="quick-grid">
          <div class="quick-item" @click="$router.push('/drama')">
            <span class="quick-item-icon">🎬</span><span>短剧管理</span>
          </div>
          <div class="quick-item" @click="$router.push('/category')">
            <span class="quick-item-icon">📂</span><span>分类管理</span>
          </div>
          <div class="quick-item" @click="$router.push('/tag')">
            <span class="quick-item-icon">🏷️</span><span>标签管理</span>
          </div>
        </div>
      </div>
    </div>
  `,
  setup() {
    const { ref, computed, onMounted } = Vue
    const stats = ref({
      totalDramas: 0, onlineDramas: 0, draftDramas: 0, totalEpisodes: 0,
      totalCategories: 0, totalTags: 0, todayNewDramas: 0, totalViews: 0,
    })

    const today = computed(() => {
      const d = new Date()
      return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'
    })

    const cards = computed(() => [
      { label: '短剧总数', value: stats.value.totalDramas, icon: '🎬' },
      { label: '已上架', value: stats.value.onlineDramas, icon: '✅' },
      { label: '草稿箱', value: stats.value.draftDramas, icon: '📝' },
      { label: '总分集', value: stats.value.totalEpisodes, icon: '📚' },
      { label: '今日新增', value: stats.value.todayNewDramas, icon: '🆕' },
      { label: '分类数', value: stats.value.totalCategories, icon: '📂' },
      { label: '标签数', value: stats.value.totalTags, icon: '🏷️' },
      { label: '总浏览量', value: (stats.value.totalViews || 0).toLocaleString(), icon: '👁️' },
    ])

    onMounted(async () => {
      try {
        const res = await API.dashboardStats()
        stats.value = res.data
      } catch (err) { /* */ }
    })

    return { today, cards }
  }
}
