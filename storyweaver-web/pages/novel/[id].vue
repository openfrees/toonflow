<template>
  <div class="write-editor">
    <ClientOnly>
      <Teleport to="#topbar-left-slot">
        <h2 class="write-editor__title">{{ novelData.title || '未命名小说项目' }}</h2>
      </Teleport>
    </ClientOnly>

    <!-- 三栏主体 -->
    <div class="write-editor__body">
      <!-- 左侧：封面生成 + 参数只读展示 + 底部操作按钮 -->
      <div class="write-editor__left">
        <div class="write-editor__left-scroll">
          <WriteCoverGenerator
            :script-id="novelId"
            :initial-cover="novelCover"
            :initial-prompt="novelCoverPrompt"
            type="novel"
          />
          <NovelParamsDisplay
            :params="novelParams"
            @edit="paramsModalVisible = true"
          />
        </div>
        <div class="write-editor__left-actions">
          <button class="write-editor__action-btn write-editor__action-btn--preview" @click="handlePreviewDownload">
            预览下载
          </button>
          <button class="write-editor__action-btn write-editor__action-btn--publish" @click="chapterListVisible = true">
            <Icon name="lucide:list" size="14" />
            章节列表
          </button>
        </div>

        <!-- 章节列表面板（小说原文章节，覆盖左侧区域） -->
        <Transition name="chapter-panel">
          <div v-if="chapterListVisible" class="chapter-panel">
            <div class="chapter-panel__header">
              <h3 class="chapter-panel__title">
                <Icon name="lucide:book-open" size="16" />
                小说章节
              </h3>
              <span class="chapter-panel__count">{{ chapterCoveredCount }}/{{ novelChapters.length }}</span>
            </div>

            <div class="chapter-panel__list">
              <div
                v-for="ch in novelChapters"
                :key="ch.id"
                class="chapter-panel__item"
              >
                <span class="chapter-panel__item-index">{{ ch.index }}</span>
                <div class="chapter-panel__item-info">
                  <span class="chapter-panel__item-title">{{ ch.title }}</span>
                  <span class="chapter-panel__item-meta">{{ ch.wordCount.toLocaleString() }} 字</span>
                </div>
                <Icon
                  v-if="ch.isSelected"
                  name="lucide:circle-check"
                  size="14"
                  class="chapter-panel__item-selected"
                />
                <Icon
                  v-else
                  name="lucide:circle"
                  size="14"
                  class="chapter-panel__item-unselected"
                />
              </div>

              <div v-if="!novelChapters.length" class="chapter-panel__empty">
                <Icon name="lucide:inbox" size="32" />
                <p>暂无章节数据</p>
              </div>
            </div>

            <div class="chapter-panel__footer">
              <button class="chapter-panel__close-btn" @click="chapterListVisible = false">
                <Icon name="lucide:x" size="14" />
                关闭章节列表
              </button>
            </div>
          </div>
        </Transition>
      </div>

      <!-- 中间：内容编辑区 -->
      <div
        class="write-editor__center"
        :class="{
          'write-editor__center--right-closed': !rightPanelOpen,
        }"
      >
        <NovelContent
          ref="novelContentRef"
          v-model="novelData"
          :character-cards="characterCards"
          :assets="novelAssets"
          :ai-filling-field="aiFillingField"
          :generating-episode-index="generatingEpisodeIndex"
          :generating-storyboard-index="generatingStoryboardIndex"
          :generating-video-storyboard-index="generatingVideoStoryboardIndex"
          :is-batch-generating="isBatchGenerating"
          :batch-progress="batchProgress"
          :script-id="novelId"
          :api-base="API_BASE"
          @generate-episode-script="handleGenerateEpisodeScript"
          @stop-generate-script="handleStopGenerateScript"
          @save-script-content="debounceSaveScriptContent"
          @batch-script-continue="handleBatchScriptContinue"
          @batch-script-clear="handleBatchScriptClear"
          @batch-script-regenerate="handleBatchScriptRegenerate"
          @stop-batch-generate="handleStopBatchGenerate"
          @generate-storyboard="handleGenerateStoryboard"
          @stop-generate-storyboard="handleStopGenerateStoryboard"
          @generate-video-storyboard="handleGenerateVideoStoryboard"
          @stop-generate-video-storyboard="handleStopGenerateVideoStoryboard"
          @save-storyboard="handleSaveStoryboard"
          @save-video-storyboard="handleSaveVideoStoryboard"
          @parse-characters="handleParseCharacters"
          @save-characters="handleSaveCharacters"
          @update:assets="handleUpdateAssets"
          @update:character-cards="characterCards = $event"
        />
      </div>

      <!-- 右侧：AI聊天区 -->
      <div v-show="rightPanelOpen" class="write-editor__right">
        <NovelAiChat
          ref="aiChatRef"
          :novel-id="novelId"
          :total-chapters="novelData.basicInfo.totalChapters || 0"
          :has-storyline="!!novelData.storyline && novelData.storyline.trim().length > 0"
          :episodes="novelData.episodes"
          :total-episodes="novelParams.episodes || 80"
          @refresh="handleAgentRefresh"
        />
      </div>
      <div v-show="!rightPanelOpen" class="write-editor__expand-btn write-editor__expand-btn--right" @click="rightPanelOpen = true">
        <span>◀</span>
      </div>
    </div>

    <!-- 参数编辑弹窗（小说专属，字段：集数/时长/受众/题材/画风/比例） -->
    <NovelParamsModal
      :visible="paramsModalVisible"
      v-model="novelParams"
      @close="paramsModalVisible = false"
      @save="handleParamsSave"
    />

    <!-- 预览弹窗 -->
    <WritePreviewModal
      :visible="previewModalVisible"
      :script-data="novelData"
      :script-id="novelId"
      preview-mode="novel"
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
 * 小说编辑 - 写作详情页
 * 从 write/[id].vue 改造：引用 NovelContent + NovelAiChat
 * 数据结构：去掉 synopsis/emotionPoints，plotLines→storyline，basicInfo→对象
 * 保留完整的剧本生成/分镜/视频分镜逻辑
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

