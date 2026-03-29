<template>
  <div class="write-init">
    <!-- 页面标题 -->
    <div class="write-init__header">
      <h1 class="write-init__heading">
        <Icon name="lucide:pen-line" class="write-init__heading-icon" size="20" />
        创建新剧本
      </h1>
      <p class="write-init__subtitle">设置参数，输入你的创意，AI帮你生成完整剧本</p>
    </div>

    <!-- 三栏布局 -->
    <div class="write-init__layout">
      <!-- 左侧：参数调节面板 -->
      <div class="write-init__left">
        <WriteParamsPanel
          ref="paramsPanelRef"
          v-model="scriptParams"
        />
      </div>

      <!-- 中间：创意输入区 -->
      <div class="write-init__center">
        <div class="write-init__input-card">
          <h3 class="write-init__input-title"><Icon name="lucide:lightbulb" size="16" style="vertical-align: middle; margin-right: 4px;" /> 你的创意想法</h3>
          <p class="write-init__input-hint">描述你想要的剧本故事，越详细越好。比如：主角背景、核心冲突、想要的结局走向...</p>
          <textarea
            v-model="userIdea"
            class="write-init__textarea"
            placeholder="例如：一个被豪门抛弃的女孩，凭借自己的努力成为商业女王，最终回到豪门复仇的故事。女主性格坚韧，男主是她的竞争对手但暗中帮助她..."
            rows="12"
          ></textarea>

          <!-- 快捷灵感标签 -->
          <div class="write-init__inspirations">
            <span class="write-init__inspirations-label">快捷灵感：</span>
            <button
              v-for="tag in inspirationTags"
              :key="tag"
              class="write-init__inspiration-tag"
              @click="appendInspiration(tag)"
            >{{ tag }}</button>
          </div>
          <!-- 创建按钮 -->
          <div class="write-init__actions">
            <button class="write-init__btn-create" :disabled="!userIdea.trim() || creating" @click="handleCreate">
              <Icon :name="creating ? 'lucide:loader-2' : 'lucide:rocket'" class="write-init__btn-icon" size="18" />
              {{ creating ? '创建中...' : '开始创作' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 右侧：剧本细节展示盘 -->
      <div class="write-init__right">
        <WriteScriptPreview :params="scriptParams" :advanced-params="advancedParamsForPreview" />
      </div>
    </div>

    <!-- 会员/积分引导弹窗 -->
    <CommonConfirmDialog
      :visible="guardDialog.visible"
      :icon="guardDialog.icon"
      :title="guardDialog.title"
      :description="guardDialog.description"
      :confirm-text="guardDialog.confirmText"
      cancel-text="稍后再说"
      confirm-type="primary"
      @update:visible="guardDialog.visible = $event"
      @confirm="handleGuardConfirm"
      @cancel="guardDialog.visible = false"
    />
  </div>
</template>

<script setup>
/**
 * 写剧本 - 初始化页面
 * 三栏布局：左侧参数面板（可收缩）+ 中间创意输入 + 右侧细节展示
 */

definePageMeta({
  middleware: 'auth'
})

useSeo()

const userStore = useUserStore()
const { get, post } = useApi()
const { showToast } = useToast()
const { checkModelConfig } = useModelGuard()
const {
  resolveMembershipInfo,
  buildCreationLimitDialog,
} = useMembershipRights()

/* 创建中状态 */
const creating = ref(false)

/* 参数面板引用 */
const paramsPanelRef = ref(null)

/* 剧本参数 */
const scriptParams = ref({
  episodes: 60,
  duration: 2,
  gender: '男频',
  aspectRatio: '9:16',
  artStyle: '日系动漫',
  maxRoles: 10,
  maxScenes: 3,
  maxWords: 1200,
  dialogueRatio: 50,
  genres: [],
})

/* 高级参数直接从 scriptParams 读取，供预览面板使用 */
const advancedParamsForPreview = computed(() => ({
  maxRoles: scriptParams.value.maxRoles,
  maxScenes: scriptParams.value.maxScenes,
  maxWords: scriptParams.value.maxWords,
  dialogueRatio: scriptParams.value.dialogueRatio,
}))

/* 用户创意输入 */
const userIdea = ref('')

/* 快捷灵感标签 */
const inspirationTags = [
  '豪门复仇', '穿越重生', '甜宠日常', '悬疑推理',
  '职场逆袭', '古装宫斗', '都市爱情', '仙侠奇缘',
]

/* 追加灵感到输入框 */
const appendInspiration = (tag) => {
  if (userIdea.value) {
    userIdea.value += `，${tag}`
  } else {
    userIdea.value = tag
  }
}

/* 会员引导弹窗状态 */
const guardDialog = reactive({
  visible: false,
  icon: 'lucide:crown',
  title: '',
  description: '',
  confirmText: '',
  type: '',
})

/** 弹出会员引导弹窗 */
const showGuardDialog = (dialogOptions) => {
  guardDialog.icon = 'lucide:crown'
  guardDialog.title = dialogOptions?.title || '需要会员权限'
  guardDialog.description = dialogOptions?.description || ''
  guardDialog.confirmText = dialogOptions?.confirmText || '去升级会员'
  guardDialog.type = 'vip'
  guardDialog.visible = true
}

/** 弹窗确认 → 跳转充值页 */
const handleGuardConfirm = () => {
  const shouldNavigate = guardDialog.type === 'vip'
    && (guardDialog.confirmText === '去升级会员' || guardDialog.confirmText === '去购买会员')
  guardDialog.visible = false
  if (shouldNavigate) {
    navigateTo('/recharge')
  }
}

/**
 * 检查用户创作配额（network模式专用）
 * 合计 script + novel-project 是否已达上限
 */
const checkCreationQuota = async () => {
  if (userStore.isLocalMode) return true

  try {
    const membership = resolveMembershipInfo(userStore.userInfo)
    const [scriptRes, novelRes] = await Promise.all([
      get('/api/script?page=1&pageSize=1'),
      get('/api/novel-project?page=1&pageSize=1'),
    ])
    const total = (scriptRes?.data?.count ?? 0) + (novelRes?.data?.count ?? 0)
    if (membership.createLimit > 0 && total >= membership.createLimit) {
      showGuardDialog(buildCreationLimitDialog(membership, total + 1))
      return false
    }
  } catch {
    /* 查询失败不阻塞创建，让后端做最终兜底 */
  }
  return true
}

/* 创建剧本 → 未登录弹登录弹窗，已登录检查配额后调后端创建并跳转 */
const handleCreate = async () => {
  if (!userStore.isLoggedIn) {
    userStore.openLoginModal()
    return
  }

  /* 创建前先确认已绑定文字模型，未配置则弹出现有守卫弹窗 */
  if (!(await checkModelConfig('script_gen'))) return

  const quotaOk = await checkCreationQuota()
  if (!quotaOk) return

  if (creating.value) return
  creating.value = true

  try {
    const p = scriptParams.value
    const res = await post('/api/script', {
      title: '',
      totalEpisodes: p.episodes,
      duration: p.duration,
      gender: p.gender,
      aspectRatio: p.aspectRatio,
      artStyle: p.artStyle,
      maxRoles: p.maxRoles,
      maxScenes: p.maxScenes,
      maxWords: p.maxWords,
      dialogueRatio: p.dialogueRatio,
      genreIds: paramsPanelRef.value?.getSelectedGenreIds() || [],
      customGenres: paramsPanelRef.value?.getCustomGenresStr() || '',
      userIdea: userIdea.value.trim(),
    })

    if (res.code === 200 && res.data?.id) {
      localStorage.setItem('script_init_message', userIdea.value.trim())
      navigateTo(`/write/${res.data.id}`)
    } else {
      showToast(res.message || '创建失败', 'error')
    }
  } catch (err) {
    showToast(err.message || '创建失败，请稍后重试', 'error')
  } finally {
    creating.value = false
  }
}
</script>

<style scoped>
/* ========================================
 * 写剧本 - 初始化页面
 * ======================================== */
.write-init {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 72px - 40px);
  overflow: hidden;
}

.write-init__header {
  margin-bottom: 20px;
  flex-shrink: 0;
}

.write-init__heading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 22px;
  font-weight: 800;
  color: var(--color-text);
  margin-bottom: 6px;
}

