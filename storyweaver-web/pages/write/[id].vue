<template>
  <div class="write-editor">
    <!-- Teleport: 标题注入到Topbar左侧（ClientOnly避免SSR hydration不匹配导致block tree崩溃） -->
    <ClientOnly>
      <Teleport to="#topbar-left-slot">
        <h2 class="write-editor__title">{{ scriptData.title || '未命名剧本' }}</h2>
      </Teleport>
    </ClientOnly>

    <!-- 三栏主体 -->
    <div class="write-editor__body">
      <!-- 左侧：封面生成 + 参数只读展示 + 底部操作按钮 -->
      <div class="write-editor__left">
        <div class="write-editor__left-scroll">
          <WriteCoverGenerator
            :script-id="scriptId"
            :initial-cover="scriptCover"
            :initial-prompt="scriptCoverPrompt"
          />
          <WriteParamsDisplay
            :params="scriptParams"
            @edit="paramsModalVisible = true"
          />
        </div>
        <div class="write-editor__left-actions">
          <button class="write-editor__action-btn write-editor__action-btn--preview" @click="handlePreviewDownload">
            预览下载
          </button>
        </div>
      </div>

      <!-- 中间：内容编辑区 -->
      <div
        class="write-editor__center"
        :class="{
          'write-editor__center--left-closed': !leftPanelOpen,
          'write-editor__center--right-closed': !rightPanelOpen,
          'write-editor__center--both-closed': !leftPanelOpen && !rightPanelOpen,
        }"
      >
        <WriteScriptContent
          ref="scriptContentRef"
          v-model="scriptData"
          :character-cards="characterCards"
          :ai-filling-field="aiFillingField"
          :lock-state="lockState"
          :episode-lock-state="episodeLockState"
          :generating-episode-index="generatingEpisodeIndex"
          :generating-storyboard-index="generatingStoryboardIndex"
          :generating-video-storyboard-index="generatingVideoStoryboardIndex"
          :is-batch-generating="isBatchGenerating"
          :batch-progress="batchProgress"
          :script-id="scriptId"
          :api-base="API_BASE"
          @toggle-lock="handleToggleLock"
          @toggle-episode-lock="handleToggleEpisodeLock"
          @generate-episode-script="handleGenerateEpisodeScript"
          @stop-generate-script="handleStopGenerateScript"
          @save-script-content="debounceSaveScriptContent"
          @batch-lock="handleBatchLock"
          @batch-unlock="handleBatchUnlock"
          @batch-script-continue="handleBatchScriptContinue"
          @batch-script-clear="handleBatchScriptClear"
          @batch-script-regenerate="handleBatchScriptRegenerate"
          @stop-batch-generate="handleStopBatchGenerate"
          @generate-storyboard="handleGenerateStoryboard"
          @stop-generate-storyboard="handleStopGenerateStoryboard"
          @batch-storyboard-continue="handleBatchStoryboardContinue"
          @batch-storyboard-clear="handleBatchStoryboardClear"
          @batch-storyboard-regenerate="handleBatchStoryboardRegenerate"
          @save-storyboard="handleSaveStoryboard"
          @generate-video-storyboard="handleGenerateVideoStoryboard"
          @stop-generate-video-storyboard="handleStopGenerateVideoStoryboard"
          @batch-video-storyboard-continue="handleBatchVideoStoryboardContinue"
          @batch-video-storyboard-clear="handleBatchVideoStoryboardClear"
          @batch-video-storyboard-regenerate="handleBatchVideoStoryboardRegenerate"
          @save-video-storyboard="handleSaveVideoStoryboard"
          @parse-characters="handleParseCharacters"
          @save-characters="handleSaveCharacters"
          @update:character-cards="characterCards = $event"
        />
      </div>

      <!-- 右侧：AI聊天区 -->
      <div v-show="rightPanelOpen" class="write-editor__right">
        <WriteAiChat
          ref="aiChatRef"
          :script-id="scriptId"
          :stream-callbacks="streamCallbacks"
          :resolve-outgoing-message="resolveContinueMessage"
          @generate="handleGenerate"
        />
      </div>
      <!-- 右侧：收起时的展开按钮 -->
      <div v-show="!rightPanelOpen" class="write-editor__expand-btn write-editor__expand-btn--right" @click="rightPanelOpen = true">
        <span>◀</span>
      </div>
    </div>

    <!-- 参数编辑弹窗 -->
    <WriteParamsModal
      :visible="paramsModalVisible"
      v-model="scriptParams"
      :user-idea="userIdea"
      @close="paramsModalVisible = false"
      @light-save="handleLightSave"
      @rewrite="handleRewrite"
    />

    <!-- 预览弹窗 -->
    <WritePreviewModal
      :visible="previewModalVisible"
      :script-data="scriptData"
      :script-id="scriptId"
      preview-mode="script"
      @close="previewModalVisible = false"
    />

    <!-- 通用确认弹窗 -->
    <CommonConfirmDialog
      :visible="confirmDialog.visible"
      :icon="confirmDialog.icon"
      :title="confirmDialog.title"
      :description="confirmDialog.description"
      :confirm-text="confirmDialog.confirmText"
      :confirm-type="confirmDialog.confirmType"
      @update:visible="confirmDialog.visible = $event"
      @confirm="confirmDialog.onConfirm?.()"
      @cancel="confirmDialog.visible = false"
    />

    <CommonAccessGuardDialog
      :state="guardDialog"
      @update:visible="guardDialog.visible = $event"
      @confirm="handleGuardConfirm"
      @cancel="guardDialog.visible = false"
    />

    <!-- AI生成中离开确认弹窗 -->
    <CommonConfirmDialog
      :visible="leaveConfirmVisible"
      icon="lucide:alert-triangle"
      :title="leaveConfirmTitle"
      :description="leaveConfirmDesc"
      confirm-text="离开页面"
      cancel-text="继续等待"
      confirm-type="danger"
      @confirm="confirmLeave"
      @cancel="cancelLeave"
    />
  </div>
</template>

<script setup>
/**
 * 写剧本 - 写作详情页
 * 三栏布局：左侧参数（可收缩）+ 中间内容编辑 + 右侧AI聊天
 * 左右面板收缩时，中间内容区自适应宽度
 * 输入框内容变更自动防抖保存
 */

definePageMeta({
  layout: 'write',
  middleware: 'auth'
})

useSeo()

const { checkSseResponse, checkModelConfig } = useModelGuard()

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const { get, put, post } = useApi()
const { showToast } = useToast()
const {
  guardDialog,
  handleGuardConfirm,
  ensureAccess,
} = useAccessGuard()

/* 剧本ID */
const scriptId = route.params.id

/* AI聊天组件引用 */
const aiChatRef = ref(null)

/* 当前AI正在填充的字段名（用于高亮动画） */
const aiFillingField = ref('')

/* 完整重新生成标志：检测到AI从头输出【标题：】时置为true，后续字段直接替换而非合并 */
let isFullRegeneration = false

/* ========================================
 * 锁定状态管理
 * 锁定后AI不会覆盖/合并该字段内容
 * ======================================== */

/* 主字段锁定状态 */
const lockState = ref({
  title: 0,
  basicInfo: 0,
  synopsis: 0,
  characters: 0,
  emotionPoints: 0,
  plotLines: 0,
})

/* 剧集锁定状态数组 */
const episodeLockState = ref([])

/* 锁定字段名 → 接口字段名映射 */
const lockFieldMap = {
  title: 'title_locked',
  basicInfo: 'basic_info_locked',
  synopsis: 'synopsis_locked',
  characters: 'characters_locked',
  emotionPoints: 'emotion_points_locked',
  plotLines: 'plot_lines_locked',
}

/** 切换主字段锁定状态并保存到后端 */
const handleToggleLock = async (field) => {
  const newVal = lockState.value[field] ? 0 : 1
  lockState.value[field] = newVal
  try {
    await put(`/api/script/${scriptId}`, { [lockFieldMap[field]]: newVal })
  } catch (e) {
    console.error('保存锁定状态失败:', e)
    /* 回滚 */
    lockState.value[field] = newVal ? 0 : 1
  }
}

/** 切换剧集锁定状态并保存到后端 */
const handleToggleEpisodeLock = async (index) => {
  const newVal = episodeLockState.value[index] ? 0 : 1
  episodeLockState.value[index] = newVal
  try {
    await post('/api/script-episode/batch-save', {
      scriptId,
      episodes: [{
        episodeNumber: index + 1,
        title: (scriptData.value.episodes[index]?.title || '').trim(),
        content: (scriptData.value.episodes[index]?.content || '').trim(),
        isLocked: newVal,
      }],
    })
  } catch (e) {
    console.error('保存剧集锁定状态失败:', e)
    episodeLockState.value[index] = newVal ? 0 : 1
  }
}

/* ========================================
 * 截断续传：智能合并工具函数
 * AI输出被截断后继续时，新内容可能与已有内容有重叠部分
 * 此函数检测重叠并去重拼接，避免内容重复
 * ======================================== */

/**
 * 智能合并已有内容和新内容（处理截断续传场景）
 *
 * 多层防御策略（按优先级依次尝试）：
 * L1: 全文包含检测 —— incoming包含existing开头特征，说明AI重新输出了整段，取较长版本
 * L2: 扩大范围的overlap搜索 —— 在整个incoming中搜索existing尾部重叠片段
 * L3: 行级相似度检测 —— 超过50%的行完全相同，认为是同一段落的不同AI版本
 * L4: 兜底追加 —— 以上都不匹配，换行拼接
 *
 * @param {string} existing - 已有内容
 * @param {string} incoming - 新输入内容
 * @returns {string} 合并后的内容
 */