const novelId = route.params.id

const aiChatRef = ref(null)
const aiFillingField = ref('')
let isFullRegeneration = false

/* 数据是否已加载完成 */
const isDataLoaded = ref(false)

/* 自动保存 */
let scriptSaveTimer = null
let episodeSaveTimer = null
const dirtyScriptFields = new Set()
const dirtyEpisodeIndexes = new Set()

const novelFieldMap = {
  title: 'title',
  characters: 'characters',
  storyline: 'storyline',
}

const debounceSaveScript = (field) => {
  if (field) dirtyScriptFields.add(field)
  if (scriptSaveTimer) clearTimeout(scriptSaveTimer)
  scriptSaveTimer = setTimeout(() => saveScriptFields(), 1000)
}

const debounceSaveEpisodes = (index) => {
  if (index !== undefined) dirtyEpisodeIndexes.add(index)
  if (episodeSaveTimer) clearTimeout(episodeSaveTimer)
  episodeSaveTimer = setTimeout(() => saveEpisodes(), 1500)
}

const saveScriptFields = async () => {
  if (dirtyScriptFields.size === 0) return
  const fields = [...dirtyScriptFields]
  dirtyScriptFields.clear()
  try {
    const payload = {}
    for (const field of fields) {
      const val = novelData.value[field]
      payload[novelFieldMap[field] || field] = typeof val === 'string' ? val.trim() : val
    }
    await put(`/api/novel-project/${novelId}`, payload)
  } catch (e) {
    console.error('[自动保存] 剧本字段失败:', e)
  }
}

const saveEpisodes = async () => {
  if (dirtyEpisodeIndexes.size === 0) return
  const indexes = [...dirtyEpisodeIndexes]
  dirtyEpisodeIndexes.clear()
  try {
    const episodes = indexes.map(i => ({
      episodeNumber: i + 1,
      title: (novelData.value.episodes[i]?.title || '').trim(),
      content: (novelData.value.episodes[i]?.content || '').trim(),
    }))
    const res = await post(`/api/novel-project/${novelId}/episodes/batch-save`, { episodes })
    if (res?.code === 200 && Array.isArray(res.data)) {
      for (const saved of res.data) {
        const idx = saved.episodeNumber - 1
        if (novelData.value.episodes[idx]) {
          novelData.value.episodes[idx].id = saved.id
        }
      }
    }
  } catch (e) {
    console.error('[自动保存] 分集大纲失败:', e)
  }
}

/* 面板状态 */
const leftPanelOpen = ref(true)
const rightPanelOpen = ref(true)
const paramsModalVisible = ref(false)
const previewModalVisible = ref(false)
const chapterListVisible = ref(false)
const chapterCoveredCount = computed(() => novelChapters.value.filter(c => c.isSelected).length)
const userIdea = ref('')
const characterCards = ref([])
const novelAssets = ref({ characters: [], scenes: [] })
const API_BASE = useRuntimeConfig().public.apiBase

const handleParseCharacters = async () => {
  const text = novelData.value.characters
  if (!text || !text.trim()) return
  showToast('角色解析功能待后端开发', 'warning')
}

let characterSaveTimer = null
const handleSaveCharacters = (data) => {
  characterCards.value = [ ...data ]
  if (characterSaveTimer) clearTimeout(characterSaveTimer)
  characterSaveTimer = setTimeout(async () => {
    await saveAssets()
  }, 1000)
}

/* 资产管理 */
let assetSaveTimer = null
const handleUpdateAssets = (newAssets) => {
  novelAssets.value = newAssets
  if (assetSaveTimer) clearTimeout(assetSaveTimer)
  assetSaveTimer = setTimeout(() => saveAssets(), 1500)
}

const saveAssets = async () => {
  const token = localStorage.getItem('token')
  if (!token) return
  try {
    await $fetch(`${API_BASE}/api/novel-project/${novelId}/assets`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        characters: characterCards.value,
        scenes: novelAssets.value.scenes || [],
      },
    })
  } catch (err) {
    console.warn('[资产保存] 接口暂未实现，数据已在本地保留:', err.message)
  }
}

