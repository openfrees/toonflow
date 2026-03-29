/**
 * 反馈管理页组件
 */
const FeedbackPage = {
  template: `
    <div>
      <div class="page-header">
        <h2 class="page-title">意见反馈</h2>
      </div>

      <!-- 统计卡片 -->
      <div class="feedback-stats">
        <div class="feedback-stat-card" v-for="item in statCards" :key="item.key"
          :class="{ active: search.status === item.filterVal }"
          @click="filterByStatus(item.filterVal)">
          <div class="feedback-stat-icon" :style="{ background: item.bg }">
            <span>{{ item.icon }}</span>
          </div>
          <div class="feedback-stat-info">
            <div class="feedback-stat-value">{{ stats[item.key] || 0 }}</div>
            <div class="feedback-stat-label">{{ item.label }}</div>
          </div>
        </div>
      </div>

      <!-- 搜索栏 -->
      <div class="search-bar">
        <el-input v-model="search.keyword" placeholder="搜索反馈内容" clearable style="width:220px" @keyup.enter="handleSearch" />
        <el-select v-model="search.type" placeholder="反馈类型" clearable style="width:130px">
          <el-option label="建议" value="suggestion" />
          <el-option label="Bug" value="bug" />
        </el-select>
        <el-select v-model="search.module" placeholder="功能模块" clearable style="width:140px">
          <el-option label="自己写剧本" value="write_script" />
          <el-option label="小说转剧本" value="novel_to_script" />
          <el-option label="模型设置" value="model_settings" />
          <el-option label="其他功能" value="other" />
        </el-select>
        <el-select v-model="search.status" placeholder="处理状态" clearable style="width:130px">
          <el-option label="待处理" :value="0" />
          <el-option label="已处理" :value="1" />
          <el-option label="已关闭" :value="2" />
        </el-select>
        <el-button type="primary" @click="handleSearch">搜索</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>

      <!-- 表格 -->
      <div class="table-card">
        <el-table :data="list" v-loading="loading" stripe style="width:100%">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column label="类型" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="row.type === 'bug' ? 'danger' : 'primary'" size="small" round>
                {{ row.type === 'bug' ? 'Bug' : '建议' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="功能模块" width="120" align="center">
            <template #default="{ row }">
              <span class="feedback-module-tag">{{ moduleText(row.module) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="反馈内容" min-width="260">
            <template #default="{ row }">
              <div class="feedback-content-cell">
                <span class="feedback-content-text">{{ row.content }}</span>
                <div v-if="row.images && row.images.length" class="feedback-img-count">
                  <el-icon><Picture /></el-icon>
                  <span>{{ row.images.length }}张图</span>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="联系方式" width="150">
            <template #default="{ row }">
              <span v-if="row.contact" style="font-size:13px;">{{ row.contact }}</span>
              <span v-else style="color:#ccc;font-size:12px;">未留</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="statusType(row.status)" size="small" effect="light">
                {{ statusText(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="提交时间" width="170">
            <template #default="{ row }">
              <span style="font-size:13px;color:#999;">{{ row.created_at }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140" fixed="right" align="center">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="handleView(row)">查看</el-button>
              <el-button v-if="row.status !== 2" type="warning" link size="small" @click="handleClose(row)">关闭</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-wrap">
          <el-pagination
            v-model:current-page="page"
            v-model:page-size="pageSize"
            :total="total"
            :page-sizes="[10, 20, 50]"
            layout="total, sizes, prev, pager, next"
            @size-change="fetchList"
            @current-change="fetchList"
          />
        </div>
      </div>

      <!-- 详情弹窗（含回复功能） -->
      <el-dialog v-model="detailVisible" title="反馈详情" width="640px" destroy-on-close>
        <div v-if="detailData" class="feedback-detail">
          <!-- 头部信息 -->
          <div class="feedback-detail-header">
            <div class="feedback-detail-meta">
              <el-tag :type="detailData.type === 'bug' ? 'danger' : 'primary'" size="small" round>
                {{ detailData.type === 'bug' ? 'Bug报告' : '功能建议' }}
              </el-tag>
              <el-tag type="info" size="small" round>{{ moduleText(detailData.module) }}</el-tag>
              <el-tag :type="statusType(detailData.status)" size="small" effect="light">
                {{ statusText(detailData.status) }}
              </el-tag>
            </div>
            <div class="feedback-detail-time">{{ detailData.created_at }}</div>
          </div>

          <!-- 用户信息 -->
          <div class="feedback-detail-user" v-if="detailData.user">
            <div class="feedback-detail-avatar">{{ detailData.user.nickname?.charAt(0) || '匿' }}</div>
            <div>
              <div style="font-weight:600;font-size:14px;">{{ detailData.user.nickname || '匿名用户' }}</div>
              <div style="font-size:12px;color:#999;">{{ detailData.user.phone || '' }}</div>
            </div>
          </div>
          <div class="feedback-detail-user" v-else>
            <div class="feedback-detail-avatar anonymous">匿</div>
            <div>
              <div style="font-weight:600;font-size:14px;">匿名用户</div>
              <div style="font-size:12px;color:#999;">未登录提交</div>
            </div>
          </div>

          <!-- 反馈内容 -->
          <div class="feedback-detail-content">
            <div class="feedback-detail-section-title">反馈内容</div>
            <div class="feedback-detail-text">{{ detailData.content }}</div>
          </div>

          <!-- 截图：点击直接放大预览 -->
          <div v-if="detailData.images && detailData.images.length" class="feedback-detail-images">
            <div class="feedback-detail-section-title">截图附件（{{ detailData.images.length }}张）</div>
            <div class="feedback-detail-img-grid">
              <img
                v-for="(img, idx) in detailData.images" :key="idx"
                :src="img"
                class="feedback-detail-img"
                @click="openPreview(idx)"
              />
            </div>
            <!-- 隐藏的 el-image-viewer 用于全屏预览 -->
            <teleport to="body">
              <el-image-viewer
                v-if="previewVisible"
                :url-list="detailData.images"
                :initial-index="previewIndex"
                @close="previewVisible = false"
                :z-index="3000"
              />
            </teleport>
          </div>

          <!-- 联系方式 -->
          <div v-if="detailData.contact" class="feedback-detail-contact">
            <div class="feedback-detail-section-title">联系方式</div>
            <div style="font-size:14px;">{{ detailData.contact }}</div>
          </div>

          <!-- IP -->
          <div class="feedback-detail-ip">
            <span style="color:#ccc;font-size:12px;">IP: {{ detailData.ip || '未知' }}</span>
          </div>

          <!-- 管理员回复（已有回复时展示） -->
          <div v-if="detailData.admin_reply" class="feedback-detail-reply">
            <div class="feedback-detail-section-title">管理员回复</div>
            <div class="feedback-detail-reply-box">
              <div class="feedback-detail-reply-icon">管</div>
              <div class="feedback-detail-reply-text">{{ detailData.admin_reply }}</div>
            </div>
          </div>

          <!-- 回复输入区（待处理时显示） -->
          <div v-if="detailData.status === 0" class="feedback-detail-reply-input">
            <div class="feedback-detail-section-title">回复反馈</div>
            <el-input
              v-model="replyContent"
              type="textarea"
              :rows="3"
              placeholder="请输入回复内容..."
              maxlength="500"
              show-word-limit
            />
            <div style="margin-top:12px;text-align:right;">
              <el-button type="primary" :loading="replyLoading" :disabled="!replyContent.trim()" @click="submitReply">提交回复</el-button>
            </div>
          </div>
        </div>
        <template #footer>
          <el-button @click="detailVisible = false">关闭</el-button>
        </template>
      </el-dialog>
    </div>
  `,
  setup() {
    const { ref, reactive, onMounted } = Vue

    /* 列表相关 */
    const loading = ref(false)
    const list = ref([])
    const page = ref(1)
    const pageSize = ref(20)
    const total = ref(0)
    const search = reactive({ keyword: '', type: '', module: '', status: '' })

    /* 统计数据 */
    const stats = ref({ total: 0, pending: 0, processed: 0, closed: 0 })
    const statCards = [
      { key: 'total', label: '全部反馈', icon: '📋', bg: 'linear-gradient(135deg, #7B68EE20, #7B68EE40)', filterVal: '' },
      { key: 'pending', label: '待处理', icon: '⏳', bg: 'linear-gradient(135deg, #FF4D4F20, #FF4D4F40)', filterVal: 0 },
      { key: 'processed', label: '已处理', icon: '✅', bg: 'linear-gradient(135deg, #52C41A20, #52C41A40)', filterVal: 1 },
      { key: 'closed', label: '已关闭', icon: '🔒', bg: 'linear-gradient(135deg, #99999920, #99999940)', filterVal: 2 },
    ]

    /* 详情弹窗 */
    const detailVisible = ref(false)
    const detailData = ref(null)

    /* 回复（内嵌在详情弹窗中） */
    const replyContent = ref('')
    const replyLoading = ref(false)

    /* 图片预览 */
    const previewVisible = ref(false)
    const previewIndex = ref(0)

    /* 获取统计 */
    async function fetchStats() {
      try {
        const res = await API.feedbackStats()
        stats.value = res.data
      } catch {}
    }

    /* 获取列表 */
    async function fetchList() {
      loading.value = true
      try {
        const params = { page: page.value, pageSize: pageSize.value }
        if (search.keyword) params.keyword = search.keyword
        if (search.type) params.type = search.type
        if (search.module) params.module = search.module
        if (search.status !== '' && search.status !== undefined && search.status !== null) params.status = search.status
        const res = await API.feedbackList(params)
        list.value = res.data.list
        total.value = res.data.pagination.total
      } catch {} finally { loading.value = false }
    }

    function handleSearch() { page.value = 1; fetchList() }
    function handleReset() {
      search.keyword = ''; search.type = ''; search.module = ''; search.status = ''
      page.value = 1; fetchList()
    }

    /* 按状态筛选（点击统计卡片） */
    function filterByStatus(val) {
      search.status = val
      page.value = 1
      fetchList()
    }

    /* 查看详情 */
    async function handleView(row) {
      try {
        const res = await API.feedbackDetail(row.id)
        detailData.value = res.data
        replyContent.value = ''
        detailVisible.value = true
      } catch {}
    }

    /* 图片预览：点击直接全屏 */
    function openPreview(idx) {
      previewIndex.value = idx
      previewVisible.value = true
    }

    /* 提交回复（在详情弹窗内） */
    async function submitReply() {
      if (!replyContent.value.trim()) return
      replyLoading.value = true
      try {
        await API.feedbackReply(detailData.value.id, { reply: replyContent.value })
        ElementPlus.ElMessage.success('回复成功')
        /* 刷新详情数据 */
        const res = await API.feedbackDetail(detailData.value.id)
        detailData.value = res.data
        replyContent.value = ''
        fetchList()
        fetchStats()
      } catch {} finally { replyLoading.value = false }
    }

    /* 关闭反馈 */
    function handleClose(row) {
      ElementPlus.ElMessageBox.confirm('确定关闭这条反馈吗？关闭后不可恢复。', '提示', {
        confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
      }).then(async () => {
        try {
          await API.feedbackUpdateStatus(row.id, { status: 2 })
          ElementPlus.ElMessage.success('已关闭')
          fetchList()
          fetchStats()
        } catch {}
      }).catch(() => {})
    }

    /* 工具函数 */
    function moduleText(m) {
      return {
        write_script: '自己写剧本',
        novel_to_script: '小说转剧本',
        model_settings: '模型设置',
        other: '其他功能',
        buy_vip: '购买VIP',
        review_script: '审阅剧本',
      }[m] || m
    }
    function statusText(s) { return { 0: '待处理', 1: '已处理', 2: '已关闭' }[s] || '未知' }
    function statusType(s) { return { 0: 'danger', 1: 'success', 2: 'info' }[s] || 'info' }

    onMounted(() => { fetchStats(); fetchList() })

    return {
      loading, list, page, pageSize, total, search,
      stats, statCards,
      detailVisible, detailData,
      replyContent, replyLoading,
      previewVisible, previewIndex,
      fetchList, handleSearch, handleReset, filterByStatus,
      handleView, openPreview, submitReply, handleClose,
      moduleText, statusText, statusType,
    }
  }
}