const smartMerge = (existing, incoming) => {
  if (!existing) return incoming
  if (!incoming) return existing

  /* 清理续传标记：(续)、（续）、续：等 */
  const cleaned = incoming
    .replace(/^\s*[（(]续[）)][：:\s]*/g, '')
    .replace(/^\s*续[：:\s]+/g, '')
    .replace(/^\s*[（(]接上文[）)][：:\s]*/g, '')
    .replace(/^\s*接上文[：:\s]*/g, '')
    .trimStart()

  if (!cleaned) return existing

  /* ---------- L1: 全文包含检测 ----------
   * 取existing开头50字符作为指纹，若incoming包含该指纹，
   * 说明AI重新输出了该段落的完整版（或更完整版），取较长者 */
  const fingerprint = existing.slice(0, 50).trim()
  if (fingerprint.length >= 15 && cleaned.includes(fingerprint)) {
    console.log('[smartMerge-L1] incoming包含existing开头指纹，AI重新输出了该段落')
    return cleaned.length >= existing.length ? cleaned : existing
  }

  /* ---------- L2: 扩大范围的overlap搜索 ----------
   * 不再限制搜索范围为incoming前300字符，而是搜索整个incoming
   * 这样即使AI在重叠内容前插入了大段已有内容也能检测到 */
  const maxTailLen = Math.min(existing.length, 300)
  for (let tailLen = maxTailLen; tailLen >= 10; tailLen--) {
    const tail = existing.slice(-tailLen)
    const pos = cleaned.indexOf(tail)
    if (pos !== -1) {
      const afterOverlap = cleaned.slice(pos + tailLen)
      if (afterOverlap.trim()) {
        console.log('[smartMerge-L2] 找到overlap，tailLen:', tailLen, 'pos:', pos)
        return existing + afterOverlap
      }
      /* overlap之后没有新内容，说明incoming完全是existing的子集 */
      console.log('[smartMerge-L2] overlap之后无新内容，保留existing')
      return existing
    }
  }

  /* ---------- L3: 行级相似度检测 ----------
   * 提取有效行（去空行和短行）做精确匹配，超50%相同则认为是同一段落的不同版本 */
  const existingLines = existing.split('\n').map(l => l.trim()).filter(l => l.length > 10)
  const cleanedLines = cleaned.split('\n').map(l => l.trim()).filter(l => l.length > 10)
  if (existingLines.length >= 3 && cleanedLines.length >= 3) {
    const matchCount = existingLines.filter(line =>
      cleanedLines.some(cl => cl === line)
    ).length
    const matchRatio = matchCount / existingLines.length
    if (matchRatio >= 0.5) {
      console.log('[smartMerge-L3] 行级相似度:', (matchRatio * 100).toFixed(0) + '%，AI重新输出，取较长版本')
      return cleaned.length >= existing.length ? cleaned : existing
    }
  }

  /* ---------- L4: 兜底追加 ---------- */
  console.log('[smartMerge-L4] 无重叠检测到，直接追加')
  return existing + '\n' + cleaned
}

/* ========================================
 * AI流式解析器：将AI输出自动填充到左侧表单
 * ======================================== */
/**
 * 判断文本是否有实质内容（去掉标点符号和空白后是否还有字符）
 * 防止AI回复中提到"【标题】、【一、基本信息】、..."时，
 * 标记之间的标点符号（如"、"）被误判为有效内容，导致清空表单
 */
const hasSubstantialContent = (text) => {
  if (!text) return false
  return text.replace(/[\s、，。：:；;！!？?.,\-—…·""''「」【】《》（）()\d]/g, '').length > 0
}

const { feedDelta, flush, reset: resetParser } = useScriptParser({
  /**
   * 段落完成回调：将内容填充到对应字段
   * 截断续传场景：如果字段已有内容，智能合并而非覆盖
   * smartMerge 的 L1/L2/L3 策略会自动处理AI重新输出已有段落的情况
   * @param {string} field - 字段名（basicInfo/synopsis/characters/emotionPoints/plotLines）
   * @param {string} content - 段落完整内容
   */
  onSection(field, content) {
    console.log('[解析器-段落] 字段:', field, '内容长度:', content?.length, '是否锁定:', lockState.value[field])
    if (!field || !content) return
    /* 锁定的字段不允许AI覆盖 */
    if (lockState.value[field]) {
      console.log('[解析器-段落] 字段已锁定，跳过:', field)
      return
    }
    /* 过滤AI截断提示语（兜底：prompt已禁止，但AI偶尔不遵守） */
    const trimmed = content.trim()
      .replace(/[（(]由于[^）)]*截断[^）)]*[）)][。.]?/g, '')
      .replace(/[（(]如需继续[^）)]*[）)][。.]?/g, '')
      .replace(/由于内容长度限制[^。]*[。.]/g, '')
      .replace(/如需继续[，,]?请告知[。.]?/g, '')
      .replace(/[（(]接上文[）)][。.]?/g, '')
      .trim()
    if (!trimmed) return
    /* 纯标点符号不算有效内容，跳过（防止AI提及section标记时误触发） */
    if (!hasSubstantialContent(trimmed)) return

    if (isFullRegeneration) {
      /* 完整重新生成：直接替换，不合并旧内容 */
      scriptData.value[field] = trimmed
    } else {
      /* 截断续传：智能合并已有内容
       * smartMerge内置多层去重策略，能处理AI重新输出整段的情况 */
      const existing = (scriptData.value[field] || '').trim()
      scriptData.value[field] = existing ? smartMerge(existing, trimmed) : trimmed
    }
    /* 高亮动画：短暂标记正在填充的字段 */
    aiFillingField.value = field
    setTimeout(() => { aiFillingField.value = '' }, 1500)
  },

  /**
   * 单集完成回调：填充到分集列表对应位置
   * 截断续传场景：如果该集已有内容，智能合并
   * @param {number} episodeNum - 集数（从1开始）
   * @param {string} title - 集标题
   * @param {string} content - 集内容
   */
  onEpisode(episodeNum, title, content) {
    console.log('[解析器-剧集] 集数:', episodeNum, '标题:', title, '内容长度:', content?.length)
    if (episodeNum <= 0) return
    const idx = episodeNum - 1
    /* 锁定的剧集不允许AI覆盖 */
    if (episodeLockState.value[idx]) {
      console.log('[解析器-剧集] 第', episodeNum, '集已锁定，跳过')
      return
    }

    /* 清理标题中的markdown标记（如**），清理后为空则留空 */
    const cleanTitle = (title || '').replace(/\*\*/g, '').trim()
    /* 清理内容中AI硬加的"内容正文："前缀 */
    const newContent = (content || '').replace(/内容正文[：:]\s*/g, '').trim()

    if (isFullRegeneration) {
      /* 完整重新生成：直接替换，不合并旧内容 */
      while (scriptData.value.episodes.length <= idx) {
        scriptData.value.episodes.push({ title: '', content: '', scriptContent: '', scriptStatus: 0, scriptLocked: 0 })
      }
      scriptData.value.episodes[idx] = {
        title: cleanTitle,
        content: newContent,
      }
    } else {
      /* 截断续传：智能合并已有内容 */
      while (scriptData.value.episodes.length <= idx) {
        scriptData.value.episodes.push({ title: '', content: '', scriptContent: '', scriptStatus: 0, scriptLocked: 0 })
      }
      const existingContent = (scriptData.value.episodes[idx].content || '').trim()
      /* 标题：有新标题就用新的，否则保留已有的 */
      if (cleanTitle) {
        scriptData.value.episodes[idx].title = cleanTitle
      }
      /* 内容合并：如果已有内容，使用smartMerge进行智能去重合并 */
      if (existingContent && newContent) {
        scriptData.value.episodes[idx].content = smartMerge(existingContent, newContent)
      } else if (newContent) {
        scriptData.value.episodes[idx].content = newContent
      }
      /* 没有新内容则保留已有内容不动 */
    }

    /* 高亮动画 */
    aiFillingField.value = `episode_${episodeNum}`
    setTimeout(() => { aiFillingField.value = '' }, 1500)

    /* 触发自动保存到数据库（防抖1.5秒后批量保存，获取 ep.id） */
    debounceSaveEpisodes(idx)
  },

  /**
   * 标题区域回调（AI输出的标题候选列表）
   * AI会返回10个标题，自动提取第1个填入input
   * 支持格式：1.《xxx》/ 1、《xxx》/ 1. xxx / 《xxx》（取第一行含书名号的）
   */
  onTitle(content) {
    console.log('[解析器-标题] 收到标题内容，长度:', content?.length, '是否锁定:', lockState.value.title)
    if (!content) return
    /* 纯标点符号不算有效标题内容，跳过（防止AI提及"【标题】、"时误清空所有字段） */
    if (!hasSubstantialContent(content)) {
      console.log('[解析器-标题] 内容无实质内容，跳过')
      return
    }

    /* 检测到AI从头输出【标题：】，标记为完整重新生成
     * 清空未锁定的字段，后续 onSection/onEpisode 会直接替换而非合并 */
    console.log('[解析器-标题] 检测到标题标记，标记为完整重新生成，清空未锁定字段')
    isFullRegeneration = true
    if (!lockState.value.basicInfo) scriptData.value.basicInfo = ''
    if (!lockState.value.synopsis) scriptData.value.synopsis = ''
    if (!lockState.value.characters) scriptData.value.characters = ''
    if (!lockState.value.emotionPoints) scriptData.value.emotionPoints = ''
    if (!lockState.value.plotLines) scriptData.value.plotLines = ''
    /* 清空未锁定的剧集 */
    scriptData.value.episodes = scriptData.value.episodes.map((ep, i) => {
      if (episodeLockState.value[i]) return ep
      return { title: '', content: '', scriptContent: ep.scriptContent || '', scriptStatus: ep.scriptStatus || 0, scriptLocked: ep.scriptLocked || 0 }
    })

    /* 标题锁定时不覆盖 */
    if (lockState.value.title) return

    const lines = content.split('\n').map(l => l.trim()).filter(Boolean)
    let firstTitle = ''

    for (const line of lines) {
      /* 优先匹配书名号《xxx》 */
      const bookMatch = line.match(/《([^》]+)》/)
      if (bookMatch) {
        firstTitle = bookMatch[1]
        break
      }
      /* 兜底：匹配序号开头的行，取序号后面的文本 */
      const numMatch = line.match(/^\d+[.、．)\s]+(.+)/)
      if (numMatch) {
        firstTitle = numMatch[1].trim()
        break
      }
    }

    scriptData.value.title = firstTitle || lines[0] || ''
    aiFillingField.value = 'title'
    setTimeout(() => { aiFillingField.value = '' }, 1500)
  },
})