const loadAssets = async () => {
  const token = localStorage.getItem('token')
  if (!token) return
  try {
    const res = await $fetch(`${API_BASE}/api/novel-project/${novelId}/assets`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res?.code === 200 && res.data) {
      characterCards.value = res.data.characters || []
      novelAssets.value = { scenes: res.data.scenes || [] }
    }
  } catch (_) {
    /* 接口暂未实现或无数据，使用默认空数组 */
  }
}

/* 剧本参数 */
const novelParams = ref({
  episodes: 80,
  duration: 2,
  gender: '男频',
  genre: '',
  genres: [],
  artStyle: '日系动漫',
  aspectRatio: '9:16',
})

const handleParamsSave = async (params) => {
  try {
    await put(`/api/novel-project/${novelId}`, {
      total_episodes: params.episodes,
      duration: params.duration,
      gender: params.gender,
      genres: params.genres?.length ? params.genres : params.genre,
      art_style: params.artStyle,
      aspect_ratio: params.aspectRatio,
    })
    novelData.value.artStyle = params.artStyle
    novelData.value.aspectRatio = params.aspectRatio
    showToast('参数已保存', 'success')
  } catch (err) {
    console.error('[参数保存] 失败:', err)
    showToast('参数保存失败，请稍后重试', 'error')
  }
}

const novelContentRef = ref(null)

/* 小说原文章节列表（从后端 detail 接口获取） */
const novelChapters = ref([])

/* 小说编辑核心数据 */
const novelData = ref({
  title: '',
  basicInfo: {
    episodes: 80,
    duration: 2,
    gender: '男频',
    totalChapters: 0,
    totalWords: 0,
    genres: [],
  },
  characters: '',
  storyline: '',
  artStyle: '日系动漫',
  aspectRatio: '9:16',
  episodes: [],
})

/* 封面 */
const novelCover = ref('')
const novelCoverPrompt = ref('')

/* 监听数据变化 */
const novelWatchFields = ['title', 'characters', 'storyline']
watch(
  () => novelWatchFields.map(f => novelData.value[f]?.trim?.()),
  (newVal, oldVal) => {
    if (!isDataLoaded.value || !oldVal) return
    for (let i = 0; i < newVal.length; i++) {
      if (newVal[i] !== oldVal[i]) {
        debounceSaveScript(novelWatchFields[i])
      }
    }
  },
)

watch(
  () => novelData.value.episodes.map(ep => `${ep.title?.trim()}|${ep.content?.trim()}`),
  (newVal, oldVal) => {
    if (!isDataLoaded.value || !oldVal) return
    for (let i = 0; i < newVal.length; i++) {
      if (newVal[i] !== oldVal?.[i]) {
        debounceSaveEpisodes(i)
      }
    }
  },
)

/**
 * 从后端加载项目数据并填充到前端状态
 */
const loadProject = async () => {
  try {
    const res = await get(`/api/novel-project/${novelId}`)
    if (res?.code !== 200 || !res.data) {
      showToast('项目不存在或无权限', 'error')
      navigateTo('/write')
      return
    }
    const d = res.data

    novelData.value.title = d.title || ''
    novelData.value.characters = d.characters || ''
    novelData.value.basicInfo = {
      episodes: d.total_episodes || 80,
      duration: d.duration || 2,
      gender: d.gender || '男频',
      totalChapters: d.totalChapters || 0,
      totalWords: d.totalWords || 0,
      genres: d.genres || [],
    }

    /* 小说原文章节列表 */
    novelChapters.value = (d.chapters || []).map(c => ({
      id: c.id,
      index: c.chapter_index,
      title: c.chapter_title || `第${c.chapter_index}章`,
      wordCount: c.word_count || 0,
      isSelected: c.is_selected === 1,
    }))

    /* 故事线 */
    novelData.value.storyline = d.storyline?.content || ''
    novelData.value.artStyle = d.art_style || '日系动漫'
    novelData.value.aspectRatio = d.aspect_ratio || '9:16'
    /* 分集大纲 */
    if (d.episodes && d.episodes.length > 0) {
      novelData.value.episodes = d.episodes.map(ep => ({
        id: ep.id,
        title: ep.title || '',
        content: ep.outline || '',
        episodeDuration: ep.episodeDuration || d.duration || 0,
        outlineDetail: ep.outlineDetail || null,
        chapterRange: ep.chapterRange || [],
        scriptContent: ep.scriptContent || '',
        scriptStatus: ep.scriptStatus || 0,
        scriptLocked: ep.scriptLocked || 0,
        storyboardData: ep.storyboardData || null,
        storyboardStatus: ep.storyboardStatus || 0,
        storyboardTotalShots: ep.storyboardTotalShots || 0,
        videoStoryboardData: ep.videoStoryboardData || null,
        videoStoryboardStatus: ep.videoStoryboardStatus || 0,
        videoStoryboardTotalShots: ep.videoStoryboardTotalShots || 0,
      }))
    }

    /* 封面 */
    novelCover.value = d.cover || ''
    novelCoverPrompt.value = d.cover_prompt || ''

    /* 参数面板 */
    novelParams.value = {
      episodes: d.total_episodes || 80,
      duration: d.duration || 2,
      gender: d.gender || '男频',
      genre: Array.isArray(d.genres) ? d.genres.join('、') : '',
      genres: d.genres || [],
      artStyle: d.art_style || '日系动漫',
      aspectRatio: d.aspect_ratio || '9:16',
    }

  } catch (err) {
    showToast(err.message || '加载项目失败', 'error')
  }
}

