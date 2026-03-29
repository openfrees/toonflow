<template>
  <div class="novel-init">
    <!-- 页面标题 -->
    <div class="novel-init__header">
      <h1 class="novel-init__heading">
        <Icon name="lucide:book-text" class="novel-init__heading-icon" size="20" />
        小说转剧本
      </h1>
      <p class="novel-init__subtitle">上传或粘贴小说原文，知剧帮你智能拆分章节并转换为专业剧本</p>
    </div>

    <!-- 三栏布局 -->
    <div class="novel-init__layout">
      <!-- 左侧：参数调节面板（复用WriteParamsPanel，隐藏角色上限） -->
      <div class="novel-init__left">
        <NovelParamsPanel
          ref="paramsPanelRef"
          v-model="scriptParams"
        />
      </div>

      <!-- 中间：上传/粘贴区域 或 章节列表 -->
      <div class="novel-init__center">
        <!-- ============ 状态A：上传/粘贴区域（初始状态） ============ -->
        <div v-if="viewState === 'upload'" class="novel-init__upload-card">
          <h3 class="novel-init__upload-title">
            <Icon name="lucide:upload-cloud" size="16" style="vertical-align: middle; margin-right: 4px;" />
            上传小说原文
          </h3>

          <!-- 分步导航 -->
          <div class="novel-init__steps">
            <span class="novel-init__step novel-init__step--active">第一步</span>
            <span class="novel-init__step">第二步</span>
          </div>

          <!-- 上半部分：拖拽上传 -->
          <div
            class="novel-init__drop-zone"
            :class="{ 'novel-init__drop-zone--hover': isDragging }"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="handleFileDrop"
            @click="triggerFileInput"
          >
            <input
              ref="fileInputRef"
              type="file"
              accept=".txt"
              class="novel-init__file-input"
              @change="handleFileSelect"
            />
            <div class="novel-init__drop-icon">
              <Icon name="lucide:cloud-upload" size="40" />
            </div>
            <p class="novel-init__drop-text">拖拽小说原文文件到此处或点击上传</p>
            <p class="novel-init__drop-hint">支持 .txt 格式，文件大小不超过 20MB</p>
            <p v-if="uploadedFileName" class="novel-init__drop-file">
              <Icon name="lucide:file-check" size="14" />
              {{ uploadedFileName }}
            </p>
          </div>

          <!-- 分隔符 -->
          <div class="novel-init__divider">
            <span class="novel-init__divider-text">或</span>
          </div>

          <!-- 下半部分：粘贴原文 -->
          <div class="novel-init__paste-section">
            <label class="novel-init__paste-label">直接粘贴小说原文内容</label>
            <textarea
              v-model="pasteContent"
              class="novel-init__paste-textarea"
              placeholder="请输入小说原文内容"
              rows="10"
            ></textarea>
          </div>

          <!-- 开始分析按钮 -->
          <div class="novel-init__actions" v-if="uploadedFileName || pasteContent.trim()">
            <button class="novel-init__btn-analyze" @click="startAnalyze">
              <Icon name="lucide:scan-search" size="18" />
              开始分析章节
            </button>
          </div>
        </div>

        <!-- ============ 状态B：分析中（Loading） ============ -->
        <div v-else-if="viewState === 'analyzing'" class="novel-init__analyzing-card">
          <div class="novel-init__analyzing-spinner">
            <div class="novel-init__spinner"></div>
          </div>
          <h3 class="novel-init__analyzing-title">正在分析章节结构...</h3>
          <p class="novel-init__analyzing-hint">知剧正在智能识别小说的章节、卷、标题等信息，请稍候</p>
          <div class="novel-init__analyzing-progress">
            <div class="novel-init__progress-bar">
              <div class="novel-init__progress-fill" :style="{ width: analyzeProgress + '%' }"></div>
            </div>
            <span class="novel-init__progress-text">{{ Math.floor(analyzeProgress) }}%</span>
          </div>
        </div>

        <!-- ============ 状态C：章节列表 ============ -->
        <div v-else-if="viewState === 'chapters'" class="novel-init__chapters-card" style="position: relative;">
          <!-- 保存进度覆盖层 -->
          <div v-if="isSaving" class="novel-init__save-overlay">
            <div class="novel-init__save-overlay-content">
              <Icon name="lucide:loader-2" size="32" class="novel-init__save-spinner" />
              <h4 class="novel-init__save-title">{{ saveStatusText }}</h4>
              <div class="novel-init__save-progress">
                <div class="novel-init__progress-bar">
                  <div class="novel-init__progress-fill" :style="{ width: saveProgress + '%' }"></div>
                </div>
                <span class="novel-init__progress-text">{{ Math.round(saveProgress) }}%</span>
              </div>
            </div>
          </div>
          <h3 class="novel-init__upload-title">
            <Icon name="lucide:upload-cloud" size="16" style="vertical-align: middle; margin-right: 4px;" />
            上传小说原文
          </h3>

          <!-- 分步导航 -->
          <div class="novel-init__steps">
            <span class="novel-init__step">第一步</span>
            <span class="novel-init__step novel-init__step--active">第二步</span>
          </div>

          <!-- 章节表格 -->
          <div class="novel-init__table-wrap">
            <table class="novel-init__table">
              <thead>
                <tr>
                  <th class="novel-init__th novel-init__th--check">
                    <input
                      type="checkbox"
                      :checked="isAllSelected"
                      :indeterminate="isPartialSelected"
                      @change="toggleSelectAll"
                    />
                  </th>
                  <th class="novel-init__th novel-init__th--num">章</th>
                  <th class="novel-init__th novel-init__th--vol">卷</th>
                  <th class="novel-init__th novel-init__th--name">章节名称</th>
                  <th class="novel-init__th novel-init__th--content">章节内容</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(ch, idx) in chapters"
                  :key="idx"
                  class="novel-init__tr"
                  :class="{
                    'novel-init__tr--selected': ch.selected,
                    'novel-init__tr--hovered': hoveredIdx === idx && !ch.selected,
                  }"
                >
                  <td
                    class="novel-init__td novel-init__td--check"
                    @mouseenter="onChapterMouseEnter(idx)"
                    @mouseleave="onChapterMouseLeave"
                  >
                    <input type="checkbox" v-model="ch.selected" />

                    <!-- 悬浮快捷选择框（checkbox 右侧弹出） -->
                    <Transition name="batch-pop">
                      <div
                        v-if="hoveredIdx === idx && !ch.selected && (hoverActions.prev || hoverActions.next)"
                        class="novel-init__batch-popover"
                        @mouseenter="onPopoverEnter"
                        @mouseleave="onPopoverLeave"
                      >
                        <button
                          v-if="hoverActions.prev"
                          class="novel-init__batch-btn"
                          @click.stop="batchSelect(hoverActions.prev.from, hoverActions.prev.to)"
                        >
                          <Icon name="lucide:arrow-up" size="12" />
                          选中第{{ hoverActions.prev.from }}~{{ hoverActions.prev.to }}章
                        </button>
                        <button
                          v-if="hoverActions.next"
                          class="novel-init__batch-btn"
                          @click.stop="batchSelect(hoverActions.next.from, hoverActions.next.to)"
                        >
                          <Icon name="lucide:arrow-down" size="12" />
                          选中第{{ hoverActions.next.from }}~{{ hoverActions.next.to }}章
                        </button>
                      </div>
                    </Transition>
                  </td>
                  <td class="novel-init__td novel-init__td--num">{{ ch.chapterNum }}</td>
                  <td class="novel-init__td novel-init__td--vol">{{ ch.volume }}</td>
                  <td class="novel-init__td novel-init__td--name">{{ ch.title }}</td>
                  <td class="novel-init__td novel-init__td--content">
                    <span class="novel-init__content-preview">{{ ch.preview }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 底部：已勾选统计 + 操作按钮 -->
          <div class="novel-init__chapters-footer">
            <span class="novel-init__selected-info">
              已勾选 {{ selectedCount }} 章，共 {{ selectedWordCount.toLocaleString() }} 字
            </span>
            <div class="novel-init__chapters-btns">
              <button class="novel-init__btn-back" @click="goBackToUpload">上一步</button>
              <button
                class="novel-init__btn-save"
                :disabled="selectedCount === 0 || isSaving || !copyrightConfirmChecked"
                @click="handleSave"
              >{{ saveButtonText }}</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：剧本细节展示盘（去掉角色上限） -->
      <div class="novel-init__right">
        <NovelScriptPreview :params="scriptParams" />

        <!-- 版权声明 -->
        <div
          class="novel-init__copyright"
          :class="{ 'novel-init__copyright--attention': selectedCount > 0 && !copyrightConfirmChecked && viewState === 'chapters' }"
        >
          <div class="novel-init__copyright-header">
            <Icon name="lucide:shield-alert" size="16" class="novel-init__copyright-icon" />
            <span class="novel-init__copyright-title">版权声明</span>
          </div>
          <p class="novel-init__copyright-text">
            使用本功能前，请确保您已获得小说原文的<strong>合法授权</strong>或<strong>版权许可</strong>。未经版权方授权擅自转换他人作品可能构成侵权，由此产生的一切法律责任由用户自行承担。
          </p>
          <p class="novel-init__copyright-sub">
            知剧AI仅提供技术工具服务，不对用户上传内容的合法性负责。
          </p>
          <label v-if="viewState === 'chapters'" class="novel-init__copyright-check">
            <input
              v-model="copyrightConfirmChecked"
              type="checkbox"
              class="novel-init__copyright-checkbox"
            />
            <span class="novel-init__copyright-check-text">我已获得授权或内容为本人原创</span>
          </label>
          <p v-if="viewState === 'chapters' && !copyrightConfirmChecked" class="novel-init__copyright-tip">
            请先勾选确认，才可保存并进入下一步。
          </p>
        </div>
      </div>
    </div>

    <!-- 配额/会员引导弹窗 -->
    <CommonConfirmDialog
      :visible="limitDialog.visible"
      :icon="limitDialog.icon"
      :title="limitDialog.title"
      :description="limitDialog.description"
      :confirm-text="limitDialog.confirmText"
      :cancel-text="limitDialog.cancelText"
      :confirm-type="limitDialog.confirmType"
      @update:visible="limitDialog.visible = $event"
      @confirm="limitDialog.onConfirm?.()"
      @cancel="limitDialog.visible = false"
    />
  </div>
</template>

<script setup>
/**
 * 小说转剧本 - 初始化页面
 * 三栏布局：左侧参数面板（无角色上限）+ 中间上传/粘贴/章节列表 + 右侧细节展示（无角色上限）
 * localhost模式：可自由创作，但超大文本保存前会提示改走官网创建
 * network模式：免费用户最多5个作品（剧本+小说合计），超出需开通会员
 */

definePageMeta({
  middleware: 'auth'
})

useSeo()

const { get, post } = useApi()
const { showToast } = useToast()
const userStore = useUserStore()
const runtimeConfig = useRuntimeConfig()
const {
  resolveMembershipInfo,
  buildCreationLimitDialog,
  buildNovelWordLimitDialog,
} = useMembershipRights()

/* ============= 状态管理 ============= */

/** 视图状态: 'upload' | 'analyzing' | 'chapters' */
const viewState = ref('upload')
const COPYRIGHT_CONFIRM_VERSION = '2026-03-14-v1'
const COPYRIGHT_CONFIRM_TEXT = '我已获得授权或内容为本人原创'
const copyrightConfirmChecked = ref(false)

/* 参数面板引用 */
const paramsPanelRef = ref(null)

const scriptParams = ref({
  episodes: 60,
  duration: 2,
  gender: '男频',
  genre: '',
  artStyle: '日系动漫',
  aspectRatio: '9:16',
})

/* ============= 上传相关 ============= */
const fileInputRef = ref(null)
const isDragging = ref(false)
const uploadedFileName = ref('')
const uploadedFileContent = ref('')
const pasteContent = ref('')

/** 触发文件选择 */
const triggerFileInput = () => {
  fileInputRef.value?.click()
}

/** 拖拽放置文件 */
const handleFileDrop = (e) => {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) processFile(file)
}