/* 流式回调配置，传给 AiChat → useAiChat */
const streamCallbacks = {
  onStreamStart: (userMessage) => {
    /* 检测用户消息是否包含"重新"等关键词，预判为覆盖模式
     * 安全：即使误判，只要AI没输出【】段落标记，解析器不会触发回调，不会覆盖任何内容 */
    const msg = (userMessage || '').trim()
    isFullRegeneration = /重新|重写|换一[个份版]|再写|全部重/.test(msg)
    console.log('[流式开始] 用户消息:', msg, '是否完整重新生成:', isFullRegeneration)
    resetParser()
  },
  onDelta: (text) => {
    console.log('[流式Delta] 收到内容片段:', text)
    feedDelta(text)
  },
  onComplete: () => {
    console.log('[流式完成] 调用flush')
    flush()
  },
}

/* 数据是否已加载完成（防止初始赋值触发保存） */
const isDataLoaded = ref(false)

/* ========================================
 * 自动保存：防抖工具
 * ======================================== */
let scriptSaveTimer = null
let episodeSaveTimer = null

/* 记录有变动的剧本字段（Set去重） */
const dirtyScriptFields = new Set()

/* 剧本字段名 → 接口字段名的映射 */
const scriptFieldMap = {
  title: 'title',
  basicInfo: 'basic_info',
  synopsis: 'synopsis',
  characters: 'characters',
  emotionPoints: 'emotion_points',
  plotLines: 'plot_lines',
}

/** 防抖保存剧本字段（只保存变动的字段） */
const debounceSaveScript = (field) => {
  if (field) dirtyScriptFields.add(field)
  if (scriptSaveTimer) clearTimeout(scriptSaveTimer)
  scriptSaveTimer = setTimeout(() => saveScriptFields(), 1000)
}

/* 记录有变动的分集索引（Set去重） */
const dirtyEpisodeIndexes = new Set()

/** 防抖保存分集大纲（只保存变动的集） */
const debounceSaveEpisodes = (index) => {
  if (index !== undefined) dirtyEpisodeIndexes.add(index)
  if (episodeSaveTimer) clearTimeout(episodeSaveTimer)
  episodeSaveTimer = setTimeout(() => saveEpisodes(), 1500)
}

/** 保存剧本字段到后端（只传变动的字段） */
const saveScriptFields = async () => {
  if (dirtyScriptFields.size === 0) return
  const fields = [...dirtyScriptFields]
  dirtyScriptFields.clear()
  try {
    const payload = {}
    for (const field of fields) {
      payload[scriptFieldMap[field]] = (scriptData.value[field] || '').trim()
    }
    await put(`/api/script/${scriptId}`, payload)
  } catch (e) {
    console.error('自动保存剧本失败:', e)
  }
}

/** 批量保存分集大纲（只保存有变动的集） */
const saveEpisodes = async () => {
  if (dirtyEpisodeIndexes.size === 0) return
  /* 取出脏索引并清空，避免重复保存 */
  const indexes = [...dirtyEpisodeIndexes]
  dirtyEpisodeIndexes.clear()
  try {
    const episodes = indexes.map(i => ({
      episodeNumber: i + 1,
      title: (scriptData.value.episodes[i]?.title || '').trim(),
      content: (scriptData.value.episodes[i]?.content || '').trim(),
    }))
    const res = await post('/api/script-episode/batch-save', {
      scriptId,
      episodes,
    })
    /* 更新前端 episodes 的 id（后端返回 [{episodeNumber, id}]） */
    if (res.code === 200 && Array.isArray(res.data)) {
      for (const saved of res.data) {
        const idx = saved.episodeNumber - 1
        if (scriptData.value.episodes[idx]) {
          scriptData.value.episodes[idx].id = saved.id
        }
      }
    }
  } catch (e) {
    console.error('自动保存分集大纲失败:', e)
  }
}

/* 左右面板开关状态 */
const leftPanelOpen = ref(true)
const rightPanelOpen = ref(true)

/* 参数编辑弹窗显示状态 */
const paramsModalVisible = ref(false)
const previewModalVisible = ref(false)

/* 用户原始创意描述（从DB加载，传给ParamsModal用于重写时编辑） */
const userIdea = ref('')

/* 结构化角色卡片数据 */
const characterCards = ref([])

/* API基础地址 */
const API_BASE = useRuntimeConfig().public.apiBase

/** 加载结构化角色数据 */
const loadCharacterCards = async () => {
  try {
    const res = await get(`/api/script/${scriptId}/characters`)
    if (res.code === 200 && Array.isArray(res.data)) {
      characterCards.value = res.data
    }
  } catch (e) {
    console.error('加载角色卡片失败:', e)
  }
}

/** 从人物介绍文本解析角色 */
const handleParseCharacters = async () => {
  const text = scriptData.value.characters
  if (!text || !text.trim()) return

  try {
    const res = await post(`/api/script/${scriptId}/characters/parse`, { text })
    if (res.code === 200 && Array.isArray(res.data)) {
      characterCards.value = res.data
      showToast('角色解析成功', 'success')
    } else {
      showToast(res.message || '角色解析失败', 'error')
    }
  } catch (e) {
    console.error('解析角色失败:', e)
    showToast('角色解析失败，请重试', 'error')
  }
}

/** 保存结构化角色数据（防抖） */
let characterSaveTimer = null
const handleSaveCharacters = (data) => {
  if (characterSaveTimer) clearTimeout(characterSaveTimer)
  characterSaveTimer = setTimeout(async () => {
    try {
      const characters = (data || characterCards.value).map(c => ({
        roleType: c.roleType || 'other',
        name: c.name || '',
        gender: c.gender || '',
        age: c.age || '',
        personality: c.personality || [],
        appearance: c.appearance || [],
        relationship: c.relationship || '',
        background: c.background || '',
        avatar: c.avatar || '',
        avatarPrompt: c.avatarPrompt || '',
      }))
      const res = await post(`/api/script/${scriptId}/characters`, { characters })
      if (res.code === 200 && Array.isArray(res.data)) {
        characterCards.value = res.data
      }
    } catch (e) {
      console.error('保存角色失败:', e)
    }
  }, 1000)
}

/* 剧本参数 */
const scriptParams = ref({
  episodes: 80,
  duration: 2,
  gender: '男频',
  aspectRatio: '9:16',
  artStyle: '日系动漫',
  genres: [],
})

const CONTINUE_ONLY_PATTERNS = [
  /^继续(?:写|生成|创作|输出)?(?:吧|一下)?$/u,
  /^接着(?:写|生成|创作|输出)?(?:吧|一下)?$/u,
  /^往下(?:写|生成|创作|输出|继续)?(?:吧|一下)?$/u,
]

const hasValue = value => Boolean(value && String(value).trim())

const isContinueOnlyMessage = (message = '') => {
  const text = String(message || '').trim()
  return CONTINUE_ONLY_PATTERNS.some(pattern => pattern.test(text))
}

const isEpisodeContentTruncated = (episode) => {
  const content = (episode?.content || '').trim()
  if (!content) return false
  const endChar = content.charAt(content.length - 1)
  const normalEndings = ['。', '！', '？', '…', '"', '"', '」', '）', ')', '.', '!', '?']
  return !normalEndings.includes(endChar) || content.length < 150
}

const resolveContinueMessage = (message = '') => {
  const text = String(message || '').trim()
  if (!isContinueOnlyMessage(text)) return text

  const data = scriptData.value
  const validEpisodes = (data.episodes || []).filter(ep => hasValue(ep.title) || hasValue(ep.content))
  const totalEpisodes = Number(scriptParams.value.episodes) || validEpisodes.length
  const lastEpisode = validEpisodes[validEpisodes.length - 1]

  if (!hasValue(data.title)) {
    return '请继续生成剧本，并从【标题：】开始输出。严格按照标题、基本信息、剧情梗概、人物介绍、信息流情绪点、剧情线、分集剧情大纲的顺序继续完成。'
  }
  if (!hasValue(data.basicInfo)) {
    return '当前【标题：】已生成，其余结构化内容仍为空。请保持已生成标题不变，并从【一、基本信息：】开始继续生成，随后按既定顺序继续输出后续模块。'
  }
  if (!hasValue(data.synopsis)) {
    return '请保持已生成标题和基本信息不变，并从【二、剧情梗概：】开始继续生成，随后按既定顺序继续输出后续模块。'
  }
  if (!hasValue(data.characters)) {
    return '请保持前面已生成的标题、基本信息和剧情梗概不变，并从【三、人物介绍：】开始继续生成，随后按既定顺序继续输出后续模块。'
  }
  if (!hasValue(data.emotionPoints)) {
    return '请保持前面已生成的内容不变，并从【四、信息流情绪点：】开始继续生成，随后按既定顺序继续输出后续模块。'
  }
  if (!hasValue(data.plotLines)) {
    return '请保持前面已生成的内容不变，并从【五、剧情线：】开始继续生成，随后按既定顺序继续输出【六、分集剧情大纲：】。'
  }
  if (lastEpisode && isEpisodeContentTruncated(lastEpisode)) {
    return `请保持前面已生成的内容不变，并先输出【六、分集剧情大纲：】标记，完整补全第${validEpisodes.length}集，再继续后续集数。`
  }
  if (validEpisodes.length === 0) {
    return '请保持前面已生成的内容不变，并从【六、分集剧情大纲：】开始继续生成。'
  }
  if (totalEpisodes > validEpisodes.length) {
    return `请保持前面已生成的内容不变，并从【六、分集剧情大纲：】开始继续生成。当前应从第${validEpisodes.length + 1}集开始往后输出。`
  }

  return text
}