/**
 * Agent 数据刷新回调（故事线/大纲保存后触发）
 */
const handleAgentRefresh = async (target) => {
  try {
    const res = await get(`/api/novel-project/${novelId}`)
    if (res?.code !== 200 || !res.data) return
    const d = res.data

    if (target === 'storyline') {
      novelData.value.storyline = d.storyline?.content || ''
    } else if (target === 'outline') {
      if (d.episodes && d.episodes.length > 0) {
        novelData.value.episodes = d.episodes.map(ep => ({
          id: ep.id,
          title: ep.title || '',
          content: ep.outline || '',
          episodeDuration: ep.episodeDuration || d.duration || 0,
          outlineDetail: ep.outlineDetail || null,
          chapterRange: ep.chapterRange || [],
          scriptContent: ep.scriptContent || '',
          scriptStatus: ep.scriptStatus || 0,
          scriptLocked: ep.scriptLocked || 0,
          storyboardData: ep.storyboardData || null,
          storyboardStatus: ep.storyboardStatus || 0,
          storyboardTotalShots: ep.storyboardTotalShots || 0,
          videoStoryboardData: ep.videoStoryboardData || null,
          videoStoryboardStatus: ep.videoStoryboardStatus || 0,
          videoStoryboardTotalShots: ep.videoStoryboardTotalShots || 0,
        }))
      }
      novelData.value.basicInfo.totalChapters = d.totalChapters || 0
      novelData.value.basicInfo.totalWords = d.totalWords || 0
      novelData.value.artStyle = d.art_style || novelData.value.artStyle || '日系动漫'
      novelData.value.aspectRatio = d.aspect_ratio || novelData.value.aspectRatio || '9:16'
    }
  } catch (_) { /* 刷新失败静默处理 */ }
}

watch(
  () => [novelData.value.artStyle, novelData.value.aspectRatio],
  ([artStyle, aspectRatio]) => {
    novelParams.value.artStyle = artStyle || '日系动漫'
    novelParams.value.aspectRatio = aspectRatio || '9:16'
  },
)

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
  chat: { title: '小说助手正在生成中', desc: '当前小说助手正在努力生成内容，离开页面将<strong>中断生成</strong>，已生成的部分会保留。<br>确定要离开吗？' },
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


/* 页面初始化 */
onMounted(async () => {
  window.addEventListener('beforeunload', onBeforeUnload)
  userStore.init()
  if (!userStore.isLoggedIn) {
    navigateTo('/write')
    nextTick(() => { userStore.openLoginModal() })
    return
  }

  await loadProject()
  await loadAssets()
  await loadAllStoryboards()
  nextTick(() => {
    isDataLoaded.value = true
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  if (scriptSaveTimer) { clearTimeout(scriptSaveTimer); saveScriptFields() }
  if (episodeSaveTimer) { clearTimeout(episodeSaveTimer); saveEpisodes() }
  if (characterSaveTimer) { clearTimeout(characterSaveTimer) }
  if (assetSaveTimer) { clearTimeout(assetSaveTimer); saveAssets() }
  if (isBatchGenerating.value) { isBatchGenerating.value = false }
})

/* ========================================
 * 台本生成（保留完整逻辑，后续复用）
 * ======================================== */

const generatingEpisodeIndex = ref(-1)
const isBatchGenerating = ref(false)
const batchProgress = ref({ current: 0, total: 0 })
let scriptAbortController = null
let isScriptManualAbort = false

const generateSingleEpisode = async (index) => {
  const ep = novelData.value.episodes[index]
  if (!ep || !ep.id || !ep.content?.trim()) return false
  generatingEpisodeIndex.value = index
  ep.scriptStatus = 1
  ep.scriptContent = ''
  scriptAbortController = new AbortController()
  isScriptManualAbort = false

  try {
    const token = localStorage.getItem('token')
    const url = `${API_BASE}/api/novel-episode/${ep.id}/generate-script`
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
            console.error('小说剧本生成错误:', data.error)
            ep.scriptStatus = 3
          }
        } catch (_) {}
      }
    }

    if (ep.scriptStatus === 1) {
      ep.scriptStatus = ep.scriptContent ? 2 : 3
    }
    return ep.scriptStatus === 2
  } catch (err) {
    if (err.name === 'AbortError' && isScriptManualAbort) {
      console.log(`第${index + 1}集小说剧本生成已中断`)
      ep.scriptStatus = 0
      return false
    }
    console.error(`第${index + 1}集小说剧本生成失败:`, err)
    ep.scriptStatus = 3
    return false
  } finally {
    generatingEpisodeIndex.value = -1
    scriptAbortController = null
    isScriptManualAbort = false
  }
}