/** 文件选择 */
const handleFileSelect = (e) => {
  const file = e.target?.files?.[0]
  if (file) processFile(file)
}

/** 从 ArrayBuffer 智能检测编码并解码为字符串（支持 UTF-8 / GBK / UTF-16） */
const decodeTextBuffer = (buffer) => {
  const bytes = new Uint8Array(buffer)

  /* 检测 BOM 头 */
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return new TextDecoder('utf-8').decode(buffer)
  }
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return new TextDecoder('utf-16le').decode(buffer)
  }
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
    return new TextDecoder('utf-16be').decode(buffer)
  }

  /* 无 BOM：先尝试 UTF-8 严格模式，失败则回退 GBK（网络小说最常见的非 UTF-8 编码） */
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return new TextDecoder('gbk').decode(buffer)
  }
}

/** 处理上传文件（读取txt内容，自动检测编码） */
const processFile = (file) => {
  const ext = '.' + file.name.split('.').pop().toLowerCase()
  if (ext !== '.txt') {
    showToast('仅支持 .txt 格式文件', 'warning')
    return
  }
  if (file.size > 20 * 1024 * 1024) {
    showToast('文件大小不能超过 20MB', 'warning')
    return
  }

  uploadedFileName.value = file.name

  const reader = new FileReader()
  reader.onload = (e) => {
    uploadedFileContent.value = decodeTextBuffer(e.target.result)
  }
  reader.readAsArrayBuffer(file)
}