/**
 * 轻量参数保存（台词占比、字数上限、场景上限、角色上限、时长）
 * 直接更新DB对应字段，不发起新AI对话
 */
const handleLightSave = async (params) => {
  try {
    await put(`/api/script/${scriptId}`, {
      total_episodes: params.episodes,
      duration: params.duration,
      gender: params.gender,
      aspect_ratio: params.aspectRatio,
      style: params.artStyle,
      max_roles: params.maxRoles,
      max_scenes: params.maxScenes,
      max_words: params.maxWords,
      dialogue_ratio: params.dialogueRatio,
    })
    /* 同步画风/比例到 scriptData + 分镜tab（联动） */
    scriptData.value.style = params.artStyle
    scriptData.value.aspect_ratio = params.aspectRatio
    if (scriptContentRef.value?.setStoryboardSettings) {
      scriptContentRef.value.setStoryboardSettings(params.artStyle, params.aspectRatio)
    }
  } catch (e) {
    console.error('保存轻量参数失败:', e)
  }
}

/**
 * 核心参数重写（集数、受众、题材变化）
 * 调用后端 rewrite 接口 → 清空前端数据 → 发起新AI会话
 */
const handleRewrite = async ({ params, userIdea: newUserIdea, genreIds, customGenres }) => {
  try {
    /* 1. 调用后端重写接口（清空内容+删除剧集+删除聊天记录+更新参数） */
    await post(`/api/script/${scriptId}/rewrite`, {
      totalEpisodes: params.episodes,
      duration: params.duration,
      gender: params.gender,
      aspectRatio: params.aspectRatio,
      artStyle: params.artStyle,
      maxRoles: params.maxRoles,
      maxScenes: params.maxScenes,
      maxWords: params.maxWords,
      dialogueRatio: params.dialogueRatio,
      genreIds,
      customGenres,
      userIdea: newUserIdea,
    })

    /* 2. 清空前端数据，保留3个空剧集，保留画风/比例设置 */
    scriptData.value = {
      title: '',
      basicInfo: '',
      synopsis: '',
      characters: '',
      emotionPoints: '',
      plotLines: '',
      style: params.artStyle,
      aspect_ratio: params.aspectRatio,
      episodes: [
        { title: '', content: '', scriptContent: '', scriptStatus: 0, scriptLocked: 0 },
        { title: '', content: '', scriptContent: '', scriptStatus: 0, scriptLocked: 0 },
        { title: '', content: '', scriptContent: '', scriptStatus: 0, scriptLocked: 0 },
      ],
    }
    /* 同步画风/比例到分镜tab */
    if (scriptContentRef.value?.setStoryboardSettings) {
      scriptContentRef.value.setStoryboardSettings(params.artStyle, params.aspectRatio)
    }

    /* 3. 解锁所有字段 */
    lockState.value = {
      title: 0,
      basicInfo: 0,
      synopsis: 0,
      characters: 0,
      emotionPoints: 0,
      plotLines: 0,
    }
    episodeLockState.value = []

    /* 4. 清空封面图数据 */
    scriptCover.value = ''
    scriptCoverPrompt.value = ''

    /* 5. 更新本地 userIdea */
    userIdea.value = newUserIdea

    /* 6. 清空AI聊天历史，发起新会话 */
    aiChatRef.value?.clearHistory()
    if (newUserIdea) {
      setTimeout(() => {
        aiChatRef.value?.sendMessage(newUserIdea)
      }, 300)
    }
  } catch (e) {
    console.error('重写剧本失败:', e)
    showToast('重写失败，请稍后重试', 'error')
  }
}

/* 子组件 ref */
const scriptContentRef = ref(null)

/* 剧本内容数据 */
const scriptData = ref({
  title: '',
  basicInfo: '',
  synopsis: '',
  characters: '',
  emotionPoints: '',
  plotLines: '',
  episodes: [
    { title: '', content: '', scriptContent: '', scriptStatus: 0, scriptLocked: 0 },
    { title: '', content: '', scriptContent: '', scriptStatus: 0, scriptLocked: 0 },
    { title: '', content: '', scriptContent: '', scriptStatus: 0, scriptLocked: 0 },
  ],
})

/* 封面图相关数据（传给CoverGenerator组件） */
const scriptCover = ref('')
const scriptCoverPrompt = ref('')

/* ========================================
 * 监听数据变化，触发自动保存
 * ======================================== */

/* 监听基本字段变化，精确记录变动的字段名（trim后比较，两头空格不触发保存） */
const scriptWatchFields = ['title', 'basicInfo', 'synopsis', 'characters', 'emotionPoints', 'plotLines']
watch(
  () => scriptWatchFields.map(f => scriptData.value[f]?.trim()),
  (newVal, oldVal) => {
    if (!isDataLoaded.value || !oldVal) return
    for (let i = 0; i < newVal.length; i++) {
      if (newVal[i] !== oldVal[i]) {
        debounceSaveScript(scriptWatchFields[i])
      }
    }
  },
)

/* 逐集监听变化，精确记录变动的集号（trim后比较） */
watch(
  () => scriptData.value.episodes.map(ep => `${ep.title?.trim()}|${ep.content?.trim()}`),
  (newVal, oldVal) => {
    if (!isDataLoaded.value || !oldVal) return
    for (let i = 0; i < newVal.length; i++) {
      if (newVal[i] !== oldVal?.[i]) {
        debounceSaveEpisodes(i)
      }
    }
  },
)

/* 联动同步：分镜tab修改画风/比例后 scriptData.style/aspect_ratio 会变，同步到 scriptParams 供左侧卡片和弹窗使用 */
watch(
  () => [scriptData.value.style, scriptData.value.aspect_ratio],
  ([newStyle, newRatio]) => {
    if (!isDataLoaded.value) return
    if (newStyle && newStyle !== scriptParams.value.artStyle) {
      scriptParams.value.artStyle = newStyle
    }
    if (newRatio && newRatio !== scriptParams.value.aspectRatio) {
      scriptParams.value.aspectRatio = newRatio
    }
  },
)

/* ========================================
 * 页面初始化
 * ======================================== */

/* 未登录拦截：跳转到 /write 并弹出登录弹窗 */
onMounted(async () => {
  window.addEventListener('beforeunload', onBeforeUnload)
  userStore.init()
  if (!userStore.isLoggedIn) {
    navigateTo('/write')
    nextTick(() => {
      userStore.openLoginModal()
    })
    return
  }

  /* 不再监听 beforeunload，允许用户自由刷新/关闭页面
   * 后端会继续完成当前集的生成 */

  /* 加载剧本数据 */
  try {
    const res = await get(`/api/script/${scriptId}`)
    if (res.code === 200 && res.data) {
      const data = res.data
      scriptData.value.title = data.title || ''
      scriptData.value.basicInfo = data.basic_info || ''
      scriptData.value.synopsis = data.synopsis || ''
      scriptData.value.characters = data.characters || ''
      scriptData.value.emotionPoints = data.emotion_points || ''
      scriptData.value.plotLines = data.plot_lines || ''

      /* 恢复锁定状态 */
      lockState.value.title = data.title_locked || 0
      lockState.value.basicInfo = data.basic_info_locked || 0
      lockState.value.synopsis = data.synopsis_locked || 0
      lockState.value.characters = data.characters_locked || 0
      lockState.value.emotionPoints = data.emotion_points_locked || 0
      lockState.value.plotLines = data.plot_lines_locked || 0

      /* 恢复分集大纲（后端有数据则用后端的，否则保留默认3集空白） */
      if (data.episodes && data.episodes.length > 0) {
        scriptData.value.episodes = data.episodes.map(ep => ({
          id: ep.id || '',
          title: ep.title || '',
          content: ep.content || '',
          scriptContent: ep.scriptContent || '',
          scriptStatus: ep.scriptStatus || 0,
          scriptLocked: ep.scriptLocked || 0,
          storyboardData: null,
          storyboardStatus: 0,
          storyboardTotalShots: 0,
          videoStoryboardData: null,
          videoStoryboardStatus: 0,
          videoStoryboardTotalShots: 0,
        }))
        /* 恢复剧集锁定状态 */
        episodeLockState.value = data.episodes.map(ep => ep.isLocked || 0)
      }

      /* 恢复参数：从独立字段读取，题材从后端 genre_names 恢复 */
      scriptParams.value = {
        episodes: data.total_episodes || 80,
        duration: Number(data.duration) || 2,
        gender: data.gender || '男频',
        aspectRatio: data.aspect_ratio || '9:16',
        artStyle: data.style || '日系动漫',
        maxRoles: data.max_roles || 10,
        maxScenes: data.max_scenes || 3,
        maxWords: data.max_words || 1200,
        dialogueRatio: data.dialogue_ratio || 50,
        genres: Array.isArray(data.genre_names) ? data.genre_names : [],
      }

      /* 恢复封面图数据 */
      scriptCover.value = data.cover || ''
      scriptCoverPrompt.value = data.cover_prompt || ''

      /* 恢复画风/比例（从 script 表全局读取） */
      scriptData.value.style = data.style || '日系动漫'
      scriptData.value.aspect_ratio = data.aspect_ratio || '16:9'

      /* 恢复用户原始创意描述 */
      userIdea.value = data.user_idea || ''
    }
  } catch (e) {
    console.error('加载剧本失败:', e)
  }

  /* 加载结构化角色数据 */
  await loadCharacterCards()

  /* 数据加载完成，开启自动保存 */
  nextTick(() => {
    isDataLoaded.value = true
  })

  /* 批量加载所有集的分镜数据（首帧+视频，1个请求） */
  loadAllStoryboards()

  /* 从localStorage读取初始消息（创建页跳转过来的场景），读完即删 */
  const initMessage = localStorage.getItem('script_init_message')
  if (initMessage) {
    localStorage.removeItem('script_init_message')
    setTimeout(() => {
      aiChatRef.value?.sendMessage(initMessage)
    }, 500)
  }
})