const handleGenerateEpisodeScript = async (index) => {
  if (!ensureAccess({ actionName: '剧本生成' })) return
  const ep = novelData.value.episodes[index]
  if (!ep) return
  if (!ep.content || !ep.content.trim()) { showToast('该集大纲内容为空，请先生成大纲', 'warning'); return }
  if (!ep.id) { showToast('该集尚未保存，请先保存大纲', 'warning'); return }
  if (!(await checkModelConfig('script_gen'))) return
  const success = await generateSingleEpisode(index)
  if (success) {
    showToast(`第${index + 1}集剧本生成完成`, 'success')
  } else if (ep.scriptStatus === 3) {
    showToast('剧本生成失败，请稍后重试', 'error')
  }
}

const handleStopGenerateScript = async (index) => {
  const ep = novelData.value.episodes[index]
  if (!ep?.id) return
  if (scriptAbortController) {
    isScriptManualAbort = true
    scriptAbortController.abort()
  }
  try {
    await post(`/api/novel-episode/${ep.id}/stop-generate`)
  } catch (e) {
    console.error('停止小说剧本生成失败:', e)
  }
}

let scriptContentSaveTimer = null
const debounceSaveScriptContent = (index) => {
  if (scriptContentSaveTimer) clearTimeout(scriptContentSaveTimer)
  scriptContentSaveTimer = setTimeout(async () => {
    const ep = novelData.value.episodes[index]
    if (!ep?.id) return
    try {
      await put(`/api/novel-episode/${ep.id}/script`, {
        scriptContent: ep.scriptContent,
      })
    } catch (e) {
      console.error('保存小说台本失败:', e)
    }
  }, 1500)
}

/* 通用确认弹窗 */
const confirmDialog = reactive({
  visible: false, icon: 'lucide:alert-triangle', title: '确认操作',
  description: '', confirmText: '确认', confirmType: 'danger', onConfirm: null,
})

const showConfirm = ({ icon = 'lucide:alert-triangle', title = '确认操作', description = '', confirmText = '确认', confirmType = 'danger' } = {}) => {
  return new Promise((resolve) => {
    let resolved = false
    confirmDialog.icon = icon; confirmDialog.title = title; confirmDialog.description = description
    confirmDialog.confirmText = confirmText; confirmDialog.confirmType = confirmType
    confirmDialog.onConfirm = () => { if (resolved) return; resolved = true; confirmDialog.visible = false; resolve(true) }
    confirmDialog.visible = true
    const stop = watch(() => confirmDialog.visible, (val) => { if (!val && !resolved) { resolved = true; stop(); resolve(false) } })
  })
}

const handleBatchScriptContinue = async () => {
  if (!ensureAccess({ actionName: '剧本生成' })) return
  if (generatingEpisodeIndex.value >= 0) {
    showToast(`第${generatingEpisodeIndex.value + 1}集正在生成中，无法继续生成`, 'warning')
    return
  }
  if (!(await checkModelConfig('script_gen'))) return
  const pendingIndexes = novelData.value.episodes
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
    if (!isBatchGenerating.value) {
      stopped = true
      break
    }
    batchProgress.value.current = i + 1
    await generateSingleEpisode(pendingIndexes[i])
  }
  isBatchGenerating.value = false
  batchProgress.value = { current: 0, total: 0 }
  if (!stopped) showToast('批量生成完成', 'success')
}
const handleBatchScriptClear = async () => {
  if (generatingEpisodeIndex.value >= 0) {
    showToast(`第${generatingEpisodeIndex.value + 1}集正在生成中，无法批量清空`, 'warning')
    return
  }
  const hasClearable = novelData.value.episodes.some(ep => ep.id && ep.scriptContent)
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
    const promises = novelData.value.episodes
      .filter(ep => ep.id && ep.scriptContent)
      .map(ep => put(`/api/novel-episode/${ep.id}/script`, { scriptContent: '' }))
    await Promise.all(promises)
    novelData.value.episodes.forEach(ep => {
      ep.scriptContent = ''
      ep.scriptStatus = 0
    })
    showToast('已批量清空剧本内容', 'success')
  } catch (e) {
    console.error('批量清空小说剧本失败:', e)
    showToast('批量清空失败', 'error')
  }
}
const handleBatchScriptRegenerate = async () => {
  if (!ensureAccess({ actionName: '剧本生成' })) return
  if (generatingEpisodeIndex.value >= 0) {
    showToast(`第${generatingEpisodeIndex.value + 1}集正在生成中，无法重新生成`, 'warning')
    return
  }
  if (!(await checkModelConfig('script_gen'))) return
  const hasGenerated = novelData.value.episodes.some(ep => ep.scriptStatus === 2)
  if (hasGenerated) {
    const confirmed = await showConfirm({
      icon: 'lucide:refresh-cw',
      title: '重新生成',
      description: '点击确认后，将从第一集开始重新生成剧本。',
      confirmText: '确认重新生成',
    })
    if (!confirmed) return
  }

  const clearPromises = novelData.value.episodes
    .filter(ep => ep.id && ep.scriptContent)
    .map(ep => put(`/api/novel-episode/${ep.id}/script`, { scriptContent: '' }))

  if (clearPromises.length > 0) {
    try {
      await Promise.all(clearPromises)
      novelData.value.episodes.forEach(ep => {
        ep.scriptContent = ''
        ep.scriptStatus = 0
      })
    } catch (e) {
      console.error('清空小说剧本失败:', e)
      showToast('清空剧本失败，请重试', 'error')
      return
    }
  }

  const targetIndexes = novelData.value.episodes
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
  if (!stopped) showToast('批量重新生成完成', 'success')
}
const handleStopBatchGenerate = () => { isBatchGenerating.value = false }