/* ============= 分析章节 ============= */
const analyzeProgress = ref(0)

/** 开始分析章节 */
const startAnalyze = async () => {
  viewState.value = 'analyzing'
  analyzeProgress.value = 0

  /* 获取原文内容（优先文件上传内容，其次粘贴内容） */
  const content = uploadedFileContent.value || pasteContent.value

  /* 模拟分析进度（前端Mock） */
  const timer = setInterval(() => {
    analyzeProgress.value += Math.random() * 15
    if (analyzeProgress.value >= 100) {
      analyzeProgress.value = 100
      clearInterval(timer)

      /* 模拟章节分析结果 */
      generateMockChapters(content)
      viewState.value = 'chapters'
    }
  }, 400)
}

/* ============= 章节列表 ============= */
const chapters = ref([])

/** 生成章节数据（保留完整原文用于后续保存） */
const generateMockChapters = (content) => {
  const chapterRegex = /第[一二三四五六七八九十百千\d]+章[\s:：]*/g
  const matches = [...content.matchAll(chapterRegex)]

  if (matches.length > 1) {
    chapters.value = matches.map((m, i) => {
      const startIdx = m.index
      const endIdx = matches[i + 1]?.index || content.length
      const chapterText = content.slice(startIdx, endIdx).trim()
      const firstLine = chapterText.split('\n')[0] || ''
      const bodyText = chapterText.slice(firstLine.length).trim()

      return {
        selected: false,
        chapterNum: i + 1,
        volume: '第一卷',
        title: firstLine.replace(/第[一二三四五六七八九十百千\d]+章[\s:：]*/, '').trim() || `第${i + 1}章`,
        content: bodyText,
        preview: bodyText.slice(0, 30),
        wordCount: bodyText.length,
      }
    })
  } else {
    const chapterCount = Math.max(3, Math.min(30, Math.ceil(content.length / 2000)))
    chapters.value = Array.from({ length: chapterCount }, (_, i) => {
      const bodyText = content.slice(i * 2000, (i + 1) * 2000)
      return {
        selected: false,
        chapterNum: i + 1,
        volume: '',
        title: `第${i + 1}章`,
        content: bodyText,
        preview: bodyText.slice(0, 30) || '',
        wordCount: bodyText.length,
      }
    })
  }
}

