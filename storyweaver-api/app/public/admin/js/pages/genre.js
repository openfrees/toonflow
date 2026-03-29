/**
 * 题材类型管理页组件
 */
const GenrePage = {
  template: `
    <div>
      <div class="page-header">
        <h2 class="page-title">题材类型管理</h2>
        <el-button type="primary" @click="handleAdd">+ 新增题材</el-button>
      </div>
      <div style="margin-bottom:16px;">
        <el-radio-group v-model="filterCategory" @change="fetchList">
          <el-radio-button label="">全部</el-radio-button>
          <el-radio-button label="时代背景">时代背景</el-radio-button>
          <el-radio-button label="主题情节">主题情节</el-radio-button>
          <el-radio-button label="角色设定">角色设定</el-radio-button>
        </el-radio-group>
      </div>
      <div class="table-card">
        <el-table :data="list" v-loading="loading" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="name" label="题材名称" min-width="120" />
          <el-table-column prop="category" label="所属分类" width="120">
            <template #default="{ row }">
              <el-tag :type="categoryType(row.category)" size="small">{{ row.category }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="sort_order" label="排序" width="100" align="center" />
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="row.is_enabled===1?'success':'danger'" size="small">{{ row.is_enabled===1?'启用':'禁用' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="180" align="center">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="handleEdit(row)">编辑</el-button>
              <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <el-dialog v-model="dialogVisible" :title="dialogForm.id ? '编辑题材' : '新增题材'" width="500px" destroy-on-close>
        <el-form ref="dialogFormRef" :model="dialogForm" :rules="dialogRules" label-width="80px">
          <el-form-item label="名称" prop="name">
            <el-input v-model="dialogForm.name" placeholder="请输入题材名称" maxlength="20" />
          </el-form-item>
          <el-form-item label="分类" prop="category">
            <el-select v-model="dialogForm.category" placeholder="请选择分类" style="width:100%">
              <el-option label="时代背景" value="时代背景" />
              <el-option label="主题情节" value="主题情节" />
              <el-option label="角色设定" value="角色设定" />
            </el-select>
          </el-form-item>
          <el-form-item label="排序">
            <el-input-number v-model="dialogForm.sort_order" :min="0" />
          </el-form-item>
          <el-form-item label="状态">
            <el-switch v-model="dialogForm.is_enabled" :active-value="1" :inactive-value="0" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="submitLoading" @click="handleSubmit">确定</el-button>
        </template>
      </el-dialog>
    </div>
  `,
  setup() {
    const { ref, reactive, onMounted } = Vue
    const loading = ref(false)
    const list = ref([])
    const filterCategory = ref('')
    const dialogVisible = ref(false)
    const submitLoading = ref(false)
    const dialogFormRef = ref(null)
    const dialogForm = reactive({ id: '', name: '', category: '', sort_order: 0, is_enabled: 1 })
    const dialogRules = {
      name: [{ required: true, message: '请输入题材名称', trigger: 'blur' }],
      category: [{ required: true, message: '请选择分类', trigger: 'change' }],
    }

    function categoryType(cat) {
      if (cat === '时代背景') return ''
      if (cat === '主题情节') return 'success'
      if (cat === '角色设定') return 'warning'
      return 'info'
    }

    async function fetchList() {
      loading.value = true
      try {
        const params = {}
        if (filterCategory.value) params.category = filterCategory.value
        const res = await API.genreList(params)
        list.value = res.data
      } catch {} finally { loading.value = false }
    }

    function handleAdd() {
      Object.assign(dialogForm, { id: '', name: '', category: '', sort_order: 0, is_enabled: 1 })
      dialogVisible.value = true
    }
    function handleEdit(row) {
      Object.assign(dialogForm, row)
      dialogVisible.value = true
    }

    async function handleSubmit() {
      try { await dialogFormRef.value.validate() } catch { return }
      submitLoading.value = true
      try {
        if (dialogForm.id) {
          await API.genreUpdate(dialogForm.id, dialogForm)
          ElementPlus.ElMessage.success('修改成功')
        } else {
          await API.genreCreate(dialogForm)
          ElementPlus.ElMessage.success('创建成功')
        }
        dialogVisible.value = false
        fetchList()
      } catch {} finally { submitLoading.value = false }
    }

    function handleDelete(row) {
      ElementPlus.ElMessageBox.confirm('确定删除「' + row.name + '」吗？', '提示', {
        confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
      }).then(async () => {
        try { await API.genreDelete(row.id); ElementPlus.ElMessage.success('删除成功'); fetchList() } catch {}
      }).catch(() => {})
    }

    onMounted(fetchList)
    return { loading, list, filterCategory, dialogVisible, submitLoading, dialogFormRef, dialogForm, dialogRules, categoryType, fetchList, handleAdd, handleEdit, handleSubmit, handleDelete }
  }
}