/* ========================================
 * 分镜生成（保留骨架，后续复用）
 * ======================================== */

const generatingStoryboardIndex = ref(-1)
const generatingVideoStoryboardIndex = ref(-1)
let storyboardAbortController = null
let isStoryboardManualAbort = false
let videoStoryboardAbortController = null
let isVideoStoryboardManualAbort = false

const generateSingleStoryboard = async (index) => {
  const ep = novelData.value.episodes[index]
  if (!ep || !ep.id || !ep.scriptContent?.trim()) return false

  generatingStoryboardIndex.value = index
  ep.storyboardStatus = 1
  ep.storyboardData = null

  let structureData = null
  const completedScenes = []

  try {
    const token = localStorage.getItem('token')
    const url = `${API_BASE}/api/novel-episode/${ep.id}/generate-storyboard`
    storyboardAbortController = new AbortController()
    isStoryboardManualAbort = false

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        style: novelData.value.artStyle || '日系动漫',
        aspectRatio: novelData.value.aspectRatio || '9:16',
      }),
    })

    if (await checkSseResponse(response)) return

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      showToast(errData.message || `请求失败: ${response.status}`, 'error')
      ep.storyboardStatus = 3
      return false
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      if (isStoryboardManualAbort) {
        reader.cancel()
        break
      }

      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6)
        if (payload === '[DONE]') continue
        try {
          const data = JSON.parse(payload)
          if (data.type === 'structure') {
            structureData = data.data
          } else if (data.type === 'scene' && data.scene_data) {
            completedScenes.push(data.scene_data)
            ep.storyboardData = {
              episode_info: {
                episode_number: index + 1,
                title: ep.title || '',
                total_shots: completedScenes.reduce((sum, scene) => sum + (scene.shots?.length || 0), 0),
              },
              characters: structureData?.characters || [],
              scenes: completedScenes,
            }
            ep.storyboardTotalShots = ep.storyboardData.episode_info.total_shots
          }
        } catch (_) {}
      }
    }

    ep.storyboardStatus = completedScenes.length > 0 ? 2 : 3
    return ep.storyboardStatus === 2
  } catch (err) {
    if (err.name === 'AbortError' && isStoryboardManualAbort) {
      if (completedScenes.length > 0) {
        ep.storyboardStatus = 3
      }
      return false
    }
    console.error(`第${index + 1}集小说分镜生成失败:`, err)
    ep.storyboardStatus = 3
    return false
  } finally {
    storyboardAbortController = null
    isStoryboardManualAbort = false
    generatingStoryboardIndex.value = -1
  }
}