/* 全选/取消全选 */
const isAllSelected = computed(() => chapters.value.length > 0 && chapters.value.every(c => c.selected))
const isPartialSelected = computed(() => {
  const selected = chapters.value.filter(c => c.selected).length
  return selected > 0 && selected < chapters.value.length
})
const toggleSelectAll = () => {
  const newVal = !isAllSelected.value
  chapters.value.forEach(c => { c.selected = newVal })
}

/* 已选数量与字数统计 */
const selectedCount = computed(() => chapters.value.filter(c => c.selected).length)
const selectedWordCount = computed(() => {
  return chapters.value.filter(c => c.selected).reduce((sum, c) => sum + (c.wordCount || 0), 0)
})
const saveButtonText = computed(() => {
  if (!copyrightConfirmChecked.value) return '请先确认版权声明'
  return '保存'
})

/**
 * 自动调整集数：当选中章节数 < 当前预设集数时，自动降档
 * 规则：向下取整到5的倍数，最小10集
 */
const autoAdjustEpisodes = (chapterCount) => {
  const currentEpisodes = scriptParams.value.episodes
  if (chapterCount <= 0 || chapterCount >= currentEpisodes) return
  const adjusted = Math.max(10, Math.floor(chapterCount / 5) * 5)
  if (adjusted !== currentEpisodes) {
    scriptParams.value = { ...scriptParams.value, episodes: adjusted }
    showToast(`已选${chapterCount}章，集数已自动调整为${adjusted}集（集数不可超过章节数）`, 'warning')
  }
}

watch(selectedCount, (newCount) => {
  if (newCount > 0) autoAdjustEpisodes(newCount)
})

/* ============= 悬浮快捷选择 ============= */
const hoveredIdx = ref(-1)
let hoverLeaveTimer = null
const popoverRef = ref(null)

/** 鼠标进入未选中的章节行 */
const onChapterMouseEnter = (idx) => {
  clearTimeout(hoverLeaveTimer)
  if (chapters.value[idx]?.selected) {
    hoveredIdx.value = -1
    return
  }
  hoveredIdx.value = idx
}

/** 鼠标离开章节行（延迟关闭，让用户能点到悬浮框） */
const onChapterMouseLeave = () => {
  clearTimeout(hoverLeaveTimer)
  hoverLeaveTimer = setTimeout(() => {
    hoveredIdx.value = -1
  }, 200)
}

/** 鼠标进入悬浮框本身，取消关闭 */
const onPopoverEnter = () => {
  clearTimeout(hoverLeaveTimer)
}

/** 鼠标离开悬浮框，关闭 */
const onPopoverLeave = () => {
  clearTimeout(hoverLeaveTimer)
  hoverLeaveTimer = setTimeout(() => {
    hoveredIdx.value = -1
  }, 150)
}

/**
 * 计算悬浮行的快捷按钮
 * 返回 { prev: { from, to } | null, next: { from, to } | null }
 */
const hoverActions = computed(() => {
  const idx = hoveredIdx.value
  if (idx < 0 || idx >= chapters.value.length) return { prev: null, next: null }

  const list = chapters.value
  const currentNum = list[idx].chapterNum
  const isFirst = idx === 0
  const isLast = idx === list.length - 1

  /* 往前看 */
  let prev = null
  if (!isFirst) {
    let prevSelIdx = -1
    for (let i = idx - 1; i >= 0; i--) {
      if (list[i].selected) { prevSelIdx = i; break }
    }
    if (prevSelIdx === -1) {
      prev = { from: list[0].chapterNum, to: currentNum }
    } else if (prevSelIdx < idx - 1) {
      prev = { from: list[prevSelIdx].chapterNum + 1, to: currentNum }
    }
  }

  /* 往后看 */
  let next = null
  if (!isLast) {
    let nextSelIdx = -1
    for (let i = idx + 1; i < list.length; i++) {
      if (list[i].selected) { nextSelIdx = i; break }
    }
    if (nextSelIdx === -1) {
      next = { from: currentNum, to: list[list.length - 1].chapterNum }
    } else if (nextSelIdx > idx + 1) {
      next = { from: currentNum, to: list[nextSelIdx].chapterNum - 1 }
    }
  }

  return { prev, next }
})

