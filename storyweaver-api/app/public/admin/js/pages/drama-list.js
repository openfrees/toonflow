/**
 * 短剧列表页组件
 */
const DramaListPage = {
  template: `
    <div>
      <div class="page-header">
        <h2 class="page-title">短剧管理</h2>
        <el-button type="primary" @click="$router.push('/drama/edit')">+ 新增短剧</el-button>
      </div>

      <!-- 搜索栏 -->
      <div class="search-bar">
        <el-input v-model="search.title" placeholder="搜索标题" clearable style="width:220px" @keyup.enter="handleSearch" />
        <el-select v-model="search.status" placeholder="状态" clearable style="width:120px">
          <el-option label="已上架" :value="1" />
          <el-option label="已下架" :value="0" />
          <el-option label="草稿" :value="2" />
        </el-select>
        <el-select v-model="search.grade" placeholder="评级" clearable style="width:120px">
          <el-option label="S" value="S" />
          <el-option label="A+" value="A+" />
          <el-option label="A" value="A" />
          <el-option label="B+" value="B+" />
          <el-option label="B" value="B" />
        </el-select>
        <el-button type="primary" @click="handleSearch">搜索</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>

      <!-- 表格 -->
      <div class="table-card">
        <el-table :data="list" v-loading="loading" stripe style="width:100%">
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column label="封面" width="80">
            <template #default="{ row }">
              <img v-if="row.cover" :src="row.cover" style="width:50px;height:66px;border-radius:6px;object-fit:cover;" />
              <span v-else style="color:#ccc;font-size:12px;">暂无</span>
            </template>
          </el-table-column>
          <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
          <el-table-column prop="total_episodes" label="集数" width="70" align="center" />
          <el-table-column prop="word_count" label="字数" width="80" align="center" />
          <el-table-column label="评级" width="70" align="center">
            <template #default="{ row }">
              <el-tag :type="gradeType(row.grade)" size="small" round>{{ row.grade || '-' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="score" label="评分" width="70" align="center" />
          <el-table-column label="价格" width="100" align="right">
            <template #default="{ row }">
              <span style="color:#FF4D4F;font-weight:600;">¥{{ row.price }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="80" align="center">
            <template #default="{ row }">
              <el-tag :type="statusType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right" align="center">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="$router.push('/drama/edit/' + row.id)">编辑</el-button>
              <el-button v-if="row.status===1" type="warning" link size="small" @click="toggleStatus(row,0)">下架</el-button>
              <el-button v-else type="success" link size="small" @click="toggleStatus(row,1)">上架</el-button>
              <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
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
    </div>
  `,
  setup() {
    const { ref, reactive, onMounted } = Vue

    const loading = ref(false)
    const list = ref([])
    const page = ref(1)
    const pageSize = ref(10)
    const total = ref(0)
    const search = reactive({ title: '', status: '', grade: '' })

    async function fetchList() {
      loading.value = true
      try {
        const res = await API.dramaList({ page: page.value, pageSize: pageSize.value, ...search })
        list.value = res.data.list
        total.value = res.data.pagination.total
      } catch (err) { /* */ } finally { loading.value = false }
    }

    function handleSearch() { page.value = 1; fetchList() }
    function handleReset() { search.title = ''; search.status = ''; search.grade = ''; page.value = 1; fetchList() }

    async function toggleStatus(row, status) {
      try {
        await API.dramaBatchStatus({ ids: [row.id], status })
        ElementPlus.ElMessage.success(status === 1 ? '上架成功' : '下架成功')
        fetchList()
      } catch (err) { /* */ }
    }

    function handleDelete(row) {
      ElementPlus.ElMessageBox.confirm('确定删除「' + row.title + '」吗？不可恢复！', '警告', {
        confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
      }).then(async () => {
        try { await API.dramaDelete(row.id); ElementPlus.ElMessage.success('删除成功'); fetchList() } catch {}
      }).catch(() => {})
    }

    function gradeType(g) { return { S:'danger','A+':'warning',A:'','B+':'info',B:'info' }[g] || 'info' }
    function statusText(s) { return { 1:'已上架',0:'已下架',2:'草稿' }[s] || '未知' }
    function statusType(s) { return { 1:'success',0:'danger',2:'warning' }[s] || 'info' }

    onMounted(fetchList)

    return { loading, list, page, pageSize, total, search, fetchList, handleSearch, handleReset, toggleStatus, handleDelete, gradeType, statusText, statusType }
  }
}
