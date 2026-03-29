/**
 * VIP 会员配置管理页
 * 包含：会员等级管理、价格矩阵编辑、顶部 Tab 角标
 */
const VipConfigPage = {
  template: `
    <div>
      <div class="page-header">
        <h2 class="page-title">会员配置</h2>
      </div>

      <el-tabs v-model="activeTab" type="border-card">
        <!-- ==================== 会员等级 ==================== -->
        <el-tab-pane label="会员等级" name="tiers">
          <el-table :data="tiers" v-loading="tiersLoading" stripe>
            <el-table-column prop="tier_code" label="编码" width="120" />
            <el-table-column label="名称" width="180">
              <template #default="{ row }">
                <span>{{ getTierDisplayName(row) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="剧本创建上限" width="140" align="center">
              <template #default="{ row }">{{ formatLimitValue(row.script_create_limit, '个') }}</template>
            </el-table-column>
            <el-table-column label="导入字数上限" width="150" align="center">
              <template #default="{ row }">{{ formatLimitValue(row.novel_word_limit, '字') }}</template>
            </el-table-column>
            <el-table-column prop="badge" label="徽章" width="180" />
            <el-table-column prop="desc_text" label="描述" min-width="150" show-overflow-tooltip />
            <el-table-column prop="sort_order" label="排序" width="80" align="center" />
            <el-table-column label="操作" width="140" align="center" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="handleTierEdit(row)">编辑</el-button>
                <el-button type="danger" link size="small" @click="handleTierDelete(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- ==================== 价格矩阵 ==================== -->
        <el-tab-pane label="价格矩阵" name="prices">
          <div style="margin-bottom:12px;color:#666;font-size:13px;">
            💡 这里只展示当前对外售卖的基础会员 / 高级会员，修改现价后「折合月价」自动计算，点击对应行的「保存」即生效。
          </div>
          <el-table :data="priceMatrix" v-loading="pricesLoading" :row-class-name="priceRowClass" border>
            <el-table-column label="会员等级" width="120" fixed>
              <template #default="{ row }">{{ getTierDisplayName(row.tier) }}</template>
            </el-table-column>
            <el-table-column label="付费周期" width="100">
              <template #default="{ row }">{{ row.plan && row.plan.name || '-' }}</template>
            </el-table-column>
            <el-table-column label="现价 (元)" width="140">
              <template #default="{ row }">
                <el-input-number v-model="row.current_price" :precision="2" :step="1" :min="0" size="small" controls-position="right" style="width:120px;" />
              </template>
            </el-table-column>
            <el-table-column label="原价 (元)" width="140">
              <template #default="{ row }">
                <el-input-number v-model="row.original_price" :precision="2" :step="1" :min="0" size="small" controls-position="right" style="width:120px;" />
              </template>
            </el-table-column>
            <el-table-column label="折合月价 (元)" width="140" align="center">
              <template #default="{ row }">
                <span style="font-weight:600;color:#409EFF;">{{ getMonthPrice(row) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" align="center" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" size="small" @click="handlePriceSave(row)">保存</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- ==================== 顶部Tab标签 ==================== -->
        <el-tab-pane label="顶部Tab标签" name="tab-badges">
          <div style="margin-bottom:12px;color:#666;font-size:13px;">
            💡 这里配置充值页顶部各 VIP 套餐 Tab 右上角的小红标签，留空则前端不展示。
          </div>
          <el-table :data="tabBadges" v-loading="tabBadgesLoading" stripe>
            <el-table-column prop="name" label="Tab名称" width="140" />
            <el-table-column prop="plan_code" label="编码" width="140">
              <template #default="{ row }">
                <span style="font-size:12px;color:#999;font-family:monospace">{{ row.plan_code }}</span>
              </template>
            </el-table-column>
            <el-table-column label="角标文案" min-width="240">
              <template #default="{ row }">
                <el-input
                  v-model="row.badge_edit"
                  maxlength="20"
                  show-word-limit
                  clearable
                  placeholder="例如：省15% / 首两月费用"
                />
              </template>
            </el-table-column>
            <el-table-column label="当前展示" min-width="180">
              <template #default="{ row }">
                <span v-if="row.badge_edit" style="display:inline-block;padding:2px 8px;border-radius:999px;background:#ff6b3d;color:#fff;font-size:12px;line-height:20px;">{{ row.badge_edit }}</span>
                <span v-else style="color:#999;">不展示</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" align="center" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link :loading="row.saving" @click="handleTabBadgeSave(row)">保存</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>

      <!-- ========== 会员等级弹窗 ========== -->
      <el-dialog v-model="tierDialogVisible" :title="tierForm.id ? '编辑等级' : '新增等级'" width="580px" destroy-on-close>
        <el-form :model="tierForm" label-width="100px">
          <el-form-item label="等级编码" required>
            <el-input v-model="tierForm.tier_code" placeholder="如 gold / blackgold" :disabled="true" />
            <div style="font-size:12px;color:#909399;line-height:1.4;margin-top:4px;">gold 对应基础会员，blackgold 对应高级会员。</div>
          </el-form-item>
          <el-form-item label="名称" required>
            <el-input v-model="tierForm.name" placeholder="如 基础会员 / 高级会员" />
          </el-form-item>
          <el-form-item label="徽章">
            <el-input v-model="tierForm.badge" placeholder="如 🔥 新春88折特惠" />
          </el-form-item>
          <el-form-item label="描述">
            <el-input v-model="tierForm.desc_text" placeholder="如 超高性价比" />
          </el-form-item>
          <el-form-item label="剧本创建上限">
            <el-input-number v-model="tierForm.script_create_limit" :min="0" :max="999999" />
            <div style="font-size:12px;color:#909399;line-height:1.4;margin-top:4px;">填 0 表示不限，建议基础会员 30 / 高级会员 100</div>
          </el-form-item>
          <el-form-item label="导入字数上限">
            <el-input-number v-model="tierForm.novel_word_limit" :min="0" :max="99999999" />
            <div style="font-size:12px;color:#909399;line-height:1.4;margin-top:4px;">填 0 表示不限，单位为字，建议基础会员 1000000 / 高级会员 2000000。</div>
          </el-form-item>
          <el-form-item label="自动权益预览">
            <div style="width:100%;padding:12px 14px;border:1px solid #ebeef5;border-radius:8px;background:#fafafa;">
              <div style="font-size:12px;color:#909399;line-height:1.6;margin-bottom:8px;">根据上方剧本数量和小说转剧本限制自动生成，前端会员卡会直接展示，无需手动写入权益HTML。</div>
              <ul style="margin:0;padding-left:18px;color:#606266;line-height:1.7;" v-html="getAutoFeaturesPreview()"></ul>
            </div>
          </el-form-item>
          <el-form-item label="权益HTML">
            <el-input v-model="tierForm.features_html" type="textarea" :rows="5" placeholder="权益列表HTML（li标签）" />
          </el-form-item>
          <el-form-item label="排序">
            <el-input-number v-model="tierForm.sort_order" :min="0" :max="999" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="tierDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="tierSubmitting" @click="handleTierSubmit">确定</el-button>
        </template>
      </el-dialog>
    </div>
  `,
  setup() {
    const { ref, reactive, onMounted } = Vue
    const activeTab = ref('tiers')

    /* ==================== 会员等级 ==================== */
    const tiers = ref([])
    const tiersLoading = ref(false)
    const tierDialogVisible = ref(false)
    const tierSubmitting = ref(false)
    const tierForm = reactive({
      id: '', tier_code: '', name: '', badge: '', desc_text: '',
      script_create_limit: 0, novel_word_limit: 0, features_html: '', sort_order: 0
    })

    async function fetchTiers() {
      tiersLoading.value = true
      try {
        const res = await API.vipTiers()
        tiers.value = res.data || []
      } catch {} finally { tiersLoading.value = false }
    }

    function handleTierEdit(row) {
      Object.assign(tierForm, {
        ...row,
        name: getTierDisplayName(row),
        script_create_limit: Number(row.script_create_limit || 0),
        novel_word_limit: Number(row.novel_word_limit || 0),
      })
      tierDialogVisible.value = true
    }

    async function handleTierSubmit() {
      if (!tierForm.tier_code || !tierForm.name) {
        return ElementPlus.ElMessage.warning('编码和名称不能为空')
      }
      tierSubmitting.value = true
      try {
        const payload = {
          ...tierForm,
          name: normalizeTierName(tierForm.tier_code, tierForm.name),
        }
        await API.vipTierUpdate(tierForm.id, payload)
        tierDialogVisible.value = false
        ElementPlus.ElMessage.success('保存成功')
        fetchTiers()
      } catch {} finally { tierSubmitting.value = false }
    }

    async function handleTierDelete(row) {
      try {
        await ElementPlus.ElMessageBox.confirm(
          '<div style="text-align:left; padding: 0 0 10px;">'
          + '<div style="font-size:18px;color:#303133;margin-bottom:15px;">确定删除等级 「' + row.name + '」 吗？</div>'
          + '<div style="font-size:13px;color:#F56C6C;">删除后不可恢复，关联的<strong>价格数据也将一起被删除！</strong> 请谨慎操作。</div>'
          + '</div>',
          '',
          {
            confirmButtonText: '确认删除',
            cancelButtonText: '暂不删除',
            dangerouslyUseHTMLString: true,
            customStyle: { paddingBottom: '20px' }
          }
        )
        await API.vipTierDelete(row.id)
        ElementPlus.ElMessage.success('删除成功')
        fetchTiers()
      } catch {}
    }

    /* ==================== 价格矩阵 ==================== */
    const priceMatrix = ref([])
    const pricesLoading = ref(false)

    async function fetchPrices() {
      pricesLoading.value = true
      try {
        const res = await API.vipPrices()
        priceMatrix.value = (res.data || [])
          .filter(p => isPublicPurchaseTier(p.tier && p.tier.tier_code))
          .map(p => ({
            ...p,
            current_price: parseFloat(p.current_price) || 0,
            original_price: parseFloat(p.original_price) || 0,
            month_price: parseFloat(p.month_price) || 0,
          }))
      } catch {} finally { pricesLoading.value = false }
    }

    async function handlePriceSave(row) {
      try {
        /* 保存时用实时计算的月价 */
        const monthPrice = parseFloat(getMonthPrice(row))
        await API.vipPriceSet({
          vip_tier_id: row.vip_tier_id,
          vip_plan_id: row.vip_plan_id,
          current_price: row.current_price,
          original_price: row.original_price,
          month_price: monthPrice,
        })
        ElementPlus.ElMessage.success('价格已更新')
        fetchPrices()
      } catch {}
    }

    /* 价格矩阵行背景色 */
    function priceRowClass({ row }) {
      const code = row.tier && row.tier.tier_code || ''
      if (code === 'gold') return 'price-row-basic'
      if (code === 'blackgold') return 'price-row-advanced'
      return ''
    }

    /* 实时计算折合月价（模板中直接调用，每次渲染自动重新计算） */
    function getMonthPrice(row) {
      const planCode = row.plan && row.plan.plan_code || ''
      const price = parseFloat(row.current_price) || 0
      if (planCode === 'quarter') return (Math.round(price / 3 * 100) / 100).toFixed(2)
      if (planCode === 'year') return (Math.round(price / 12 * 100) / 100).toFixed(2)
      return price.toFixed(2)
    }

    /* ==================== 顶部Tab标签 ==================== */
    const tabBadges = ref([])
    const tabBadgesLoading = ref(false)

    async function fetchTabBadges() {
      tabBadgesLoading.value = true
      try {
        const planRes = await API.vipPlans()
        const plans = planRes.data || []

        tabBadges.value = plans.map(plan => ({
          id: plan.id,
          name: plan.name,
          plan_code: plan.plan_code,
          badge_edit: plan.badge || '',
          source: 'plan',
          saving: false,
        }))
      } catch {
        tabBadges.value = []
      } finally {
        tabBadgesLoading.value = false
      }
    }

    async function handleTabBadgeSave(row) {
      row.saving = true
      try {
        await API.vipPlanUpdate(row.id, { badge: row.badge_edit || '' })
        ElementPlus.ElMessage.success(`${row.name} 标签已保存`)
        fetchTabBadges()
      } catch {
        ElementPlus.ElMessage.error('保存失败')
      } finally {
        row.saving = false
      }
    }

    function formatLimitValue(value, unit) {
      const num = Number(value || 0)
      if (!num) return '不限'
      return `${num.toLocaleString()}${unit}`
    }

    function formatWordLimitPreview(value) {
      const num = Number(value || 0)
      if (!num) return '不限字'
      if (num % 10000 === 0) return `${num / 10000}万字`
      return `${num.toLocaleString()}字`
    }

    function isPublicPurchaseTier(tierCode) {
      return ['gold', 'blackgold'].includes(String(tierCode || ''))
    }

    function getTierDisplayName(row = {}) {
      const code = String(row.tier_code || '')
      if (code === 'gold') return '基础会员'
      if (code === 'blackgold') return '高级会员'
      return row.name || '-'
    }

    function normalizeTierName(tierCode, inputName) {
      const code = String(tierCode || '')
      const name = String(inputName || '').trim()
      if (code === 'gold' && (!name || name === '黄金会员')) return '基础会员'
      if (code === 'blackgold' && (!name || name === '黑金会员')) return '高级会员'
      return name
    }

    function getAutoFeaturesPreview() {
      const createText = formatLimitValue(tierForm.script_create_limit, '个')
      const wordText = formatWordLimitPreview(tierForm.novel_word_limit)
      return `
        <li>最多创建 <strong style="color:#67c23a;">${createText}</strong> 个剧本</li>
        <li>小说转剧本最多保存 <strong style="color:#67c23a;">${wordText}</strong></li>
      `
    }

    onMounted(() => {
      /* 注入价格矩阵行底色样式 */
      if (!document.getElementById('vip-price-row-styles')) {
        const style = document.createElement('style')
        style.id = 'vip-price-row-styles'
        style.textContent = `
          .price-row-basic > td { background-color: #fff8e6 !important; }
          .price-row-basic > td:first-child { border-left: 3px solid #e6a23c !important; }
          .price-row-advanced > td { background-color: #f3f4f6 !important; }
          .price-row-advanced > td:first-child { border-left: 3px solid #212121 !important; }
        `
        document.head.appendChild(style)
      }
      fetchTiers()
      fetchPrices()
      fetchTabBadges()
    })

    return {
      activeTab,
      tiers, tiersLoading, tierDialogVisible, tierSubmitting, tierForm,
      handleTierEdit, handleTierSubmit, handleTierDelete, fetchTiers,
      priceMatrix, pricesLoading, handlePriceSave, priceRowClass, getMonthPrice,
      tabBadges, tabBadgesLoading, handleTabBadgeSave,
      formatLimitValue, getAutoFeaturesPreview, getTierDisplayName,
    }
  }
}