/** 批量选中指定章节号范围 [from, to] */
const batchSelect = (from, to) => {
  chapters.value.forEach(ch => {
    if (ch.chapterNum >= from && ch.chapterNum <= to) {
      ch.selected = true
    }
  })
  hoveredIdx.value = -1
}

/** 返回上传页 */
const goBackToUpload = () => {
  viewState.value = 'upload'
}

/** 保存并跳转到小说编辑页 */
const isSaving = ref(false)
const saveProgress = ref(0)
const saveStatusText = ref('')
const officialSiteUrl = computed(() => runtimeConfig.public.officialSiteUrl)

/* ============= 配额/会员引导弹窗 ============= */
const limitDialog = reactive({
  visible: false, icon: 'lucide:crown', title: '', description: '',
  confirmText: '', cancelText: '取消', confirmType: 'primary', onConfirm: null,
})

const openExternal = (url) => {
  if (!url || !process.client) return
  window.open(url, '_blank', 'noopener,noreferrer')
}

const showLimitDialog = ({
  icon,
  title,
  description,
  confirmText,
  confirmType = 'primary',
  cancelText = '取消',
}) => {
  return new Promise((resolve) => {
    let resolved = false
    let stop = null
    Object.assign(limitDialog, { icon, title, description, confirmText, confirmType, cancelText, visible: true })
    limitDialog.onConfirm = () => {
      if (resolved) return
      resolved = true
      stop?.()
      limitDialog.visible = false
      resolve(true)
    }
    stop = watch(() => limitDialog.visible, (val) => {
      if (!val && !resolved) { resolved = true; stop(); resolve(false) }
    })
  })
}

const checkNovelSavePermission = async (totalWords) => {
  if (userStore.isLocalMode) return true

  try {
    const membership = resolveMembershipInfo(userStore.userInfo)
    const [scriptRes, novelRes] = await Promise.all([
      get('/api/script?page=1&pageSize=1'),
      get('/api/novel-project?page=1&pageSize=1'),
    ])
    const total = (scriptRes?.data?.count ?? 0) + (novelRes?.data?.count ?? 0)
    if (membership.createLimit > 0 && total >= membership.createLimit) {
      const dialog = buildCreationLimitDialog(membership, total + 1)
      const confirmed = await showLimitDialog({
        icon: 'lucide:crown',
        title: dialog.title,
        description: dialog.description,
        confirmText: dialog.confirmText,
        cancelText: dialog.shouldNavigate ? '稍后再说' : '继续调整',
        confirmType: 'primary',
      })
      if (confirmed && dialog.shouldNavigate) {
        navigateTo('/recharge')
      }
      return false
    }

    if (membership.novelWordLimit > 0 && totalWords > membership.novelWordLimit) {
      const dialog = buildNovelWordLimitDialog(membership, totalWords)
      const confirmed = await showLimitDialog({
        icon: membership.level === 'advanced' ? 'lucide:triangle-alert' : 'lucide:crown',
        title: dialog.title,
        description: dialog.description,
        confirmText: dialog.confirmText,
        cancelText: dialog.shouldNavigate ? '返回调整' : '继续调整',
        confirmType: 'primary',
      })
      if (confirmed && dialog.shouldNavigate) {
        navigateTo('/recharge')
      }
      return false
    }
  } catch {
    /* 查询失败不阻塞，让后端做最终兜底 */
  }

  return true
}