/* 页面卸载时清除定时器，并立即保存未提交的变更 */
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  if (scriptSaveTimer) {
    clearTimeout(scriptSaveTimer)
    saveScriptFields()
  }
  if (episodeSaveTimer) {
    clearTimeout(episodeSaveTimer)
    saveEpisodes()
  }
  if (characterSaveTimer) {
    clearTimeout(characterSaveTimer)
  }
  /* 被动停止（刷新/返回）：不中断请求，让后端继续完成当前集
   * 只停止前端的批量生成循环，避免用户返回后前端还在继续生成下一集 */
  if (isBatchGenerating.value) {
    isBatchGenerating.value = false
  }
})

/* AI生成中离开拦截 */
let pendingNavigation = null
let isConfirmedLeave = false
const leaveConfirmVisible = ref(false)
const leaveConfirmTitle = ref('正在生成中')
const leaveConfirmDesc = ref('')

const isAnyGenerating = computed(() => {
  if (aiChatRef.value?.isStreaming) return 'chat'
  if (generatingStoryboardIndex.value !== -1) return 'storyboard'
  if (generatingVideoStoryboardIndex.value !== -1) return 'video_storyboard'
  if (generatingEpisodeIndex.value !== -1) return 'script'
  if (isBatchGenerating.value) return 'batch'
  return ''
})

const LEAVE_CONFIRM_MAP = {
  chat: { title: '剧本助手正在生成中', desc: '当前剧本助手正在努力生成内容，离开页面将<strong>中断生成</strong>，已生成的部分会保留。<br>确定要离开吗？' },
  storyboard: { title: '首帧分镜正在生成中', desc: '当前正在生成首帧分镜，离开页面将<strong>中断生成</strong>，已完成的镜头会保留。<br>确定要离开吗？' },
  video_storyboard: { title: '视频分镜正在生成中', desc: '当前正在生成视频分镜，离开页面将<strong>中断生成</strong>，已完成的镜头会保留。<br>确定要离开吗？' },
  script: { title: '剧本正在生成中', desc: '当前正在生成剧本台本，离开页面将<strong>中断生成</strong>，已生成的部分会保留。<br>确定要离开吗？' },
  batch: { title: '批量生成进行中', desc: '当前正在批量生成，离开页面将<strong>中断后续生成</strong>，已生成的部分会保留。<br>确定要离开吗？' },
}

onBeforeRouteLeave((to) => {
  if (isConfirmedLeave) return true
  const generating = isAnyGenerating.value
  if (generating) {
    const conf = LEAVE_CONFIRM_MAP[generating] || LEAVE_CONFIRM_MAP.chat
    leaveConfirmTitle.value = conf.title
    leaveConfirmDesc.value = conf.desc
    pendingNavigation = to.fullPath
    leaveConfirmVisible.value = true
    return false
  }
})

const confirmLeave = () => {
  leaveConfirmVisible.value = false
  isConfirmedLeave = true
  if (isBatchGenerating.value) isBatchGenerating.value = false
  const target = pendingNavigation
  pendingNavigation = null
  if (target) navigateTo(target)
}

const cancelLeave = () => {
  leaveConfirmVisible.value = false
  pendingNavigation = null
}

/* 浏览器关闭/刷新拦截 */
const onBeforeUnload = (e) => {
  if (isAnyGenerating.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}

/* ========================================
 * 台本生成：SSE流式调用
 * ======================================== */

/** 当前正在生成台本的剧集索引（-1表示无） */
const generatingEpisodeIndex = ref(-1)

/** 批量生成状态 */
const isBatchGenerating = ref(false)
const batchProgress = ref({ current: 0, total: 0 })

/** 剧本生成的 AbortController（用于中断请求） */
let scriptAbortController = null
let isScriptManualAbort = false // 标记是否是用户主动停止

/**
 * 核心SSE生成函数：生成单集台本（纯逻辑，不含UI提示）
 * @param {number} index - 剧集索引（从0开始）
 * @returns {Promise<boolean>} 是否生成成功
 */
const generateSingleEpisode = async (index) => {
  const ep = scriptData.value.episodes[index]
  if (!ep || !ep.id || !ep.content?.trim()) return false

  /* 标记生成中 */
  generatingEpisodeIndex.value = index
  ep.scriptStatus = 1
  ep.scriptContent = ''

  /* 创建新的 AbortController */
  scriptAbortController = new AbortController()
  isScriptManualAbort = false // 重置标志位

  try {
    const token = localStorage.getItem('token')
    const config = useRuntimeConfig()
    const baseURL = config.public.apiBase || ''
    const url = `${baseURL}/api/script-episode/${ep.id}/generate-script`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal: scriptAbortController.signal,
    })

    if (await checkSseResponse(response)) return

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      showToast(errData.message || `请求失败: ${response.status}`, 'error')
      ep.scriptStatus = 3
      return false
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const text = decoder.decode(value, { stream: true })
      const lines = text.split('\n')

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const data = JSON.parse(line.slice(6))

          if (data.content) {
            ep.scriptContent += data.content
          }
          if (data.done) {
            ep.scriptStatus = 2
          }
          if (data.error) {
            console.error('台本生成错误:', data.error)
            ep.scriptStatus = 3
          }
        } catch (_) { /* 忽略解析错误 */ }
      }
    }

    /* 流结束后确保状态正确 */
    if (ep.scriptStatus === 1) {
      ep.scriptStatus = ep.scriptContent ? 2 : 3
    }
    return ep.scriptStatus === 2
  } catch (err) {
    /* 只有主动中断才处理 AbortError，被动中断（页面刷新）让后端继续完成 */
    if (err.name === 'AbortError' && isScriptManualAbort) {
      console.log(`第${index + 1}集台本生成已中断`)
      ep.scriptStatus = 0 // 重置为未生成状态
      return false
    }
    console.error(`第${index + 1}集台本生成失败:`, err)
    ep.scriptStatus = 3
    return false
  } finally {
    generatingEpisodeIndex.value = -1
    scriptAbortController = null
    isScriptManualAbort = false
  }
}

/**
 * 生成单集台本（用户手动点击，含UI校验提示）
 * @param {number} index - 剧集索引（从0开始）
 */
const handleGenerateEpisodeScript = async (index) => {
  if (!ensureAccess({ actionName: '剧本生成' })) return
  const ep = scriptData.value.episodes[index]
  if (!ep) return
  if (!ep.content || !ep.content.trim()) {
    showToast('该集大纲内容为空，请先生成大纲', 'warning')
    return
  }
  if (!ep.id) {
    showToast('该集尚未保存，请先保存大纲', 'warning')
    return
  }
  /* 先检查模型配置，通过后才开始生成（避免清空数据后发现未配置） */
  if (!(await checkModelConfig('script_gen'))) return
  const success = await generateSingleEpisode(index)
  if (success) {
    showToast(`第${index + 1}集剧本生成完成`, 'success')
  } else if (ep.scriptStatus === 3) {
    showToast('台本生成失败，请稍后重试', 'error')
  }
}

/**
 * 停止台本生成（主动停止：用户点击停止按钮）
 * @param {number} index - 剧集索引
 */
const handleStopGenerateScript = async (index) => {
  const ep = scriptData.value.episodes[index]
  if (!ep?.id) return

  /* 同时监听生成状态——若弹窗打开期间生成已完成，自动关闭弹窗 */
  let stopWatcher = null
  const confirmed = await new Promise((resolve) => {
    /* 先用 showConfirm 打开弹窗（内部会设置 confirmDialog） */
    showConfirm({
      icon: 'lucide:pause-circle',
      title: '确定暂停生成吗？',
      description: '暂停后，已生成的内容将保留。<br/>请确认是否暂停。',
      confirmText: '确认暂停',
      confirmType: 'danger',
    }).then(resolve)

    /* 监听生成状态：若当前集已完成（generatingEpisodeIndex 不再是 index），自动关闭弹窗 */
    stopWatcher = watch(generatingEpisodeIndex, (newIdx) => {
      if (newIdx !== index) {
        /* 生成已结束，强制关闭弹窗并 resolve(false) */
        confirmDialog.visible = false
        resolve(false)
      }
    })
  })

  /* 无论结果如何，都停掉 watcher */
  stopWatcher?.()

  if (!confirmed) return

  /* 二次确认：弹窗关闭后再检查一遍，若生成已结束则不发暂停请求 */
  if (generatingEpisodeIndex.value !== index) return

  /* 主动停止：中断 fetch 请求，触发后端停止 AI 生成 */
  if (scriptAbortController) {
    isScriptManualAbort = true // 标记为主动中断
    scriptAbortController.abort()
    scriptAbortController = null
  }

  try {
    await post(`/api/script-episode/${ep.id}/stop-generate`)
  } catch (e) {
    console.error('停止生成失败:', e)
  }
}

/**
 * 保存台本编辑内容（防抖）
 */
