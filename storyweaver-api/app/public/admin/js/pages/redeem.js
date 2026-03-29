/**
 * 兑换码管理页组件
 */
const RedeemPage = {
  template: `
    <div>
      <div class="page-header">
        <h2 class="page-title">兑换码管理</h2>
        <el-button type="primary" @click="handleGenerate">+ 生成兑换码</el-button>
      </div>

      <!-- 筛选栏 -->
      <div class="table-card" style="margin-bottom:16px;padding:16px 20px;">
        <el-form :inline="true" :model="filters" @submit.prevent="fetchList">
          <el-form-item label="状态">
            <el-select v-model="filters.status" placeholder="全部" clearable style="width:140px;" @change="fetchList">
              <el-option label="全部" value="" />
              <el-option label="未使用" value="unused" />
              <el-option label="已用完" value="used" />
              <el-option label="已过期" value="expired" />
              <el-option label="已禁用" value="disabled" />
            </el-select>
          </el-form-item>
          <el-form-item label="搜索">
            <el-input v-model="filters.keyword" placeholder="兑换码/备注" clearable style="width:200px;" @keyup.enter="fetchList" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="fetchList">查询</el-button>
          </el-form-item>
        </el-form>
      </div>

      <!-- 列表 -->
      <div class="table-card">
        <el-table :data="list" v-loading="loading" stripe>
          <el-table-column prop="code" label="兑换码" width="140">
            <template #default="{ row }">
              <span style="font-family:monospace;font-weight:600;letter-spacing:1px;">{{ row.code }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="points" label="面值" width="100" align="center" />
          <el-table-column label="使用次数" width="120" align="center">
            <template #default="{ row }">
              <span>{{ row.used_count }} / {{ row.max_uses }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="expire_at" label="过期时间" width="180" />
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.status_label==='unused'" type="success" size="small">未使用</el-tag>
              <el-tag v-else-if="row.status_label==='used'" type="info" size="small">已用完</el-tag>
              <el-tag v-else-if="row.status_label==='expired'" type="warning" size="small">已过期</el-tag>
              <el-tag v-else-if="row.status_label==='disabled'" type="danger" size="small">已禁用</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
          <el-table-column prop="created_at" label="创建时间" width="180" />
          <el-table-column label="操作" width="180" align="center" fixed="right">
            <template #default="{ row }">
              <el-button v-if="row.status===1" type="warning" link size="small" @click="handleToggleStatus(row, 0)">禁用</el-button>
              <el-button v-else type="success" link size="small" @click="handleToggleStatus(row, 1)">启用</el-button>
              <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
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

      <!-- 生成兑换码弹窗 -->
      <el-dialog v-model="genDialogVisible" title="生成兑换码" width="520px" destroy-on-close>
        <el-form ref="genFormRef" :model="genForm" :rules="genRules" label-width="100px">
          <el-form-item label="生成数量" prop="count">
            <el-input-number v-model="genForm.count" :min="1" :max="100" />
          </el-form-item>
          <el-form-item label="面值" prop="points">
            <el-input-number v-model="genForm.points" :min="1" :max="999999" />
          </el-form-item>
          <el-form-item label="使用次数" prop="max_uses">
            <el-input-number v-model="genForm.max_uses" :min="1" :max="99999" />
            <span style="margin-left:8px;font-size:12px;color:#999;">每个兑换码可使用次数</span>
          </el-form-item>
          <el-form-item label="过期时间" prop="expire_at">
            <el-date-picker v-model="genForm.expire_at" type="datetime" placeholder="选择过期时间" format="YYYY-MM-DD HH:mm:ss" value-format="YYYY-MM-DD HH:mm:ss" style="width:100%;" />
          </el-form-item>
          <el-form-item label="备注">
            <el-input v-model="genForm.remark" type="textarea" :rows="2" placeholder="可选，如：活动赠送" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="genDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="genLoading" @click="handleGenSubmit">生成</el-button>
        </template>
      </el-dialog>

      <!-- 生成结果弹窗 -->
      <el-dialog v-model="resultDialogVisible" title="生成成功" width="480px">
        <div style="margin-bottom:12px;color:#666;">成功生成 <strong>{{ genResult.count }}</strong> 个兑换码：</div>
        <div style="max-height:300px;overflow-y:auto;background:#f5f7fa;border-radius:8px;padding:12px;">
          <div v-for="code in genResult.codes" :key="code" style="font-family:monospace;font-size:15px;padding:4px 0;letter-spacing:2px;font-weight:600;">
            {{ code }}
          </div>
        </div>
        <template #footer>
          <el-button @click="handleCopyCodes">复制全部</el-button>
          <el-button type="primary" @click="resultDialogVisible = false">关闭</el-button>
        </template>
      </el-dialog>
    </div>
  `,
  setup() {
    const { ref, reactive, onMounted } = Vue
    const loading = ref(false)
    const list = ref([])
    const filters = reactive({ status: '', keyword: '' })
    const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

    /* 生成弹窗 */
    const genDialogVisible = ref(false)
    const genLoading = ref(false)
    const genFormRef = ref(null)
    const genForm = reactive({ count: 1, points: 100, max_uses: 1, expire_at: '', remark: '' })
    const genRules = {
      points: [{ required: true, message: '请输入面值', trigger: 'blur' }],
      expire_at: [{ required: true, message: '请选择过期时间', trigger: 'change' }],
    }

    /* 生成结果 */
    const resultDialogVisible = ref(false)
    const genResult = reactive({ count: 0, codes: [] })

    async function fetchList() {
      loading.value = true
      try {
        const res = await API.redeemList({ ...filters, page: pagination.page, pageSize: pagination.pageSize })
        list.value = res.data.list
        Object.assign(pagination, res.data.pagination)
      } catch {} finally { loading.value = false }
    }

    function handleGenerate() {
      Object.assign(genForm, { count: 1, points: 100, max_uses: 1, expire_at: '', remark: '' })
      genDialogVisible.value = true
    }

    async function handleGenSubmit() {
      try { await genFormRef.value.validate() } catch { return }
      genLoading.value = true
      try {
        const res = await API.redeemGenerate(genForm)
        genDialogVisible.value = false
        Object.assign(genResult, res.data)
        resultDialogVisible.value = true
        fetchList()
        ElementPlus.ElMessage.success('生成成功')
      } catch {} finally { genLoading.value = false }
    }

    async function handleToggleStatus(row, status) {
      const label = status === 1 ? '启用' : '禁用'
      try {
        await ElementPlus.ElMessageBox.confirm('确定' + label + '兑换码「' + row.code + '」吗？', '提示', {
          confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
        })
        await API.redeemUpdateStatus(row.id, { status })
        ElementPlus.ElMessage.success(label + '成功')
        fetchList()
      } catch {}
    }

    function handleDelete(row) {
      ElementPlus.ElMessageBox.confirm('确定删除兑换码「' + row.code + '」吗？删除后不可恢复。', '提示', {
        confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
      }).then(async () => {
        try { await API.redeemDelete(row.id); ElementPlus.ElMessage.success('删除成功'); fetchList() } catch {}
      }).catch(() => {})
    }

    function handleCopyCodes() {
      const text = genResult.codes.join('\n')
      navigator.clipboard.writeText(text).then(() => {
        ElementPlus.ElMessage.success('已复制到剪贴板')
      }).catch(() => {
        ElementPlus.ElMessage.warning('复制失败，请手动复制')
      })
    }

    onMounted(fetchList)
    return {
      loading, list, filters, pagination, fetchList,
      genDialogVisible, genLoading, genFormRef, genForm, genRules, handleGenerate, handleGenSubmit,
      resultDialogVisible, genResult, handleCopyCodes,
      handleToggleStatus, handleDelete,
    }
  }
}