const handleSave = async () => {
  const selectedChapters = chapters.value.filter(c => c.selected)
  if (selectedChapters.length === 0) {
    showToast('请至少选择一个章节', 'warning')
    return
  }
  if (!copyrightConfirmChecked.value) {
    showToast('请先确认已获得授权或内容为本人原创', 'warning')
    return
  }

  /* 兜底：保存前再次确保集数不超过章节数 */
  if (selectedChapters.length < scriptParams.value.episodes) {
    const adjusted = Math.max(10, Math.floor(selectedChapters.length / 5) * 5)
    scriptParams.value = { ...scriptParams.value, episodes: adjusted }
  }

  const totalWords = selectedChapters.reduce((sum, c) => sum + (c.wordCount || 0), 0)

  const permissionOk = await checkNovelSavePermission(totalWords)
  if (!permissionOk) return

  if (userStore.isLocalMode && totalWords > 300000) {
    const confirmed = await showLimitDialog({
      icon: 'lucide:triangle-alert',
      title: '超过最大存储字数30万字',
      description: '当前已超过本地模式最大存储字数，请减少章节，或者用官方平台创建。',
      confirmText: '访问官方平台',
      cancelText: '返回调整',
      confirmType: 'primary',
    })
    if (confirmed) {
      openExternal(officialSiteUrl.value)
    }
    return
  }

  if (isSaving.value) return
  isSaving.value = true
  saveProgress.value = 0
  saveStatusText.value = '正在创建项目...'
  let keepSavingOverlay = false

  try {
    /* 阶段1：模拟上传准备进度 */
    saveProgress.value = 10
    saveStatusText.value = `正在上传 ${selectedChapters.length} 个章节（${totalWords.toLocaleString()} 字）...`

    /* 阶段2：发送创建请求 */
    const progressTimer = setInterval(() => {
      if (saveProgress.value < 85) saveProgress.value += Math.random() * 8
    }, 300)

    const res = await post('/api/novel-project', {
      title: uploadedFileName.value?.replace(/\.txt$/i, '') || '未命名小说',
      totalEpisodes: scriptParams.value.episodes,
      duration: scriptParams.value.duration,
      gender: scriptParams.value.gender,
      genre: scriptParams.value.genre,
      artStyle: scriptParams.value.artStyle,
      aspectRatio: scriptParams.value.aspectRatio,
      copyrightConfirmAccepted: true,
      copyrightConfirmVersion: COPYRIGHT_CONFIRM_VERSION,
      copyrightConfirmText: COPYRIGHT_CONFIRM_TEXT,
      chapters: selectedChapters.map(c => ({
        chapterIndex: c.chapterNum,
        title: c.title,
        content: c.content,
      })),
    })

    clearInterval(progressTimer)

    if (res?.code === 200 && res.data?.id) {
      saveProgress.value = 100
      saveStatusText.value = '保存成功，正在跳转...'
      keepSavingOverlay = true
      await new Promise(r => setTimeout(r, 500))
      navigateTo(`/novel/${res.data.id}`)
    } else {
      showToast(res?.message || '保存失败', 'error')
    }
  } catch (err) {
    showToast(err.message || '保存失败，请重试', 'error')
  } finally {
    if (keepSavingOverlay) return
    isSaving.value = false
    saveProgress.value = 0
  }
}
</script>

<style scoped>
/* ========================================
 * 小说转剧本 - 初始化页面
 * ======================================== */
.novel-init {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 72px - 40px);
  overflow: hidden;
}

.novel-init__header {
  margin-bottom: 20px;
  flex-shrink: 0;
}

.novel-init__heading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 22px;
  font-weight: 800;
  color: var(--color-text);
  margin-bottom: 6px;
}

.novel-init__heading-icon {
  font-size: 24px;
}

.novel-init__subtitle {
  font-size: 13px;
  color: var(--color-text-secondary);
}

/* 三栏布局 */
.novel-init__layout {
  display: flex;
  gap: 20px;
  align-items: stretch;
  flex: 1;
  min-height: 0;
}

/* 左侧参数面板 */
.novel-init__left {
  width: 288px;
  flex-shrink: 0;
  min-height: 0;
  overflow-y: auto;
}

/* 中间内容区 */
.novel-init__center {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

/* 右侧展示盘 */
.novel-init__right {
  width: 300px;
  flex-shrink: 0;
  min-height: 0;
  overflow-y: auto;
}

/* ========================================
 * 上传卡片
 * ======================================== */
.novel-init__upload-card,
.novel-init__analyzing-card,
.novel-init__chapters-card {
  background: var(--color-bg-white);
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  padding: 28px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.novel-init__upload-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 16px;
  flex-shrink: 0;
}

/* ========================================
 * 分步导航
 * ======================================== */
.novel-init__steps {
  display: flex;
  gap: 24px;
  margin-bottom: 20px;
  border-bottom: 2px solid var(--color-border-light);
  padding-bottom: 0;
  flex-shrink: 0;
}

.novel-init__step {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-light);
  padding-bottom: 10px;
  cursor: pointer;
  position: relative;
  transition: color 0.2s;
}

.novel-init__step--active {
  color: var(--color-primary);
  font-weight: 700;
}

.novel-init__step--active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -2px;
  height: 2px;
  background: var(--color-primary);
  border-radius: 1px;
}

/* ========================================
 * 拖拽上传区
 * ======================================== */
.novel-init__drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px 20px;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius);
  background: var(--color-bg);
  cursor: pointer;
  transition: all 0.25s;
}

.novel-init__drop-zone:hover,
.novel-init__drop-zone--hover {
  border-color: var(--color-primary);
  background: rgba(158, 54, 255, 0.03);
}

.novel-init__file-input {
  display: none;
}

.novel-init__drop-icon {
  color: var(--color-primary);
  margin-bottom: 12px;
  opacity: 0.7;
}

.novel-init__drop-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 6px;
}

.novel-init__drop-hint {
  font-size: 12px;
  color: var(--color-text-light);
}

.novel-init__drop-file {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 6px 16px;
  background: rgba(158, 54, 255, 0.08);
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-primary);
}

/* ========================================
 * 分隔符（或）
 * ======================================== */
.novel-init__divider {
  display: flex;
  align-items: center;
  margin: 20px 0;
}