let scriptContentSaveTimer = null
const debounceSaveScriptContent = (index) => {
  if (scriptContentSaveTimer) clearTimeout(scriptContentSaveTimer)
  scriptContentSaveTimer = setTimeout(async () => {
    const ep = scriptData.value.episodes[index]
    if (!ep?.id) return
    try {
      await put(`/api/script-episode/${ep.id}/script`, {
        scriptContent: ep.scriptContent,
      })
    } catch (e) {
      console.error('保存台本失败:', e)
    }
  }, 1500)
}

/* ========================================
 * 批量操作：锁定/解锁/清空/生成
 * ======================================== */

/* 通用确认弹窗状态 */
const confirmDialog = reactive({
  visible: false,
  icon: 'lucide:alert-triangle',
  title: '确认操作',
  description: '',
  confirmText: '确认',
  confirmType: 'danger',
  onConfirm: null,
})

/**
 * 显示确认弹窗（Promise化，方便 await）
 * @returns {Promise<boolean>} 用户是否确认
 */
const showConfirm = ({ icon = 'lucide:alert-triangle', title = '确认操作', description = '', confirmText = '确认', confirmType = 'danger' } = {}) => {
  return new Promise((resolve) => {
    let resolved = false
    confirmDialog.icon = icon
    confirmDialog.title = title
    confirmDialog.description = description
    confirmDialog.confirmText = confirmText
    confirmDialog.confirmType = confirmType
    confirmDialog.onConfirm = () => {
      if (resolved) return
      resolved = true
      confirmDialog.visible = false
      resolve(true)
    }
    confirmDialog.visible = true
    /* 监听弹窗关闭（取消/点击遮罩）→ resolve(false) */
    const stop = watch(() => confirmDialog.visible, (val) => {
      if (!val && !resolved) {
        resolved = true
        stop()
        resolve(false)
      }
    })
  })
}

/** 批量锁定：根据当前tab锁定所有剧集 */
const handleBatchLock = async (tabKey) => {
  if (tabKey === 'outline') {
    /* 大纲锁定：记录之前未锁定的索引，用于失败回滚 */
    const prevUnlocked = scriptData.value.episodes
      .map((_, i) => i)
      .filter(i => !episodeLockState.value[i])
    prevUnlocked.forEach(i => { episodeLockState.value[i] = 1 })
    try {
      await post('/api/script-episode/batch-save', {
        scriptId,
        episodes: scriptData.value.episodes.map((ep, i) => ({
          episodeNumber: i + 1,
          title: (ep.title || '').trim(),
          content: (ep.content || '').trim(),
          isLocked: 1,
        })),
      })
      showToast('已全部锁定', 'success')
    } catch (e) {
      console.error('批量锁定失败:', e)
      prevUnlocked.forEach(i => { episodeLockState.value[i] = 0 })
      showToast('批量锁定失败', 'error')
    }
  } else if (tabKey === 'storyboard') {
    showToast('分镜锁定功能开发中', 'warning')
  }
}

/** 批量解锁：根据当前tab解锁所有剧集 */
const handleBatchUnlock = async (tabKey) => {
  if (tabKey === 'outline') {
    const prev = [...episodeLockState.value]
    episodeLockState.value = episodeLockState.value.map(() => 0)
    try {
      await post('/api/script-episode/batch-save', {
        scriptId,
        episodes: scriptData.value.episodes.map((ep, i) => ({
          episodeNumber: i + 1,
          title: (ep.title || '').trim(),
          content: (ep.content || '').trim(),
          isLocked: 0,
        })),
      })
      showToast('已全部解锁', 'success')
    } catch (e) {
      console.error('批量解锁失败:', e)
      episodeLockState.value = prev
      showToast('批量解锁失败', 'error')
    }
  } else if (tabKey === 'storyboard') {
    showToast('分镜解锁功能开发中', 'warning')
  }
}

/** 剧本-批量继续生成：从第一个未生成的集开始，依次往后生成 */
const handleBatchScriptContinue = async () => {
  if (!ensureAccess({ actionName: '剧本生成' })) return
  /* 有正在生成的集时，禁止操作 */
  if (generatingEpisodeIndex.value >= 0) {
    showToast(`第${generatingEpisodeIndex.value + 1}集正在生成中，无法继续生成`, 'warning')
    return
  }
  /* 筛选需要生成的集：无剧本内容且有大纲且有id */
  const pendingIndexes = scriptData.value.episodes
    .map((ep, i) => ({ ep, i }))
    .filter(({ ep }) => !ep.scriptContent?.trim() && ep.content?.trim() && ep.id)
    .map(({ i }) => i)

  if (pendingIndexes.length === 0) {
    showToast('没有需要生成的剧集（请先补充大纲）', 'warning')
    return
  }

  isBatchGenerating.value = true
  batchProgress.value = { current: 0, total: pendingIndexes.length }
  let stopped = false

  for (let i = 0; i < pendingIndexes.length; i++) {
    /* 每次循环前检查是否被用户中断 */
    if (!isBatchGenerating.value) {
      stopped = true
      break
    }
    batchProgress.value.current = i + 1
    await generateSingleEpisode(pendingIndexes[i])
  }

  isBatchGenerating.value = false
  batchProgress.value = { current: 0, total: 0 }
  if (!stopped) {
    showToast('批量生成完成', 'success')
  }
}

/** 剧本-批量清空 */
const handleBatchScriptClear = async () => {
  /* 有正在生成的集时，禁止操作 */
  if (generatingEpisodeIndex.value >= 0) {
    showToast(`第${generatingEpisodeIndex.value + 1}集正在生成中，无法批量清空`, 'warning')
    return
  }
  /* 检查是否有可清空的内容 */
  const hasClearable = scriptData.value.episodes.some(ep => ep.id && ep.scriptContent)
  if (!hasClearable) {
    showToast('没有可清空的剧本内容', 'warning')
    return
  }
  const confirmed = await showConfirm({
    icon: 'lucide:trash-2',
    title: '批量清空',
    description: '确认清空所有剧本内容？<br/>清空后不可恢复。',
    confirmText: '确认清空',
  })
  if (!confirmed) return

  try {
    const promises = scriptData.value.episodes
      .filter(ep => ep.id && ep.scriptContent)
      .map(ep => put(`/api/script-episode/${ep.id}/script`, { scriptContent: '' }))
    await Promise.all(promises)
    /* 前端同步清空剧本内容 */
    scriptData.value.episodes.forEach(ep => {
      ep.scriptContent = ''
      ep.scriptStatus = 0
    })
    showToast('已批量清空剧本内容', 'success')
  } catch (e) {
    console.error('批量清空剧本失败:', e)
    showToast('批量清空失败', 'error')
  }
}

/** 停止批量生成（当前集生成完后停止，不中断当前集） */
const handleStopBatchGenerate = () => {
  isBatchGenerating.value = false
  const currentIdx = generatingEpisodeIndex.value
  if (currentIdx >= 0) {
    showToast(`将在第${currentIdx + 1}集生成完成后停止`, 'warning')
  } else {
    showToast('已停止批量生成', 'warning')
  }
}

/** 剧本-批量重新生成：从第一集开始重新生成，已有剧本时二次确认 */
const handleBatchScriptRegenerate = async () => {
  if (!ensureAccess({ actionName: '剧本生成' })) return
  /* 有正在生成的集时，禁止操作 */
  if (generatingEpisodeIndex.value >= 0) {
    showToast(`第${generatingEpisodeIndex.value + 1}集正在生成中，无法重新生成`, 'warning')
    return
  }
  /* 先检查模型配置，通过后才进入确认和生成流程 */
  if (!(await checkModelConfig('script_gen'))) return
  /* 检查是否有已生成的剧本 */
  const hasGenerated = scriptData.value.episodes.some(ep => ep.scriptStatus === 2)

  /* 如果有已生成的剧本，弹出二次确认 */
  if (hasGenerated) {
    const confirmed = await showConfirm({
      icon: 'lucide:refresh-cw',
      title: '重新生成',
      description: '点击确认后，将从第一集开始重新生成剧本。',
      confirmText: '确认重新生成',
    })
    if (!confirmed) return
  }

  /* 先清空已有的剧本内容 */
  const clearPromises = scriptData.value.episodes
    .filter(ep => ep.id && ep.scriptContent)
    .map(ep => put(`/api/script-episode/${ep.id}/script`, { scriptContent: '' }))

  if (clearPromises.length > 0) {
    try {
      await Promise.all(clearPromises)
      scriptData.value.episodes.forEach(ep => {
        ep.scriptContent = ''
        ep.scriptStatus = 0
      })
    } catch (e) {
      console.error('清空剧本失败:', e)
      showToast('清空剧本失败，请重试', 'error')
      return
    }
  }

  /* 筛选可生成的集：有大纲且有id */
  const targetIndexes = scriptData.value.episodes
    .map((ep, i) => ({ ep, i }))
    .filter(({ ep }) => ep.content?.trim() && ep.id)
    .map(({ i }) => i)

  if (targetIndexes.length === 0) {
    showToast('没有可生成的剧集（请先编写大纲）', 'warning')
    return
  }

  isBatchGenerating.value = true
  batchProgress.value = { current: 0, total: targetIndexes.length }
  let stopped = false

  for (let i = 0; i < targetIndexes.length; i++) {
    if (!isBatchGenerating.value) {
      stopped = true
      break
    }
    batchProgress.value.current = i + 1
    await generateSingleEpisode(targetIndexes[i])
  }

  isBatchGenerating.value = false
  batchProgress.value = { current: 0, total: 0 }
  if (!stopped) {
    showToast('批量重新生成完成', 'success')
  }
}

/* ========================================
 * 分镜生成：SSE流式调用
 * ======================================== */

/** 当前正在生成分镜的剧集索引（-1表示无） */
const generatingStoryboardIndex = ref(-1)

/** 分镜生成 AbortController（用于前端主动中断 fetch） */
let storyboardAbortController = null
let isStoryboardManualAbort = false // 标记是否是用户主动停止

