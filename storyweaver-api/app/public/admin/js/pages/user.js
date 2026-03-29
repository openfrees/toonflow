/**
 * 管理后台 - 用户管理页面
 * 包含注册统计卡片 + 筛选栏 + 用户列表 + 状态操作
 */
const UserPage = {
  template: `
    <div class="user-page">
      <h2 class="page-title">用户管理</h2>

      <!-- 注册统计卡片 -->
      <el-row :gutter="16" class="stats-row" v-loading="statsLoading">
        <el-col :span="6">
          <div class="stats-card stats-card--today">
            <div class="stats-card__icon">🆕</div>
            <div class="stats-card__info">
              <div class="stats-card__value">{{ stats.todayCount }}</div>
              <div class="stats-card__label">今日注册</div>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stats-card stats-card--week">
            <div class="stats-card__icon">📈</div>
            <div class="stats-card__info">
              <div class="stats-card__value">{{ stats.weekCount }}</div>
              <div class="stats-card__label">近7日注册</div>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stats-card stats-card--month">
            <div class="stats-card__icon">📊</div>
            <div class="stats-card__info">
              <div class="stats-card__value">{{ stats.monthCount }}</div>
              <div class="stats-card__label">近30日注册</div>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stats-card stats-card--total">
            <div class="stats-card__icon">👥</div>
            <div class="stats-card__info">
              <div class="stats-card__value">{{ stats.totalCount }}</div>
              <div class="stats-card__label">累计注册</div>
            </div>
          </div>
        </el-col>
      </el-row>

      <!-- 筛选区域 -->
      <div class="filter-bar">
        <el-select v-model="filterStatus" placeholder="用户状态" clearable style="width: 130px" @change="handleFilter">
          <el-option label="全部状态" value="" />
          <el-option label="正常" :value="1" />
          <el-option label="禁用" :value="0" />
        </el-select>
        <el-select v-model="filterLoginType" placeholder="注册方式" clearable style="width: 140px" @change="handleFilter">
          <el-option label="全部方式" value="" />
          <el-option label="手机验证码" value="phone" />
          <el-option label="微信扫码" value="wechat" />
        </el-select>
        <el-select v-model="filterVipTierId" placeholder="会员类型" clearable style="width: 140px" @change="handleFilter">
          <el-option label="全部会员" value="" />
          <el-option label="普通用户" value="0" />
          <el-option v-for="t in vipTiers" :key="t.id" :label="t.name" :value="String(t.id)" />
        </el-select>
        <el-input v-model="keyword" placeholder="搜索手机号/昵称" clearable style="width: 220px" @keyup.enter="handleFilter">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button type="primary" @click="handleFilter">
          <el-icon><Search /></el-icon> 搜索
        </el-button>
        <el-button @click="resetFilter">
          <el-icon><RefreshRight /></el-icon> 重置
        </el-button>
      </div>

      <!-- 用户列表 -->
      <div class="table-card">
      <el-table :data="userList" v-loading="tableLoading" stripe style="width: 100%">
        <el-table-column label="用户编号" width="110" align="center">
          <template #default="{ row }">
            <span class="user-id-text">{{ row.user_no || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="用户信息" min-width="180">
          <template #default="{ row }">
            <div class="user-info-cell">
              <div class="user-avatar-mini" :style="{ background: avatarBg(row.nickname) }">
                {{ (row.nickname || '?').charAt(0) }}
              </div>
              <div class="user-info-text">
                <div class="user-nickname">{{ row.nickname || '未设置' }}</div>
                <div class="user-phone">{{ maskPhone(row.phone) }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="注册方式" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="loginTypeTag(row.login_type)" size="small" effect="plain">
              {{ loginTypeText(row.login_type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="会员类型" width="130" align="center">
          <template #default="{ row }">
            <span :style="{ color: vipDisplay(row).color, fontSize: '13px', fontWeight: vipDisplay(row).bold ? 600 : 400 }">
              {{ vipDisplay(row).label }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="会员到期" width="120" align="center">
          <template #default="{ row }">
            <template v-if="row.vip_expires_at && isVipActive(row)">
              <span :style="{ color: isVipExpiringSoon(row) ? '#E6A23C' : '#333', fontSize: '13px' }">
                {{ formatDate(row.vip_expires_at) }}
              </span>
            </template>
            <template v-else>
              <span style="color: #ccc;">-</span>
            </template>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
              {{ row.status === 1 ? '正常' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="注册时间" width="170">
          <template #default="{ row }">{{ row.created_at || '-' }}</template>
        </el-table-column>
        <el-table-column label="最后登录" width="170">
          <template #default="{ row }">{{ row.last_login_at || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" align="center" fixed="right">
          <template #default="{ row }">
            <el-button
              :type="row.status === 1 ? 'danger' : 'success'"
              size="small"
              link
              @click="toggleStatus(row)"
            >
              {{ row.status === 1 ? '禁用' : '启用' }}
            </el-button>
            <el-button
              type="danger"
              size="small"
              link
              @click="destroyUser(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
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

    /* ===== VIP等级列表（用于筛选下拉） ===== */
    const vipTiers = ref([])
    async function loadVipTiers() {
      try {
        const res = await API.vipTiers()
        vipTiers.value = (res.data || []).map(t => ({
          id: t.id,
          name: t.name,
        }))
      } catch (e) { /* 失败静默 */ }
    }

    /* ===== 注册统计 ===== */
    const statsLoading = ref(false)
    const stats = reactive({
      todayCount: 0,
      weekCount: 0,
      monthCount: 0,
      totalCount: 0,
    })

    async function loadStats() {
      statsLoading.value = true
      try {
        const res = await API.userStats()
        Object.assign(stats, res.data || {})
      } catch (e) { /* 拦截器已处理 */ }
      statsLoading.value = false
    }

    /* ===== 用户列表 ===== */
    const tableLoading = ref(false)
    const userList = ref([])
    const filterStatus = ref('')
    const filterLoginType = ref('')
    const filterVipTierId = ref('')
    const keyword = ref('')
    const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

    async function loadList() {
      tableLoading.value = true
      try {
        const params = {
          page: pagination.page,
          pageSize: pagination.pageSize,
        }
        if (filterStatus.value !== '' && filterStatus.value !== null) params.status = filterStatus.value
        if (filterLoginType.value) params.loginType = filterLoginType.value
        if (filterVipTierId.value !== '' && filterVipTierId.value !== null) params.vipTierId = filterVipTierId.value
        if (keyword.value) params.keyword = keyword.value

        const res = await API.userList(params)
        userList.value = res.data?.list || []
        pagination.total = res.data?.pagination?.total || 0
      } catch (e) { /* 拦截器已处理 */ }
      tableLoading.value = false
    }

    function handleFilter() {
      pagination.page = 1
      loadList()
    }

    function resetFilter() {
      filterStatus.value = ''
      filterLoginType.value = ''
      filterVipTierId.value = ''
      keyword.value = ''
      pagination.page = 1
      loadList()
    }

    /* ===== 状态切换 ===== */
    async function toggleStatus(row) {
      const newStatus = row.status === 1 ? 0 : 1
      const action = newStatus === 0 ? '禁用' : '启用'
      try {
        await ElementPlus.ElMessageBox.confirm(
          `确定要${action}用户「${row.nickname || row.phone || row.id}」吗？`,
          '操作确认',
          { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
        )
        await API.userUpdateStatus(row.id, { status: newStatus })
        ElementPlus.ElMessage.success(`已${action}`)
        loadList()
        loadStats()
      } catch (e) {
        /* 用户取消或接口报错，拦截器已处理 */
      }
    }

    /* ===== 一键删除用户（临时测试功能） ===== */
    async function destroyUser(row) {
      const name = row.nickname || row.phone || row.id
      try {
        await ElementPlus.ElMessageBox.confirm(
          `即将永久删除用户「${name}」的所有数据，包括：充值订单、兑换记录、剧本、小说项目、章节原文、故事线、分集大纲、资产、AI聊天记录、反馈等。此操作不可恢复！`,
          '危险操作 - 删除用户',
          {
            confirmButtonText: '确认删除',
            cancelButtonText: '取消',
            type: 'error',
            confirmButtonClass: 'el-button--danger',
          }
        )
        /* 二次确认 */
        await ElementPlus.ElMessageBox.confirm(
          `再次确认：真的要删除「${name}」吗？`,
          '最终确认',
          { confirmButtonText: '删除', cancelButtonText: '取消', type: 'error' }
        )
        const res = await API.userDestroy(row.id)
        const d = res.data || {}
        ElementPlus.ElMessage.success(
          `已删除用户「${name}」，清理数据：剧本${d.script || 0}个、小说项目${d.novel_project || 0}个、订单${d.recharge_order || 0}条`
        )
        loadList()
        loadStats()
      } catch (e) {
        /* 用户取消或接口报错，拦截器已处理 */
      }
    }

    /* ===== 工具函数 ===== */
    function maskPhone(phone) {
      if (!phone) return '-'
      return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
    }

    function loginTypeText(type) {
      return { password: '账号密码', phone: '手机验证', wechat: '微信扫码' }[type] || '未知'
    }

    function loginTypeTag(type) {
      return { password: 'info', phone: 'success', wechat: '' }[type] || 'info'
    }

    function formatDate(dateStr) {
      if (!dateStr) return '-'
      return dateStr.substring(0, 10)
    }

    function isVipActive(row) {
      if (!row.vip_expires_at) return false
      return new Date(row.vip_expires_at) > new Date()
    }

    /* 会员类型展示：纯文字 + 颜色区分（只显示等级名，套餐类型属于订单维度） */
    const vipColorMap = {
      '黄金会员': { label: '黄金会员', color: '#E6A23C', bold: true },
      '铂金会员': { label: '铂金会员', color: '#409EFF', bold: true },
      '黑金会员': { label: '黑金会员', color: '#303133', bold: true },
    }
    function vipDisplay(row) {
      if (!row.vip_tier_name || !isVipActive(row)) {
        return { label: '普通用户', color: '#999', bold: false }
      }
      return vipColorMap[row.vip_tier_name] || { label: row.vip_tier_name, color: '#999', bold: false }
    }

    function isVipExpiringSoon(row) {
      if (!row.vip_expires_at) return false
      const diff = new Date(row.vip_expires_at) - new Date()
      return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000
    }

    /* 头像背景色：根据昵称首字符取一个稳定的颜色 */
    function avatarBg(name) {
      const colors = [
        'linear-gradient(135deg, #7B68EE, #9E8FFF)',
        'linear-gradient(135deg, #FF6B35, #FF9A5C)',
        'linear-gradient(135deg, #52C41A, #73D13D)',
        'linear-gradient(135deg, #1677FF, #4096FF)',
        'linear-gradient(135deg, #FF85C0, #FFA6D4)',
        'linear-gradient(135deg, #FAAD14, #FFC53D)',
        'linear-gradient(135deg, #13C2C2, #36CFC9)',
        'linear-gradient(135deg, #722ED1, #9254DE)',
      ]
      const code = (name || '?').charCodeAt(0)
      return colors[code % colors.length]
    }

    onMounted(() => {
      loadVipTiers()
      loadStats()
      loadList()
    })

    return {
      vipTiers,
      statsLoading, stats,
      tableLoading, userList,
      filterStatus, filterLoginType, filterVipTierId, keyword, pagination,
      loadStats, loadList, handleFilter, resetFilter, toggleStatus, destroyUser,
      maskPhone, loginTypeText, loginTypeTag, formatDate,
      isVipActive, isVipExpiringSoon, avatarBg, vipDisplay,
    }
  }
}