.novel-init__divider::before,
.novel-init__divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-border-light);
}

.novel-init__divider-text {
  padding: 0 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-light);
}

/* ========================================
 * 粘贴区
 * ======================================== */
.novel-init__paste-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.novel-init__paste-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 8px;
}

.novel-init__paste-textarea {
  width: 100%;
  flex: 1;
  min-height: 0;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  color: var(--color-text);
  background: var(--color-bg);
  resize: none;
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
}

.novel-init__paste-textarea:focus {
  border-color: var(--color-primary);
  background: var(--color-bg-white);
  box-shadow: 0 0 0 3px rgba(158, 54, 255, 0.08);
}

.novel-init__paste-textarea::placeholder {
  color: var(--color-text-light);
  font-size: 13px;
}

/* ========================================
 * 开始分析按钮
 * ======================================== */
.novel-init__actions {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

.novel-init__btn-analyze {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 36px;
  background: linear-gradient(90deg, #9E36FF 0%, #FF4472 55%, #FFAA4C 100%);
  color: #fff;
  border-radius: 28px;
  font-size: 15px;
  font-weight: 700;
  box-shadow: 0 4px 16px rgba(158, 54, 255, 0.3);
  transition: all 0.25s;
  border: none;
  cursor: pointer;
}

.novel-init__btn-analyze:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(158, 54, 255, 0.4);
}

/* ========================================
 * 分析中 Loading
 * ======================================== */
.novel-init__analyzing-card {
  align-items: center;
  justify-content: center;
}

.novel-init__analyzing-spinner {
  margin-bottom: 24px;
}

.novel-init__spinner {
  width: 56px;
  height: 56px;
  border: 4px solid var(--color-border-light);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: novel-spin 0.8s linear infinite;
}

@keyframes novel-spin {
  to { transform: rotate(360deg); }
}

.novel-init__analyzing-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 8px;
}

.novel-init__analyzing-hint {
  font-size: 13px;
  color: var(--color-text-light);
  margin-bottom: 24px;
  text-align: center;
}

.novel-init__analyzing-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 280px;
}

.novel-init__progress-bar {
  flex: 1;
  height: 6px;
  background: var(--color-border-light);
  border-radius: 3px;
  overflow: hidden;
}

.novel-init__progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #9E36FF, #FF4472);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.novel-init__progress-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
  min-width: 36px;
  text-align: right;
}

/* ========================================
 * 章节列表
 * ======================================== */
.novel-init__table-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-sm);
}

.novel-init__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.novel-init__th {
  text-align: left;
  padding: 12px 14px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border-light);
  position: sticky;
  top: 0;
  z-index: 1;
}

.novel-init__th--check {
  width: 40px;
  text-align: center;
}

.novel-init__th--num {
  width: 40px;
}

.novel-init__th--vol {
  width: 100px;
}

.novel-init__th--name {
  width: 170px;
}

.novel-init__tr {
  transition: background 0.15s;
}

.novel-init__tr:hover {
  background: rgba(158, 54, 255, 0.03);
}

.novel-init__tr--selected {
  background: rgba(158, 54, 255, 0.06);
}

.novel-init__td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--color-border-light);
  color: var(--color-text);
}

.novel-init__td--check {
  text-align: center;
}

.novel-init__td--num {
  font-weight: 600;
  color: var(--color-text-secondary);
}

.novel-init__td--vol {
  color: var(--color-text-secondary);
}

.novel-init__td--name {
  font-weight: 600;
}

.novel-init__content-preview {
  color: var(--color-text-secondary);
  font-size: 12px;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
}

/* 悬浮行高亮 */
.novel-init__tr--hovered {
  background: rgba(158, 54, 255, 0.05);
}

/* checkbox 列需要 relative 定位来承载悬浮框 */
.novel-init__td--check {
  position: relative;
}

/* 悬浮快捷选择框（从 checkbox 右侧弹出） */
.novel-init__batch-popover {
  position: absolute;
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  margin-left: 4px;
  display: flex;
  gap: 6px;
  padding: 5px 6px;
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1), 0 1px 4px rgba(0, 0, 0, 0.06);
  z-index: 5;
  white-space: nowrap;
}

.novel-init__batch-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-primary);
  background: rgba(158, 54, 255, 0.06);
  border: 1px solid rgba(158, 54, 255, 0.15);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.novel-init__batch-btn:hover {
  background: rgba(158, 54, 255, 0.14);
  border-color: var(--color-primary);
  box-shadow: 0 2px 8px rgba(158, 54, 255, 0.15);
}

/* 悬浮框出入动画 */
.batch-pop-enter-active {
  transition: all 0.18s ease-out;
}
.batch-pop-leave-active {
  transition: all 0.12s ease-in;
}
.batch-pop-enter-from {
  opacity: 0;
  transform: translateY(-50%) translateX(-6px);
}
.batch-pop-leave-to {
  opacity: 0;
  transform: translateY(-50%) translateX(-4px);
}