const handleGenerateStoryboard = async ({ index }) => {
  if (!ensureAccess({ actionName: '首帧分镜生成' })) return
  const ep = novelData.value.episodes[index]
  if (!ep) return
  if (!ep.scriptContent || !ep.scriptContent.trim()) {
    showToast('该集台本内容为空，请先生成台本', 'warning')
    return
  }
  if (!ep.id) {
    showToast('该集尚未保存', 'warning')
    return
  }
  if (!(await checkModelConfig('script_gen'))) return

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

const handleStopGenerateStoryboard = async (index) => {
  const ep = novelData.value.episodes[index]
  if (!ep?.id) return

  let stopWatcher = null
  const confirmed = await new Promise((resolve) => {
    showConfirm({
      icon: 'lucide:pause-circle',
      title: '确定暂停首帧分镜生成吗？',
      description: '暂停后，已生成的分镜内容将保留，未完成部分将停止生成，建议耐心等待完成。',
      confirmText: '确认暂停',
      confirmType: 'danger',
    }).then(resolve)

    stopWatcher = watch(generatingStoryboardIndex, (newIdx) => {
      if (newIdx !== index) {
        confirmDialog.visible = false
        resolve(false)
      }
    })
  })

  stopWatcher?.()
  if (!confirmed) return
  if (generatingStoryboardIndex.value !== index) return

  isStoryboardManualAbort = true
  if (storyboardAbortController) {
    storyboardAbortController.abort()
  }

  try {
    await post(`/api/novel-episode/${ep.id}/stop-storyboard`)
  } catch (e) {
    console.error('停止小说分镜生成失败:', e)
  }
}

const loadAllStoryboards = async () => {
  try {
    const res = await get(`/api/novel-project/${novelId}/storyboards`)
    if (res?.code === 200 && res.data?.episodes) {
      const map = {}
      for (const item of res.data.episodes) {
        map[item.episodeId] = item
      }
      for (const ep of novelData.value.episodes) {
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
    console.error('批量加载小说分镜数据失败:', e)
  }

  if (novelContentRef.value?.setStoryboardSettings) {
    novelContentRef.value.setStoryboardSettings(
      novelData.value.artStyle || '日系动漫',
      novelData.value.aspectRatio || '9:16',
    )
  }
}

const generateSingleVideoStoryboard = async (index) => {
  const ep = novelData.value.episodes[index]
  if (!ep?.id) return false
  if (!ep.storyboardData || !ep.storyboardData.scenes || ep.storyboardStatus !== 2) return false

  generatingVideoStoryboardIndex.value = index
  ep.videoStoryboardStatus = 1
  ep.videoStoryboardData = { episode_info: { episode_number: index + 1, total_shots: 0 }, shots: [] }

  try {
    const token = localStorage.getItem('token')
    const url = `${API_BASE}/api/novel-episode/${ep.id}/generate-video-storyboard`
    videoStoryboardAbortController = new AbortController()
    isVideoStoryboardManualAbort = false

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        style: novelData.value.artStyle || '日系动漫',
        aspectRatio: novelData.value.aspectRatio || '9:16',
      }),
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
            ep.videoStoryboardData.shots.push(...data.shots)
            ep.videoStoryboardData.episode_info.total_shots = ep.videoStoryboardData.shots.length
            ep.videoStoryboardTotalShots = ep.videoStoryboardData.shots.length
            if (novelContentRef.value?.switchShotsToVideo) {
              novelContentRef.value.switchShotsToVideo(index, data.shots)
            }
          }
        } catch (_) {}
      }
    }

    ep.videoStoryboardStatus = ep.videoStoryboardData.shots.length > 0 ? 2 : 3
    return ep.videoStoryboardStatus === 2
  } catch (err) {
    if (isVideoStoryboardManualAbort) {
      if (ep.videoStoryboardData?.shots?.length > 0) {
        ep.videoStoryboardStatus = 2
      }
      return false
    }
    console.error(`第${index + 1}集小说视频分镜生成失败:`, err)
    ep.videoStoryboardStatus = 3
    return false
  } finally {
    videoStoryboardAbortController = null
    isVideoStoryboardManualAbort = false
    generatingVideoStoryboardIndex.value = -1
  }
}

const handleGenerateVideoStoryboard = async ({ index }) => {
  if (!ensureAccess({ actionName: '视频分镜生成' })) return
  const ep = novelData.value.episodes[index]
  if (!ep) return
  if (!ep.storyboardData || !ep.storyboardData.scenes || ep.storyboardStatus !== 2) {
    showToast('请先生成静态分镜，再生成视频分镜', 'warning')
    return
  }
  if (!ep.id) {
    showToast('该集尚未保存', 'warning')
    return
  }
  if (!(await checkModelConfig('script_gen'))) return
  if (novelContentRef.value?.switchAllShotsToVideo) {
    novelContentRef.value.switchAllShotsToVideo(index)
  }

  const success = await generateSingleVideoStoryboard(index)
  if (success) {
    showToast(`第${index + 1}集视频分镜生成完成`, 'success')
  } else if (ep.videoStoryboardStatus === 3) {
    showToast('视频分镜生成失败，请稍后重试', 'error')
  }
}

const handleStopGenerateVideoStoryboard = async (index) => {
  const ep = novelData.value.episodes[index]
  if (!ep?.id) return

  let stopWatcher = null
  const confirmed = await new Promise((resolve) => {
    showConfirm({
      icon: 'lucide:pause-circle',
      title: '确定暂停视频分镜生成吗？',
      description: '暂停后，已生成的视频分镜内容将保留，未完成部分将停止生成，建议等待完成。',
      confirmText: '确认暂停',
      confirmType: 'danger',
    }).then(resolve)

    stopWatcher = watch(generatingVideoStoryboardIndex, (newIdx) => {
      if (newIdx !== index) {
        confirmDialog.visible = false
        resolve(false)
      }
    })
  })

  stopWatcher?.()
  if (!confirmed) return
  if (generatingVideoStoryboardIndex.value !== index) return

  isVideoStoryboardManualAbort = true
  if (videoStoryboardAbortController) {
    videoStoryboardAbortController.abort()
  }

  try {
    await post(`/api/novel-episode/${ep.id}/stop-video-storyboard`)
  } catch (e) {
    console.error('停止小说视频分镜生成失败:', e)
  }
}

const handleSaveStoryboard = async ({ episodeId, storyboardData }) => {
  if (!episodeId) return
  try {
    await put(`/api/novel-episode/${episodeId}/storyboard`, {
      storyboardData,
      style: novelData.value.artStyle || '日系动漫',
      aspectRatio: novelData.value.aspectRatio || '9:16',
    })
  } catch (e) {
    console.error('保存小说分镜失败:', e)
    showToast('分镜保存失败', 'error')
  }
}