/** 视频分镜生成 AbortController */
let videoStoryboardAbortController = null
let isVideoStoryboardManualAbort = false // 标记是否是用户主动停止

/**
 * 核心SSE生成函数：生成单集分镜
 * @param {number} index - 剧集索引
 * @returns {Promise<boolean>} 是否生成成功
 */
const generateSingleStoryboard = async (index) => {
  const ep = scriptData.value.episodes[index]
  if (!ep || !ep.id || !ep.scriptContent?.trim()) return false

  /* 标记生成中 */
  generatingStoryboardIndex.value = index
  ep.storyboardStatus = 1
  ep.storyboardData = null

  /* 用于增量拼装的临时结构 */
  let structureData = null
  const completedScenes = []

  try {
    const token = localStorage.getItem('token')
    const config = useRuntimeConfig()
    const baseURL = config.public.apiBase || ''
    const url = `${baseURL}/api/script-episode/${ep.id}/generate-storyboard`

    /* 创建 AbortController，但只在主动停止时使用 */
    storyboardAbortController = new AbortController()
    isStoryboardManualAbort = false // 重置标志位

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
      // 不传 signal，让刷新/返回时静默断开，后端继续生成
    })

    if (await checkSseResponse(response)) return

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      showToast(errData.message || `请求失败: ${response.status}`, 'error')
      ep.storyboardStatus = 3
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      /* 主动停止时中断读取 */
      if (isStoryboardManualAbort) {
        reader.cancel()
        break
      }

      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      /* 保留最后一行（可能不完整） */
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6)
        if (payload === '[DONE]') continue
        try {
          const data = JSON.parse(payload)

          if (data.type === 'structure') {
            /* 收到场景结构规划 */
            structureData = data.data
          } else if (data.type === 'scene' && data.scene_data) {
            /* 收到单场景镜头数据，增量渲染 */
            completedScenes.push(data.scene_data)
            ep.storyboardData = {
              episode_info: {
                episode_number: ep.episodeNumber || 1,
                title: ep.title || '',
                total_shots: completedScenes.reduce((sum, s) => sum + (s.shots?.length || 0), 0),
              },
              characters: structureData?.characters || [],
              scenes: completedScenes,
            }
            ep.storyboardTotalShots = ep.storyboardData.episode_info.total_shots
          } else if (data.type === 'error') {
            console.warn('分镜场景错误:', data.message)
          }
        } catch (_) { /* 忽略解析错误 */ }
      }
    }

    /* 流结束，判断最终状态 */
    if (completedScenes.length > 0) {
      ep.storyboardStatus = 2
    } else {
      ep.storyboardStatus = 3
    }

    return ep.storyboardStatus === 2
  } catch (err) {
    /* 只有主动中断才处理 AbortError，被动中断（页面刷新）让后端继续完成 */
    if (err.name === 'AbortError' && isStoryboardManualAbort) {
      console.log(`第${index + 1}集分镜生成已中断`)
      /* 如果已有部分场景数据，保留它 */
      if (completedScenes.length > 0) {
        ep.storyboardStatus = 3
      }
      return false
    }
    console.error(`第${index + 1}集分镜生成失败:`, err)
    ep.storyboardStatus = 3
    return false
  } finally {
    storyboardAbortController = null
    isStoryboardManualAbort = false
    generatingStoryboardIndex.value = -1
  }
}

/**
 * 生成单集分镜（用户手动点击）
 * @param {object} payload - { index }
 */
const handleGenerateStoryboard = async ({ index }) => {
  if (!ensureAccess({ actionName: '首帧分镜生成' })) return
  const ep = scriptData.value.episodes[index]
  if (!ep) return
  if (!ep.scriptContent || !ep.scriptContent.trim()) {
    showToast('该集台本内容为空，请先生成台本', 'warning')
    return
  }
  if (!ep.id) {
    showToast('该集尚未保存', 'warning')
    return
  }
  /* 先检查模型配置，通过后才进入确认和生成流程 */
  if (!(await checkModelConfig('script_gen'))) return

  /* 如果该集已有视频分镜数据，弹窗确认 */
  const hasVideoData = ep.videoStoryboardStatus === 2
    && ep.videoStoryboardData
    && (ep.videoStoryboardData.shots?.length > 0)
  if (hasVideoData) {
    const confirmed = await showConfirm({
      icon: 'lucide:alert-triangle',
      title: '重新生成将清除视频分镜',
      description: '该集已生成视频分镜数据，重新生成首帧后镜头数量可能变化，<strong>已有的视频分镜将被清除</strong>。确定继续吗？',
      confirmText: '继续生成',
      confirmType: 'danger',
    })
    if (!confirmed) return
    /* 清除本地视频分镜状态 */
    ep.videoStoryboardStatus = 0
    ep.videoStoryboardData = null
    ep.videoStoryboardTotalShots = 0
  }

  const success = await generateSingleStoryboard(index)
  if (success) {
    showToast(`第${index + 1}集分镜生成完成`, 'success')
  } else if (ep.storyboardStatus === 3) {
    showToast('分镜生成失败，请稍后重试', 'error')
  }
}

/**
 * 停止分镜生成（主动停止：用户点击停止按钮）
 * @param {number} index - 剧集索引
 */
const handleStopGenerateStoryboard = async (index) => {
  const ep = scriptData.value.episodes[index]
  if (!ep?.id) return

  /* 同时监听生成状态——若弹窗打开期间生成已完成，自动关闭弹窗 */
  let stopWatcher = null
  const confirmed = await new Promise((resolve) => {
    showConfirm({
      icon: 'lucide:pause-circle',
      title: '确定暂停首帧分镜生成吗？',
      description: '暂停后，已生成的分镜内容将保留。<br/>建议耐心等待完成。',
      confirmText: '确认暂停',
      confirmType: 'danger',
    }).then(resolve)

    /* 监听生成状态：若当前集已完成，自动关闭弹窗 */
    stopWatcher = watch(generatingStoryboardIndex, (newIdx) => {
      if (newIdx !== index) {
        confirmDialog.visible = false
        resolve(false)
      }
    })
  })

  /* 无论结果如何，都停掉 watcher */
  stopWatcher?.()

  if (!confirmed) return

  /* 二次校验：生成已结束则不发暂停请求 */
  if (generatingStoryboardIndex.value !== index) return

  /* 主动停止：设置标志位，让前端读取循环中断 */
  isStoryboardManualAbort = true

  try {
    await post(`/api/script-episode/${ep.id}/stop-storyboard`)
  } catch (e) {
    console.error('停止分镜生成失败:', e)
  }
}

/**
 * 批量加载所有集的分镜数据（首帧+视频，1个请求替代 N*2 个）
 */
const loadAllStoryboards = async () => {
  try {
    const res = await get(`/api/script/${scriptId}/storyboards`)
    if (res.code === 200 && res.data?.episodes) {
      /* 按 episodeId 建索引 */
      const map = {}
      for (const item of res.data.episodes) {
        map[item.episodeId] = item
      }
      /* 遍历前端 episodes，填充分镜数据 */
      for (const ep of scriptData.value.episodes) {
        const data = map[ep.id]
        if (!data) continue
        ep.storyboardData = data.storyboardData
        ep.storyboardStatus = data.status
        ep.storyboardTotalShots = data.totalShots || 0
        ep.videoStoryboardData = data.videoStoryboardData
        ep.videoStoryboardStatus = data.videoStatus
        ep.videoStoryboardTotalShots = data.videoTotalShots || 0
      }
    }
  } catch (e) {
    console.error('批量加载分镜数据失败:', e)
  }
  /* 画风/比例从 scriptData 全局恢复到子组件 */
  if (scriptContentRef.value) {
    scriptContentRef.value.setStoryboardSettings(
      scriptData.value.style || '日系动漫',
      scriptData.value.aspect_ratio || '16:9'
    )
  }
}

/** 分镜-批量继续生成 */
const handleBatchStoryboardContinue = () => {
  showToast('分镜批量生成功能开发中', 'warning')
}

/** 分镜-批量清空 */
const handleBatchStoryboardClear = () => {
  showToast('分镜批量清空功能开发中', 'warning')
}

/** 分镜-批量重新生成 */
const handleBatchStoryboardRegenerate = () => {
  showToast('分镜批量生成功能开发中', 'warning')
}

/**
 * 保存分镜数据（画风/比例切换时子组件触发）
 * @param {{ episodeId, storyboardData }} payload
 */
/* 预览下载 */
const handlePreviewDownload = () => {
  previewModalVisible.value = true
}

/* 发布出售 */
const handlePublish = () => {
  showToast('发布出售功能开发中', 'warning')
}

const handleSaveStoryboard = async ({ episodeId, storyboardData }) => {
  if (!episodeId) return
  try {
    await put(`/api/script-episode/${episodeId}/storyboard`, {
      storyboardData,
    })
  } catch (e) {
    console.error('保存分镜失败', e)
    showToast('分镜保存失败', 'error')
  }
}

/* ========================================
 * 视频分镜生成：SSE流式调用
 * ======================================== */

/** 当前正在生成视频分镜的剧集索引（-1表示无） */
const generatingVideoStoryboardIndex = ref(-1)

/**
 * 核心SSE生成函数：生成单集视频分镜（分批接收）
 * 后端分批调用AI，每批完成后SSE推送结构化数据，前端逐步渲染
 * @param {number} index - 剧集索引
 * @returns {Promise<boolean>} 是否生成成功
 */