/* checkbox美化：自定义样式，选中后白色对钩 */
.novel-init__table input[type="checkbox"] {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg-white);
  cursor: pointer;
  position: relative;
  transition: all 0.2s;
  flex-shrink: 0;
}

.novel-init__table input[type="checkbox"]:hover {
  border-color: var(--color-primary);
}

.novel-init__table input[type="checkbox"]:checked {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.novel-init__table input[type="checkbox"]:checked::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 1px;
  width: 5px;
  height: 10px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

/* 半选状态（全选按钮的中间态） */
.novel-init__table input[type="checkbox"]:indeterminate {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.novel-init__table input[type="checkbox"]:indeterminate::after {
  content: '';
  position: absolute;
  left: 3px;
  top: 6px;
  width: 8px;
  height: 2px;
  background: #fff;
  border-radius: 1px;
}

/* ========================================
 * 章节列表底部
 * ======================================== */
.novel-init__chapters-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 16px;
  margin-top: 12px;
  border-top: 1px solid var(--color-border-light);
  flex-shrink: 0;
}

.novel-init__selected-info {
  font-size: 13px;
  color: var(--color-text-secondary);
  flex:1;
  margin-right: 10px;
}

.novel-init__chapters-btns {
  display: flex;
  gap: 12px;
}

.novel-init__btn-back {
  padding: 10px 28px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-white);
  color: var(--color-text);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.novel-init__btn-back:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.novel-init__btn-save {
  padding: 10px 28px;
  border: none;
  border-radius: var(--radius-sm);
  background: linear-gradient(90deg, #9E36FF 0%, #FF4472 55%, #FFAA4C 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s;
  box-shadow: 0 3px 12px rgba(158, 54, 255, 0.25);
}

.novel-init__btn-save:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 5px 18px rgba(158, 54, 255, 0.35);
}

.novel-init__btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 保存进度覆盖层 */
.novel-init__save-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(4px);
  border-radius: inherit;
}

.novel-init__save-overlay-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 320px;
}

.novel-init__save-spinner {
  color: var(--color-primary);
  animation: novel-spin 0.8s linear infinite;
}

.novel-init__save-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  text-align: center;
}

.novel-init__save-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

/* ========================================
 * 版权声明
 * ======================================== */
.novel-init__copyright {
  margin-top: 16px;
  padding: 16px 18px;
  background: linear-gradient(135deg, rgba(255, 170, 76, 0.06) 0%, rgba(255, 68, 114, 0.04) 100%);
  border: 1px solid rgba(255, 170, 76, 0.2);
  border-radius: var(--radius);
}

.novel-init__copyright-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.novel-init__copyright-icon {
  color: #e8860c;
  flex-shrink: 0;
}

.novel-init__copyright-title {
  font-size: 13px;
  font-weight: 700;
  color: #c27209;
}

.novel-init__copyright-text {
  font-size: 12px;
  line-height: 1.8;
  color: var(--color-text-secondary);
}

.novel-init__copyright-text strong {
  color: #c27209;
  font-weight: 600;
}

.novel-init__copyright-sub {
  margin-top: 8px;
  font-size: 11px;
  line-height: 1.6;
  color: var(--color-text-light);
}

.novel-init__copyright-check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 14px;
  cursor: pointer;
}

.novel-init__copyright-checkbox {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  margin-top: 2px;
  border: 2px solid rgba(194, 114, 9, 0.4);
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  flex-shrink: 0;
  position: relative;
  transition: all 0.2s ease;
}

.novel-init__copyright-checkbox:hover {
  border-color: #c27209;
}

.novel-init__copyright-checkbox:checked {
  background: linear-gradient(135deg, #ff9b3d 0%, #ff6a56 100%);
  border-color: transparent;
}

.novel-init__copyright-checkbox:checked::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 1px;
  width: 4px;
  height: 8px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.novel-init__copyright-check-text {
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-text);
  font-weight: 600;
}

.novel-init__copyright-tip {
  margin-top: 8px;
  font-size: 11px;
  line-height: 1.6;
  color: var(--color-error);
}

/* 版权声明呼吸光晕 —— 选了章节但没勾选时引导注意力 */
.novel-init__copyright--attention {
  animation: copyrightPulse 2s ease-in-out infinite;
  border-color: rgba(255, 140, 50, 0.5);
}

@keyframes copyrightPulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(255, 140, 50, 0);
    border-color: rgba(255, 140, 50, 0.25);
  }
  50% {
    box-shadow: 0 0 12px 3px rgba(255, 140, 50, 0.25);
    border-color: rgba(255, 140, 50, 0.6);
  }
}

/* ========================================
 * 响应式
 * ======================================== */
@media (max-width: 1200px) {
  .novel-init__right {
    width: 260px;
  }
  .novel-init__left {
    width: 240px;
  }
}

@media (max-width: 900px) {
  .novel-init__layout {
    flex-direction: column;
  }
  .novel-init__left,
  .novel-init__right {
    width: 100%;
  }
}
</style>