const handleSaveVideoStoryboard = async ({ episodeId, videoStoryboardData }) => {
  if (!episodeId) return
  try {
    await put(`/api/novel-episode/${episodeId}/video-storyboard`, {
      videoStoryboardData,
      style: novelData.value.artStyle || '日系动漫',
      aspectRatio: novelData.value.aspectRatio || '9:16',
    })
  } catch (e) {
    console.error('保存小说视频分镜失败:', e)
    showToast('视频分镜保存失败', 'error')
  }
}

const handlePreviewDownload = () => { previewModalVisible.value = true }

const handleGenerate = ({ type, data }) => {}
</script>

<style scoped>
.write-editor { display: flex; flex-direction: column; height: 100%; flex: 1; }
.write-editor__title { font-size: 14px; font-weight: 700; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px; }
.write-editor__body { display: flex; gap: 20px; align-items: stretch; flex: 1; min-height: 0; }
.write-editor__left { width: 240px; flex-shrink: 0; transition: width 0.3s ease; overflow: hidden; display: flex; flex-direction: column; position: relative; }
.write-editor__left-scroll { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
.write-editor__left-scroll::-webkit-scrollbar { display: none; }
.write-editor__left-actions { flex-shrink: 0; display: flex; gap: 8px; padding: 12px 0; border-top: 1px solid var(--color-border-light); }
.write-editor__action-btn { flex: 1; height: 34px; border: none; border-radius: var(--radius); font-size: 12px; font-weight: 500; cursor: pointer; transition: background 0.2s, opacity 0.2s; }
.write-editor__action-btn--preview { background: var(--color-bg-white); color: var(--color-text); border: 1px solid var(--color-border); }
.write-editor__action-btn--preview:hover { background: var(--color-bg-hover); border-color: var(--color-text-light); }
.write-editor__action-btn--publish { background: var(--color-primary); color: #fff; }
.write-editor__action-btn--publish:hover { opacity: 0.85; }
.write-editor__expand-btn { flex-shrink: 0; display: flex; align-items: center; justify-content: center; width: 24px; background: var(--color-bg); cursor: pointer; font-size: 10px; color: var(--color-text-light); transition: background 0.2s, color 0.2s; }
.write-editor__expand-btn:hover { background: var(--color-bg-hover); color: var(--color-primary); }
.write-editor__expand-btn--right { border-left: 1px solid var(--color-border-light); }
.write-editor__center { flex: 1; min-width: 0; overflow-y: auto; }
.write-editor__center::-webkit-scrollbar { display: none; }
.write-editor__center--right-closed { padding-right: 32px; }
.write-editor__right { width: 360px; flex-shrink: 0; border-left: 1px solid var(--color-border-light); display: flex; flex-direction: column; }
.write-editor__right :deep(.ai-chat) { background: var(--color-bg-white); border-radius: var(--radius); border: 1px solid var(--color-border); }

/* 发布按钮内图标+文字对齐 */
.write-editor__action-btn--publish { display: flex; align-items: center; justify-content: center; gap: 4px; }

/* ========================================
 * 章节列表面板
 * ======================================== */
.chapter-panel {
  position: absolute;
  inset: 0;
  z-index: 10;
  background: var(--color-bg-white);
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
}

.chapter-panel__header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--color-border-light);
}

.chapter-panel__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text);
}

.chapter-panel__count {
  font-size: 11px;
  color: var(--color-text-light);
  background: var(--color-bg);
  padding: 2px 8px;
  border-radius: 10px;
}

.chapter-panel__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
}

.chapter-panel__list::-webkit-scrollbar { width: 3px; }
.chapter-panel__list::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 3px; }

.chapter-panel__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.15s;
}

.chapter-panel__item:hover { background: var(--color-primary-bg); }

.chapter-panel__item-index {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: var(--color-primary);
  background: var(--color-primary-bg);
  border-radius: 6px;
}

.chapter-panel__item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.chapter-panel__item-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chapter-panel__item-meta {
  font-size: 10px;
  color: var(--color-text-light);
}

.chapter-panel__item-selected { color: var(--color-primary); flex-shrink: 0; }
.chapter-panel__item-unselected { color: var(--color-border); flex-shrink: 0; }

.chapter-panel__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--color-text-light);
  text-align: center;
}

.chapter-panel__empty p { font-size: 12px; margin-top: 6px; }

.chapter-panel__footer {
  flex-shrink: 0;
  padding: 10px 12px;
  border-top: 1px solid var(--color-border-light);
}

.chapter-panel__close-btn {
  width: 100%;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-bg-white);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}

.chapter-panel__close-btn:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-text-light);
}

/* 面板进出动画 */
.chapter-panel-enter-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.chapter-panel-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.chapter-panel-enter-from { opacity: 0; transform: translateY(12px); }
.chapter-panel-leave-to { opacity: 0; transform: translateY(12px); }

@media (max-width: 1200px) {
  .write-editor__left { width: 200px; }
  .write-editor__right { width: 300px; }
}
</style>