const generateSingleVideoStoryboard = async (index) => {
  const ep = scriptData.value.episodes[index]
  if (!ep || !ep.id) return false
  /* 必须有静态分镜数据 */
  if (!ep.storyboardData || !ep.storyboardData.scenes || ep.storyboardStatus !== 2) return false

  /* 标记生成中 */
  generatingVideoStoryboardIndex.value = index
  ep.videoStoryboardStatus = 1
  /* 初始化视频分镜数据结构（逐步填充shots） */
  ep.videoStoryboardData = { episode_info: { episode_number: index + 1, total_shots: 0 }, shots: [] }

  try {
    const token = localStorage.getItem('token')
    const config = useRuntimeConfig()
    const baseURL = config.public.apiBase || ''
    const url = `${baseURL}/api/script-episode/${ep.id}/generate-video-storyboard`

    /* 创建 AbortController，但只在主动停止时使用 */
    videoStoryboardAbortController = new AbortController()
    isVideoStoryboardManualAbort = false // 重置标志位

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      // 不传 signal，让刷新/返回时静默断开，后端继续生成
    })

    if (await checkSseResponse(response)) return

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      showToast(errData.message || `请求失败: ${response.status}`, 'error')
      ep.videoStoryboardStatus = 3
      return false
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      /* 主动停止时中断读取 */
      if (isVideoStoryboardManualAbort) {
        reader.cancel()
        break
      }

      const { done, value } = await reader.read()
      if (done) break

      const text = decoder.decode(value, { stream: true })
      const lines = text.split('\n')

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6)
        if (payload === '[DONE]') continue
        try {
          const data = JSON.parse(payload)

          if (data.type === 'batch' && data.shots) {
            /* 收到一批视频分镜数据，追加到shots */
            ep.videoStoryboardData.shots.push(...data.shots)
            ep.videoStoryboardData.episode_info.total_shots = ep.videoStoryboardData.shots.length
            ep.videoStoryboardTotalShots = ep.videoStoryboardData.shots.length
            /* 通知子组件自动切换对应镜头到视频tab */
            if (scriptContentRef.value?.switchShotsToVideo) {
              scriptContentRef.value.switchShotsToVideo(index, data.shots)
            }
          }

          if (data.type === 'progress') {
            /* 进度信息，可用于UI展示 */
            console.log(`[视频分镜] 第${index + 1}集 - 正在生成镜头 ${data.shotsRange} (${data.batch}/${data.totalBatches})`)
          }

          if (data.type === 'error') {
            console.error('视频分镜生成错误:', data.message)
          }
        } catch (_) { /* 忽略解析错误 */ }
      }
    }

    /* 流结束，判断结果 */
    if (ep.videoStoryboardData.shots.length > 0) {
      ep.videoStoryboardStatus = 2
    } else {
      ep.videoStoryboardStatus = 3
    }

    return ep.videoStoryboardStatus === 2
  } catch (err) {
    /* 主动中断时，有部分数据则标记为已完成（部分），否则标记失败 */
    if (isVideoStoryboardManualAbort) {
      console.log(`第${index + 1}集视频分镜生成已中断`)
      if (ep.videoStoryboardData?.shots?.length > 0) {
        ep.videoStoryboardStatus = 2
      }
      return false
    }
    console.error(`第${index + 1}集视频分镜生成失败:`, err)
    ep.videoStoryboardStatus = 3
    return false
  } finally {
    videoStoryboardAbortController = null
    isVideoStoryboardManualAbort = false
    generatingVideoStoryboardIndex.value = -1
  }
}

/**
 * 生成单集视频分镜（用户手动点击）
 * @param {object} payload - { index }
 */
const handleGenerateVideoStoryboard = async ({ index }) => {
  if (!ensureAccess({ actionName: '视频分镜生成' })) return
  const ep = scriptData.value.episodes[index]
  if (!ep) return
  if (!ep.storyboardData || !ep.storyboardData.scenes || ep.storyboardStatus !== 2) {
    showToast('请先生成静态分镜，再生成视频分镜', 'warning')
    return
  }
  if (!ep.id) {
    showToast('该集尚未保存', 'warning')
    return
  }
  /* 先检查模型配置，通过后才开始生成 */
  if (!(await checkModelConfig('script_gen'))) return
  /* 立即将当前集所有镜头卡片切换到视频tab */
  if (scriptContentRef.value?.switchAllShotsToVideo) {
    scriptContentRef.value.switchAllShotsToVideo(index)
  }
  const success = await generateSingleVideoStoryboard(index)
  if (success) {
    showToast(`第${index + 1}集视频分镜生成完成`, 'success')
  } else if (ep.videoStoryboardStatus === 3) {
    showToast('视频分镜生成失败，请稍后重试', 'error')
  }
}

/**
 * 停止视频分镜生成（主动停止：用户点击停止按钮）
 * @param {number} index - 剧集索引
 */
const handleStopGenerateVideoStoryboard = async (index) => {
  const ep = scriptData.value.episodes[index]
  if (!ep?.id) return

  /* 同时监听生成状态——若弹窗打开期间生成已完成，自动关闭弹窗 */
  let stopWatcher = null
  const confirmed = await new Promise((resolve) => {
    showConfirm({
      icon: 'lucide:pause-circle',
      title: '确定暂停视频分镜生成吗？',
      description: '暂停后，已生成的视频分镜内容将保留。<br/>建议等待完成。',
      confirmText: '确认暂停',
      confirmType: 'danger',
    }).then(resolve)

    /* 监听生成状态：若当前集已完成，自动关闭弹窗 */
    stopWatcher = watch(generatingVideoStoryboardIndex, (newIdx) => {
      if (newIdx !== index) {
        confirmDialog.visible = false
        resolve(false)
      }
    })
  })

  /* 无论结果如何，都停掉 watcher */
  stopWatcher?.()

  if (!confirmed) return

  /* 二次校验：生成已结束则不发暂停请求 */
  if (generatingVideoStoryboardIndex.value !== index) return

  /* 主动停止：设置标志位，让前端读取循环中断 */
  isVideoStoryboardManualAbort = true

  try {
    await post(`/api/script-episode/${ep.id}/stop-video-storyboard`)
  } catch (e) {
    console.error('停止视频分镜生成失败:', e)
  }
}

/** 视频分镜-批量继续生成 */
const handleBatchVideoStoryboardContinue = () => {
  showToast('视频分镜批量生成功能开发中', 'warning')
}

/** 视频分镜-批量清空 */
const handleBatchVideoStoryboardClear = () => {
  showToast('视频分镜批量清空功能开发中', 'warning')
}

/** 视频分镜-批量重新生成 */
const handleBatchVideoStoryboardRegenerate = () => {
  showToast('视频分镜批量生成功能开发中', 'warning')
}

/** 保存视频分镜数据 */
const handleSaveVideoStoryboard = async ({ episodeId, videoStoryboardData }) => {
  if (!episodeId) return
  try {
    await put(`/api/script-episode/${episodeId}/video-storyboard`, {
      videoStoryboardData,
    })
  } catch (e) {
    console.error('保存视频分镜失败', e)
    showToast('视频分镜保存失败', 'error')
  }
}

/* AI生成内容回调（预留：快捷按钮单独生成某段落） */
const handleGenerate = ({ type, data }) => {
  /* 后续优化：快捷按钮触发时只解析对应段落 */
}
</script>

<style scoped>
/* ========================================
 * 写作详情页 - 三栏布局
 * ======================================== */
.write-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  flex:1;
}

/* Teleport注入到Topbar的标题 */
.write-editor__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

/* 三栏主体 */
.write-editor__body {
  display: flex;
  gap: 20px;
  align-items: stretch;
  flex: 1;
  min-height: 0;
}

/* 左侧参数面板 */
.write-editor__left {
  width: 240px;
  flex-shrink: 0;
  transition: width 0.3s ease;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 左侧可滚动区域 */
.write-editor__left-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.write-editor__left-scroll::-webkit-scrollbar {
  display: none;
}

/* 左侧底部操作按钮 */
.write-editor__left-actions {
  flex-shrink: 0;
  display: flex;
  gap: 8px;
  padding: 12px 0;
  border-top: 1px solid var(--color-border-light);
}

.write-editor__action-btn {
  flex: 1;
  height: 34px;
  border: none;
  border-radius: var(--radius);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s, opacity 0.2s;
}

.write-editor__action-btn--preview {
  background: var(--color-bg-white);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.write-editor__action-btn--preview:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-text-light);
}

.write-editor__action-btn--publish {
  background: var(--color-primary);
  color: #fff;
}

.write-editor__action-btn--publish:hover {
  opacity: 0.85;
}

.write-editor__left--collapsed {
  width: 48px;
}

/* 收起后的展开按钮（仅右侧使用） */
.write-editor__expand-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  background: var(--color-bg);
  cursor: pointer;
  font-size: 10px;
  color: var(--color-text-light);
  transition: background 0.2s, color 0.2s;
}

.write-editor__expand-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-primary);
}

.write-editor__expand-btn--right {
  border-left: 1px solid var(--color-border-light);
}

/* 中间内容区 */
.write-editor__center {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
}

.write-editor__center::-webkit-scrollbar {
  display: none;
}

.write-editor__center--right-closed {
  padding-right: 32px;
}

.write-editor__center--both-closed {
  max-width: 900px;
  margin: 0 auto;
  padding-left: 32px;
  padding-right: 32px;
}

/* 右侧AI聊天区 */
.write-editor__right {
  width: 360px;
  flex-shrink: 0;
  border-left: 1px solid var(--color-border-light);
  display: flex;
  flex-direction: column;
}

/* AiChat卡片样式 */
.write-editor__right :deep(.ai-chat) {
  background: var(--color-bg-white);
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
}


/* 响应式 */
@media (max-width: 1200px) {
  .write-editor__left { width: 200px; }
  .write-editor__right { width: 300px; }
  .params-display__grid {
    grid-template-columns: 1fr 1fr;
    gap: 3px 16px;
  }
}

@media (max-width: 900px) {
  .write-editor__expand-btn {
    width: 100%;
    height: 24px;
  }
}
</style>
