/**
 * 管理后台 - 订单管理页面
 * 包含收益统计卡片和订单列表
 */
const OrderPage = {
  template: `
    <div class="order-page">
      <h2 class="page-title">订单管理</h2>

      <!-- 收益统计卡片 -->
      <el-row :gutter="16" class="stats-row" v-loading="statsLoading">
        <el-col :span="6">
          <div class="stats-card stats-card--today">
            <div class="stats-card__icon">💰</div>
            <div class="stats-card__info">
              <div class="stats-card__value">¥{{ formatMoney(stats.todayAmount) }}</div>
              <div class="stats-card__label">今日充值</div>
            </div>
            <div class="stats-card__extra">{{ stats.todayCount || 0 }}笔</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stats-card stats-card--week">
            <div class="stats-card__icon">📈</div>
            <div class="stats-card__info">
              <div class="stats-card__value">¥{{ formatMoney(stats.weekAmount) }}</div>
              <div class="stats-card__label">近7日充值</div>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stats-card stats-card--month">
            <div class="stats-card__icon">📊</div>
            <div class="stats-card__info">
              <div class="stats-card__value">¥{{ formatMoney(stats.monthAmount) }}</div>
              <div class="stats-card__label">近30日充值</div>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stats-card stats-card--total">
            <div class="stats-card__icon">🏆</div>
            <div class="stats-card__info">
              <div class="stats-card__value">¥{{ formatMoney(stats.totalAmount) }}</div>
              <div class="stats-card__label">累计充值</div>
            </div>
            <div class="stats-card__extra">共{{ stats.totalCount || 0 }}笔</div>
          </div>
        </el-col>
      </el-row>

      <!-- 筛选区域 -->
      <div class="filter-bar">
        <el-select v-model="filterStatus" placeholder="订单状态" clearable style="width: 140px" @change="handleFilter">
          <el-option label="全部状态" value="" />
          <el-option label="待支付" :value="0" />
          <el-option label="已支付" :value="1" />
          <el-option label="已过期" :value="2" />
          <el-option label="已退款" :value="3" />
        </el-select>
        <el-autocomplete
          v-model="userKeyword"
          :fetch-suggestions="handleUserSearch"
          placeholder="搜索用户（ID/手机号/昵称）"
          clearable
          style="width: 240px"
          :trigger-on-focus="false"
          @select="handleUserSelect"
          @clear="clearUserSelection"
        >
          <template #prefix><el-icon><User /></el-icon></template>
        </el-autocomplete>
        <el-input v-model="keyword" placeholder="搜索订单号/交易号" clearable style="width: 240px" @keyup.enter="handleFilter">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button type="primary" @click="handleFilter">
          <el-icon><Search /></el-icon> 搜索
        </el-button>
        <el-button @click="resetFilter">
          <el-icon><RefreshRight /></el-icon> 重置
        </el-button>
      </div>

      <!-- 订单列表 -->
      <div class="table-card">
      <el-table :data="orderList" v-loading="tableLoading" stripe style="width: 100%">
        <el-table-column prop="order_no" label="订单号" min-width="200" show-overflow-tooltip />
        <el-table-column label="用户编号" width="100">
          <template #default="{ row }">{{ row.user_no || '-' }}</template>
        </el-table-column>
        <el-table-column label="类型" width="100" align="center">
          <template #default="{ row }">
            <el-tag type="warning" size="small">VIP会员</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="支付方式" width="100" align="center">
          <template #default="{ row }">
            <span>{{ row.pay_method === 'alipay' ? '支付宝' : '微信' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="金额" width="110" align="right">
          <template #default="{ row }">
            <span style="color: #ff6b35; font-weight: 600;">¥{{ Number(row.amount).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="商品" prop="product_name" min-width="160" show-overflow-tooltip />
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="支付宝交易号" prop="trade_no" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.trade_no || '-' }}</template>
        </el-table-column>
        <el-table-column label="支付时间" width="170">
          <template #default="{ row }">{{ row.paid_at || '-' }}</template>
        </el-table-column>
        <el-table-column label="创建时间" prop="created_at" width="170" />
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadList"
          @current-change="loadList"
        />
      </div>
      </div>
    </div>
  `,
  setup() {
    const { ref, reactive, onMounted } = Vue

    /* ===== 收益统计 ===== */
    const statsLoading = ref(false)
    const stats = reactive({
      todayAmount: 0,
      weekAmount: 0,
      monthAmount: 0,
      totalAmount: 0,
      todayCount: 0,
      totalCount: 0,
    })

    async function loadStats() {
      statsLoading.value = true
      try {
        const res = await API.orderStats()
        Object.assign(stats, res.data || {})
      } catch (e) { /* 错误已被拦截器处理 */ }
      statsLoading.value = false
    }

    /* ===== 订单列表 ===== */
    const tableLoading = ref(false)
    const orderList = ref([])
    const filterStatus = ref(1)
    const keyword = ref('')
    const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

    /* ===== 用户搜索 ===== */
    const userKeyword = ref('')
    const selectedUser = ref(null) // 选中的用户对象
    const userSearchLoading = ref(false)
    const userSuggestions = ref([])

    /* 用户搜索 - 远程搜索 */
    async function handleUserSearch(queryString, cb) {
      if (!queryString || queryString.trim() === '') {
        cb([])
        return
      }

      userSearchLoading.value = true
      try {
        const res = await API.userSearch(queryString)
        const suggestions = (res.data || []).map(user => ({
          value: `${user.nickname} (${user.phone || user.user_no})`,
          user: user,
        }))
        cb(suggestions)
      } catch (e) {
        cb([])
      }
      userSearchLoading.value = false
    }

    /* 选中用户 */
    function handleUserSelect(item) {
      selectedUser.value = item.user
      userKeyword.value = `${item.user.nickname} (${item.user.phone || item.user.user_no})`
      pagination.page = 1
      loadList()
    }

    /* 清空用户选择 */
    function clearUserSelection() {
      selectedUser.value = null
      userKeyword.value = ''
      pagination.page = 1
      loadList()
    }

    async function loadList() {
      tableLoading.value = true
      try {
        const params = {
          page: pagination.page,
          pageSize: pagination.pageSize,
        }
        if (filterStatus.value !== '' && filterStatus.value !== null) params.status = filterStatus.value
        if (keyword.value) params.keyword = keyword.value
        if (selectedUser.value) params.userId = selectedUser.value.id

        const res = await API.orderList(params)
        orderList.value = res.data?.list || []
        pagination.total = res.data?.pagination?.total || 0
      } catch (e) { /* 错误已被拦截器处理 */ }
      tableLoading.value = false
    }

    function handleFilter() {
      pagination.page = 1
      loadList()
    }

    function resetFilter() {
      filterStatus.value = 1
      keyword.value = ''
      selectedUser.value = null
      userKeyword.value = ''
      pagination.page = 1
      loadList()
    }

    /* ===== 状态显示 ===== */
    function statusText(s) {
      return { 0: '待支付', 1: '已支付', 2: '已过期', 3: '已退款' }[s] || '未知'
    }
    function statusTagType(s) {
      return { 0: 'warning', 1: 'success', 2: 'info', 3: 'danger' }[s] || 'info'
    }
    function formatMoney(v) {
      return Number(v || 0).toFixed(2)
    }

    onMounted(() => {
      loadStats()
      loadList()
    })

    return {
      statsLoading, stats,
      tableLoading, orderList, filterStatus, keyword, pagination,
      userKeyword, selectedUser, userSearchLoading, userSuggestions,
      loadStats, loadList, handleFilter, resetFilter,
      handleUserSearch, handleUserSelect, clearUserSelection,
      statusText, statusTagType, formatMoney,
    }
  }
}
