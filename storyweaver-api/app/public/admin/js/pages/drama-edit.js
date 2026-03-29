/**
 * 短剧编辑页组件
 */
const DramaEditPage = {
  template: `
    <div>
      <div class="page-header">
        <h2 class="page-title">{{ isEdit ? '编辑短剧' : '新增短剧' }}</h2>
        <el-button @click="$router.push('/drama')">← 返回列表</el-button>
      </div>

      <div class="form-card">
        <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" size="large">
          <el-row :gutter="24">
            <el-col :span="12">
              <el-form-item label="短剧标题" prop="title">
                <el-input v-model="form.title" placeholder="请输入短剧标题" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="作者">
                <el-input v-model="form.author" placeholder="请输入作者" />
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item label="封面图URL">
            <el-input v-model="form.cover" placeholder="请输入封面图URL" />
          </el-form-item>

          <el-form-item label="短剧简介">
            <el-input v-model="form.description" type="textarea" :rows="4" placeholder="请输入简介" />
          </el-form-item>

          <el-row :gutter="24">
            <el-col :span="8">
              <el-form-item label="字数">
                <el-input v-model="form.word_count" placeholder="如: 9.9万" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="价格">
                <el-input-number v-model="form.price" :min="0" :precision="2" style="width:100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="评分">
                <el-input-number v-model="form.score" :min="0" :max="100" :precision="1" style="width:100%" />
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="24">
            <el-col :span="8">
              <el-form-item label="评级">
                <el-select v-model="form.grade" placeholder="请选择" style="width:100%">
                  <el-option label="S" value="S" />
                  <el-option label="A+" value="A+" />
                  <el-option label="A" value="A" />
                  <el-option label="B+" value="B+" />
                  <el-option label="B" value="B" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="状态">
                <el-select v-model="form.status" style="width:100%">
                  <el-option label="上架" :value="1" />
                  <el-option label="下架" :value="0" />
                  <el-option label="草稿" :value="2" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="属性">
                <el-checkbox v-model="form.is_free" :true-value="1" :false-value="0">免费</el-checkbox>
                <el-checkbox v-model="form.is_recommend" :true-value="1" :false-value="0">推荐</el-checkbox>
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item>
            <el-button type="primary" :loading="submitLoading" @click="handleSubmit">{{ isEdit ? '保存修改' : '立即创建' }}</el-button>
            <el-button @click="$router.push('/drama')">取消</el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
  `,
  setup() {
    const { ref, reactive, computed, onMounted } = Vue
    const route = VueRouter.useRoute()
    const router = VueRouter.useRouter()

    const formRef = ref(null)
    const submitLoading = ref(false)
    const isEdit = computed(() => !!route.params.id)

    const form = reactive({
      title: '', author: '', cover: '', description: '',
      word_count: '',
      price: 0, score: 0, grade: '', status: 2, is_free: 0, is_recommend: 0,
    })
    const rules = { title: [{ required: true, message: '请输入标题', trigger: 'blur' }] }

    async function loadDetail() {
      if (!isEdit.value) return
      try {
        const res = await API.dramaDetail(route.params.id)
        Object.assign(form, res.data)
      } catch { ElementPlus.ElMessage.error('加载详情失败'); router.push('/drama') }
    }

    async function handleSubmit() {
      try { await formRef.value.validate() } catch { return }
      submitLoading.value = true
      try {
        if (isEdit.value) { await API.dramaUpdate(route.params.id, form); ElementPlus.ElMessage.success('修改成功') }
        else { await API.dramaCreate(form); ElementPlus.ElMessage.success('创建成功') }
        router.push('/drama')
      } catch {} finally { submitLoading.value = false }
    }

    onMounted(() => { loadDetail() })

    return { formRef, form, rules, isEdit, submitLoading, handleSubmit }
  }
}
