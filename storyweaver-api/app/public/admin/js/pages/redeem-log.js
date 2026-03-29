/**
 * 兑换记录页组件
 */
const RedeemLogPage = {
  template: `
    <div>
      <div class="page-header">
        <h2 class="page-title">兑换记录</h2>
      </div>

      <!-- 筛选栏 -->
      <div class="table-card" style="margin-bottom:16px;padding:16px 20px;">
        <el-form :inline="true" :model="filters" @submit.prevent="fetchList">
          <el-form-item label="搜索">
            <el-input v-model="filters.keyword" placeholder="兑换码/用户手机号" clearable style="width:220px;" @keyup.enter="fetchList" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="fetchList">查询</el-button>
          </el-form-item>
        </el-form>
      </div>

      <!-- 列表 -->
      <div class="table-card">
        <el-table :data="list" v-loading="loading" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="code" label="兑换码" width="140">
            <template #default="{ row }">
              <span style="font-family:monospace;font-weight:600;letter-spacing:1px;">{{ row.code }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="points" label="获得面值" width="100" align="center">
            <template #default="{ row }">
              <span style="color:#67C23A;font-weight:600;">+{{ row.points }}</span>
            </template>
          </el-table-column>
          <el-table-column label="用户" min-width="180">
            <template #default="{ row }">
              <div style="display:flex;align-items:center;gap:8px;">
                <div style="width:32px;height:32px;border-radius:50%;background:#7B68EE;color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">
                  {{ (row.user_nickname || '?').charAt(0) }}
                </div>
                <div>
                  <div style="font-size:13px;">{{ row.user_nickname || '-' }}</div>
                  <div style="font-size:12px;color:#999;">{{ row.user_phone || '-' }}</div>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="created_at" label="兑换时间" width="180" />
        </el-table>

        <!-- 分页 -->
        <div style="display:flex;justify-content:flex-end;margin-top:16px;" v-if="pagination.total > 0">
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :total="pagination.total"
            :page-sizes="[10, 20, 50]"
            layout="total, sizes, prev, pager, next"
            @size-change="fetchList"
            @current-change="fetchList"
          />
        </div>
      </div>
    </div>
  `,
  setup() {
    const { ref, reactive, onMounted } = Vue
    const loading = ref(false)
    const list = ref([])
    const filters = reactive({ keyword: '' })
    const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

    async function fetchList() {
      loading.value = true
      try {
        const res = await API.redeemLogList({ ...filters, page: pagination.page, pageSize: pagination.pageSize })
        list.value = res.data.list
        Object.assign(pagination, res.data.pagination)
      } catch {} finally { loading.value = false }
    }

    onMounted(fetchList)
    return { loading, list, filters, pagination, fetchList }
  }
}