.write-init__heading-icon {
  font-size: 24px;
}

.write-init__subtitle {
  font-size: 13px;
  color: var(--color-text-secondary);
}

/* 三栏布局 */
.write-init__layout {
  display: flex;
  gap: 20px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* 左侧参数面板 */
.write-init__left {
  width: 300px;
  flex-shrink: 0;
  overflow-y: auto;
  overflow-x: hidden;
  transition: width 0.3s ease;
}

.write-init__left--collapsed {
  width: 48px;
}

/* 中间输入区 */
.write-init__center {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
}

.write-init__input-card {
  background: var(--color-bg-white);
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  padding: 28px;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.write-init__input-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 8px;
}

.write-init__input-hint {
  font-size: 12px;
  color: var(--color-text-light);
  margin-bottom: 16px;
  line-height: 1.6;
}

/* 大输入框 */
.write-init__textarea {
  width: 100%;
  min-height: 240px;
  flex:1;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  line-height: 1.8;
  color: var(--color-text);
  background: var(--color-bg);
  resize: vertical;
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
}

.write-init__textarea:focus {
  border-color: var(--color-primary);
  background: var(--color-bg-white);
  box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.08);
}

.write-init__textarea::placeholder {
  color: var(--color-text-light);
  font-size: 13px;
}
/* 快捷灵感标签 */
.write-init__inspirations {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.write-init__inspirations-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.write-init__inspiration-tag {
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  background: var(--color-bg);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  transition: all 0.2s;
}

.write-init__inspiration-tag:hover {
  background: var(--color-primary-bg);
  color: var(--color-primary);
  border-color: rgba(255, 107, 53, 0.3);
}

/* 创建按钮 */
.write-init__actions {
  margin-top: 24px;
  display: flex;
  justify-content: center;
}

.write-init__btn-create {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 48px;
  background: linear-gradient(90deg, #9E36FF 0%, #FF4472 55%, #FFAA4C 100%);
  color: #fff;
  border-radius: 28px;
  font-size: 16px;
  font-weight: 700;
  box-shadow: 0 4px 16px rgba(158, 54, 255, 0.3);
  transition: all 0.25s;
}

.write-init__btn-create:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(158, 54, 255, 0.4);
}

.write-init__btn-create:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.write-init__btn-icon {
  font-size: 18px;
}

/* 右侧展示盘 */
.write-init__right {
  width: 320px;
  flex-shrink: 0;
  overflow-y: auto;
}

/* 响应式 */
@media (max-width: 1200px) {
  .write-init__right {
    width: 260px;
  }
  .write-init__left {
    width: 240px;
  }
}

@media (max-width: 900px) {
  .write-init__layout {
    flex-direction: column;
  }
  .write-init__left,
  .write-init__right {
    width: 100%;
    position: static;
  }
  .write-init__left--collapsed {
    width: 100%;
  }
}
</style>
