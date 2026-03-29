/**
 * 系统配置页面组件
 * 表格形式管理系统级键值对配置（功能开关、赠送额度等）
 * 后续新增配置项只需在 CONFIG_ITEMS 数组中追加一条即可
 */
const SystemConfigPage = {
  template: `
    <div>
      <div class="page-header">
        <h2 class="page-title">系统配置</h2>
      </div>

      <div class="table-card">
        <el-table :data="tableData" v-loading="loading" style="width:100%">
          <el-table-column prop="func_desc" label="配置名称" min-width="200" />
          <el-table-column prop="func_key" label="配置键" min-width="160">
            <template #default="{ row }">
              <span style="font-size:12px;color:#999;font-family:monospace">{{ row.func_key }}</span>
            </template>
          </el-table-column>
          <el-table-column label="配置值" min-width="220">
            <template #default="{ row }">
              <el-input-number
                v-if="row.type === 'number'"
                v-model="row.func_value_edit"
                :min="row.min != null ? row.min : 0"
                :max="row.max != null ? row.max : 99999"
                :step="row.step != null ? row.step : 1"
                controls-position="right"
                style="width:180px"
              />
              <el-input
                v-else-if="row.type !== 'image'"
                v-model="row.func_value_edit"
                style="width:180px"
                placeholder="请输入配置值"
              />
              <div v-else style="display:flex;flex-direction:column;gap:10px;width:280px;">
                <div v-if="row.func_value_edit" style="width:120px;height:120px;border:1px solid #ebeef5;border-radius:8px;overflow:hidden;background:#fff;">
                  <img :src="row.func_value_edit" alt="二维码预览" style="width:100%;height:100%;object-fit:contain;display:block;" />
                </div>
                <div v-else style="width:120px;height:120px;border:1px dashed #dcdfe6;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#909399;background:#fafafa;">
                  暂无图片
                </div>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                  <el-upload
                    :show-file-list="false"
                    accept=".jpg,.jpeg,.png"
                    :before-upload="file => handleImageUpload(file, row)"
                  >
                    <el-button type="primary" plain :loading="row.uploading">上传图片</el-button>
                  </el-upload>
                  <el-button v-if="row.func_value_edit" link type="danger" @click="clearImage(row)">清空</el-button>
                </div>
                <div style="font-size:12px;color:#909399;line-height:1.5;">
                  支持 jpg/png，大小不超过 2MB。上传后会自动写入配置值。
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" link :loading="row.saving" @click="handleSave(row)">
                保存
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
  `,
  setup() {
    const { ref, onMounted } = Vue

    const loading = ref(false)

    /**
     * 配置项定义（写死的键值对，后续扩展在这里追加即可）
     * type: 'number' 用数字输入框，'string' 用文本输入框
     */
    const CONFIG_ITEMS = [
      { func_key: 'manual_link', func_desc: '前端左下角手册跳转链接', type: 'string', defaultValue: 'https://docs.qq.com/' },
      { func_key: 'customer_service_qr', func_desc: '前端左下角客服群二维码', type: 'image', defaultValue: '' },
    ]

    /* 表格数据 */
    const tableData = ref([])

    /* 初始化表格（先用默认值填充） */
    function initTable() {
      tableData.value = CONFIG_ITEMS.map(item => ({
        ...item,
        func_value_edit: item.defaultValue,
        original_value: item.defaultValue,
        cleanup_paths: [],
        saving: false,
        uploading: false,
      }))
    }

    /* 加载配置（从数据库读取，覆盖默认值） */
    async function loadConfig() {
      loading.value = true
      initTable()
      try {
        const res = await API.systemConfigList()
        const list = res.data || []
        for (const row of tableData.value) {
          const found = list.find(c => c.func_key === row.func_key)
          if (found) {
            row.func_value_edit = row.type === 'number' ? (Number(found.func_value) || row.defaultValue) : found.func_value
            row.original_value = row.func_value_edit
            row.cleanup_paths = []
          }
        }
      } catch (err) { /* 加载失败用默认值 */ }
      loading.value = false
    }

    /* 逐行保存（有则更新，无则新增） */
    async function handleSave(row) {
      row.saving = true
      try {
        await API.systemConfigSave({
          func_key: row.func_key,
          func_value: String(row.func_value_edit != null ? row.func_value_edit : row.defaultValue),
          func_desc: row.func_desc,
          cleanup_paths: row.cleanup_paths,
        })
        row.original_value = row.func_value_edit
        row.cleanup_paths = []
        ElementPlus.ElMessage.success(row.func_desc + ' 保存成功')
      } catch (err) {
        ElementPlus.ElMessage.error('保存失败')
      }
      row.saving = false
    }

    /* 上传二维码图片，成功后把图片地址写回当前配置项 */
    async function handleImageUpload(file, row) {
      const isImage = ['image/jpeg', 'image/png'].includes(file.type)
      if (!isImage) {
        ElementPlus.ElMessage.warning('只支持 jpg、png 格式的图片')
        return false
      }

      const isLt2M = file.size / 1024 / 1024 <= 2
      if (!isLt2M) {
        ElementPlus.ElMessage.warning('图片大小不能超过 2MB')
        return false
      }

      row.uploading = true

      try {
        /* 新图覆盖未保存的临时图时，先登记待清理路径，保存时统一删除 */
        markCleanupPath(row, row.func_value_edit)

        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch('/api/upload/image', {
          method: 'POST',
          body: formData,
        })
        const data = await res.json()

        if (data.code !== 200 || !data.data?.url) {
          throw new Error(data.message || '上传失败')
        }

        row.func_value_edit = data.data.url
        ElementPlus.ElMessage.success('图片上传成功，请点击保存生效')
      } catch (err) {
        ElementPlus.ElMessage.error(err.message || '图片上传失败')
      }

      row.uploading = false
      return false
    }

    /* 清空图片配置，保存后正式生效 */
    function clearImage(row) {
      markCleanupPath(row, row.func_value_edit)
      row.func_value_edit = ''
      ElementPlus.ElMessage.success('已清空预览，请点击保存生效')
    }

    /* 记录待删除的本地上传图片，真正删除动作放到保存成功之后 */
    function markCleanupPath(row, targetPath) {
      if (!targetPath || typeof targetPath !== 'string') return
      if (!targetPath.startsWith('/public/uploads/')) return
      if (targetPath === row.original_value) return
      if (!row.cleanup_paths.includes(targetPath)) {
        row.cleanup_paths.push(targetPath)
      }
    }

    onMounted(() => loadConfig())

    return { loading, tableData, handleSave, handleImageUpload, clearImage }
  }
}
