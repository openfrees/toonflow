<template>
  <div class="asset-panel">
    <!-- 标题 + Tab + 操作按钮：一行搞定 -->
    <div class="asset-panel__header">
      <span class="asset-panel__title-icon"><Icon name="lucide:box" size="16" /></span>
      <h3 class="asset-panel__title">创作资产</h3>
      <div class="asset-panel__tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="asset-panel__tab"
          :class="{ 'asset-panel__tab--active': activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          <Icon :name="tab.icon" size="14" />
          {{ tab.label }}
          <span class="asset-panel__tab-count">{{ getCount(tab.key) }}</span>
        </button>
      </div>
      <div class="asset-panel__actions">
        <button class="asset-panel__sync-btn" @click="handleSync" :disabled="syncDisabled">
          <template v-if="isSyncing">
            <Icon name="lucide:loader-2" size="13" class="asset-panel__spin" />
            {{ syncLoadingText }}
          </template>
          <template v-else>
            <Icon v-if="activeTab !== 'scene'" name="lucide:refresh-cw" size="13" />
            {{ syncButtonText }}
          </template>
        </button>
        <button class="asset-panel__add-btn" @click="handleAdd">
          <Icon name="lucide:plus" size="13" />
          新增
        </button>
      </div>
    </div>

    <div v-show="activeTab === 'character'">
      <NovelCharacterCards
        ref="characterCardsRef"
        v-model="characterCardsModel"
        :project-id="projectId"
        :api-base="apiBase"
        empty-text="暂无角色数据，可通过 AI 生成大纲后点击「从大纲同步」自动提取，或稍后手动补充。"
        @save="handleSaveCharacters"
      />
    </div>

    <!-- 场景卡片网格 -->
    <div v-show="activeTab === 'scene'" class="asset-panel__list">
      <div v-if="scenes.length === 0" class="asset-panel__empty">
        <Icon name="lucide:map-pin" size="28" />
        <p>暂无场景数据</p>
        <span>可通过 AI 生成大纲后点击「从大纲同步」自动提取，或手动新增</span>
      </div>
      <button
        v-for="(item, idx) in scenes"
        :key="`scene-${idx}`"
        type="button"
        class="asset-card asset-card--scene"
        :class="{ 'asset-card--active': sceneDrawerIdx === idx }"
        @click="openSceneDrawer(idx)"
      >
        <span class="asset-card__name">{{ item.name || '未命名' }}</span>
        <p class="asset-card__desc">{{ item.description || item.intro || '暂无描述' }}</p>
      </button>
    </div>

    <!-- 场景右侧抽屉 -->
    <Teleport to="body">
      <Transition name="sc-drawer">
        <div v-if="activeScene" class="sc-drawer-overlay" @click.self="closeSceneDrawer">
          <div class="sc-drawer">
            <!-- 抽屉头部 -->
            <div class="sc-drawer__header">
              <div class="sc-drawer__header-title">
                <Icon name="lucide:map-pin" size="16" />
                <span>场景详情</span>
              </div>
              <div class="sc-drawer__header-actions">
                <button class="sc-drawer__del-btn" @click="requestDeleteScene">
                  <Icon name="lucide:trash-2" size="14" /> 删除
                </button>
                <button class="sc-drawer__close-btn" @click="closeSceneDrawer">
                  <Icon name="lucide:x" size="16" />
                </button>
              </div>
            </div>

            <!-- 抽屉主体：左图右表单 -->
            <div class="sc-drawer__body">
              <!-- 左列：场景图片区 -->
              <div class="sc-drawer__image-col">
                <div
                  class="sc-drawer__image"
                  :class="{ 'sc-drawer__image--has': activeScene.image }"
                  @click="handleSceneImageClick"
                >
                  <img
                    v-if="activeScene.image"
                    :src="getSceneImageUrl(activeScene.image)"
                    :alt="activeScene.name"
                    class="sc-drawer__image-img"
                  />
                  <div v-else class="sc-drawer__image-empty">
                    <Icon name="lucide:camera" size="24" />
                    <span>暂无场景图</span>
                  </div>
                  <div v-if="sceneImageFlowStatus && generatingSceneImageIndex === sceneDrawerIdx" class="sc-drawer__image-loading">
                    {{ sceneImageFlowStatus }}
                  </div>
                </div>
                <div class="sc-drawer__image-actions">
                  <button
                    class="sc-drawer__image-btn"
                    :disabled="generatingSceneImageIndex === sceneDrawerIdx"
                    @click="handleUploadSceneImage"
                  >
                    上传
                  </button>
                  <button
                    class="sc-drawer__image-btn sc-drawer__image-btn--ai"
                    :disabled="generatingSceneImageIndex !== -1"
                    @click="handleGenerateSceneImage(sceneDrawerIdx)"
                  >
                    AI生成
                  </button>
                </div>
                <input
                  ref="sceneFileInputRef"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style="display: none"
                  @change="onSceneFileSelected"
                />
                <div class="sc-drawer__prompt-box">
                  <div class="sc-drawer__prompt-title">
                    <label class="sc-drawer__label">场景描述词</label>
                    <button
                      class="sc-drawer__prompt-refresh"
                      :class="{ 'is-loading': generatingScenePromptIndex === sceneDrawerIdx || generatingSceneImageIndex === sceneDrawerIdx }"
                      :disabled="generatingScenePromptIndex === sceneDrawerIdx || generatingSceneImageIndex === sceneDrawerIdx"
                      title="AI重新生成场景描述词"
                      @click="handleGenerateScenePrompt(sceneDrawerIdx)"
                    >
                      <Icon
                        v-if="generatingScenePromptIndex !== sceneDrawerIdx"
                        name="lucide:refresh-cw"
                        size="14"
                      />
                      <span v-else class="sc-drawer__spinner"></span>
                    </button>
                  </div>
                  <textarea
                    ref="scenePromptTextareaRef"
                    v-model="activeScene.imagePrompt"
                    class="sc-drawer__prompt-input"
                    placeholder="场景图片描述词，可手动编辑或AI生成..."
                    @input="autoResizeScenePrompt(); debounceSaveScenePrompt()"
                  ></textarea>
                </div>
              </div>

              <!-- 右列：字段编辑区 -->
              <div class="sc-drawer__fields">
                <div class="sc-drawer__field">
                  <label class="sc-drawer__label">场景名称</label>
                  <input
                    v-model="activeScene.name"
                    class="sc-drawer__input"
                    placeholder="如：城市街道、医院走廊..."
                    @blur="emitSceneSave"
                  />
                </div>
                <div class="sc-drawer__field">
                  <label class="sc-drawer__label">环境描写</label>
                  <textarea
                    v-model="activeScene.description"
                    class="sc-drawer__textarea"
                    placeholder="空间结构、光线氛围、装饰陈设、气味声音等环境细节..."
                    rows="8"
                    @blur="emitSceneSave"
                  ></textarea>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 场景删除确认弹窗 -->
    <CommonConfirmDialog
      :visible="showSceneDeleteConfirm"
      :icon="isManualScene ? 'lucide:alert-triangle' : 'lucide:info'"
      :title="`删除场景「${sceneDeleteTargetName}」`"
      :description="sceneDeleteDescription"
      confirm-text="确认删除"
      cancel-text="取消"
      confirm-type="danger"
      @confirm="confirmDeleteScene"
      @cancel="showSceneDeleteConfirm = false"
    />

    <!-- 场景图大图预览 -->
    <ImagePreview
      :show="showScenePreview"
      :image-url="scenePreviewUrl"
      :image-alt="activeScene?.name || '场景图'"
      :download-name="`${activeScene?.name || '场景'}_场景图`"
      @close="closeScenePreview"
    />

    <CommonAccessGuardDialog
      :state="guardDialog"
      @update:visible="guardDialog.visible = $event"
      @confirm="handleGuardConfirm"
      @cancel="guardDialog.visible = false"
    />
  </div>
</template>

<script setup>
/**
 * 小说编辑 - 创作资产管理面板
 * 支持角色、场景两类资产的展示、编辑、新增、删除
 * 场景采用右侧抽屉交互（与角色卡片一致）
 */
import { useUserStore } from '~/stores/user'
import ImagePreview from '~/components/common/ImagePreview.vue'

const props = defineProps({
  modelValue: { type: Object, default: () => ({ characters: [], scenes: [] }) },
  characterCards: { type: Array, default: () => [] },
  episodes: { type: Array, default: () => [] },
  projectId: { type: String, default: '' },
  apiBase: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'update:characterCards'])

const { showToast } = useToast()
const {
  guardDialog,
  handleGuardConfirm,
  ensureAccess,
} = useAccessGuard()
const { checkSseResponse } = useModelGuard()

const tabs = [
  { key: 'character', label: '角色', icon: 'lucide:users' },
  { key: 'scene', label: '场景', icon: 'lucide:map-pin' },
]
const activeTab = ref('character')

const scenes = computed(() => props.modelValue.scenes || [])
const characterCardsRef = ref(null)
const characterCardsModel = computed({
  get: () => props.characterCards,
  set: (val) => emit('update:characterCards', val),
})

const getCount = (key) => key === 'character' ? characterCardsModel.value.length : scenes.value.length

/* ===== 场景抽屉 ===== */
const sceneDrawerIdx = ref(-1)
const activeScene = computed(() => {
  if (sceneDrawerIdx.value < 0 || sceneDrawerIdx.value >= scenes.value.length) return null
  return scenes.value[sceneDrawerIdx.value]
})
const generatingSceneImageIndex = ref(-1)
const generatingScenePromptIndex = ref(-1)
const sceneImageFlowStatus = ref('')
const sceneFileInputRef = ref(null)
const scenePromptTextareaRef = ref(null)
const showScenePreview = ref(false)
const scenePreviewUrl = ref('')

const openSceneDrawer = (idx) => {
  sceneDrawerIdx.value = idx
  const scene = scenes.value[idx]
  if (
    scene &&
    !scene.imagePrompt &&
    scene.id &&
    (scene.name || scene.description || scene.intro)
    && ensureAccess({ actionName: '场景描述词生成', silent: true })
  ) {
    handleGenerateScenePrompt(idx)
  }
  nextTick(autoResizeScenePrompt)
}

const closeSceneDrawer = () => {
  sceneDrawerIdx.value = -1
}

const emitSceneSave = () => {
  const assets = { ...props.modelValue }
  assets.scenes = [...scenes.value]
  emit('update:modelValue', assets)
}

watch(() => activeScene.value?.imagePrompt, () => {
  nextTick(autoResizeScenePrompt)
})

const getSceneImageUrl = (image) => {
  if (!image) return ''
  if (image.startsWith('http')) return image
  return `${props.apiBase}${image}`
}

const handleSceneImageClick = () => {
  if (generatingSceneImageIndex.value === sceneDrawerIdx.value) return
  if (activeScene.value?.image) {
    scenePreviewUrl.value = getSceneImageUrl(activeScene.value.image)
    showScenePreview.value = true
  } else {
    sceneFileInputRef.value?.click()
  }
}

const closeScenePreview = () => {
  showScenePreview.value = false
  scenePreviewUrl.value = ''
}

const handleUploadSceneImage = () => {
  sceneFileInputRef.value?.click()
}

const onSceneFileSelected = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  if (file.size > 5 * 1024 * 1024) {
    showToast('图片不能超过5MB，请压缩后重试', 'warning')
    event.target.value = ''
    return
  }

  const scene = activeScene.value
  if (!scene?.id) {
    showToast('请先保存场景后再上传图片', 'warning')
    event.target.value = ''
    return
  }

  const formData = new FormData()
  formData.append('file', file)
  try {
    const res = await $fetch(`${props.apiBase}/api/novel-asset/${scene.id}/upload-scene-image`, {
      method: 'POST',
      body: formData,
      headers: { Authorization: `Bearer ${useUserStore().token}` },
    })
    if (res.code === 200) {
      scene.image = res.data.image
      emitSceneSave()
      showToast('场景图上传成功', 'success')
    } else {
      showToast(res.message || '上传失败，请重试', 'error')
    }
  } catch (err) {
    console.error('[NovelAssetPanel] 上传场景图失败:', err)
    const status = err?.response?.status || err?.status
    if (status === 413) {
      showToast('图片文件过大，请压缩后重试', 'error')
    } else {
      showToast(err?.data?.message || '上传失败，请重试', 'error')
    }
  }
  event.target.value = ''
}

const generateScenePromptCore = async (index, skipSaveEmit = false) => {
  const scene = scenes.value[index]
  scene.imagePrompt = ''

  const response = await fetch(`${props.apiBase}/api/novel-asset/${scene.id}/generate-scene-prompt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${useUserStore().token}`,
    },
  })

  if (!response.ok) {
    let errorMessage = '请求失败'
    try {
      const errorData = await response.json()
      errorMessage = errorData.message || errorMessage
    } catch (_) {}

    showToast(`生成失败: ${errorMessage}`, 'error')
    generatingScenePromptIndex.value = -1
    return
  }

  if (await checkSseResponse(response)) {
    generatingScenePromptIndex.value = -1
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const data = JSON.parse(line.slice(6))
        if (data.content) scene.imagePrompt += data.content
        if (data.done && !skipSaveEmit) emitSceneSave()
      } catch (_) {}
    }
  }
}

const handleGenerateScenePrompt = async (index) => {
  const scene = scenes.value[index]
  if (!scene?.id) {
    showToast('请先保存场景后再生成描述词', 'warning')
    return
  }
  if (!ensureAccess({ actionName: '场景描述词生成' })) return
  generatingScenePromptIndex.value = index
  try {
    await generateScenePromptCore(index)
  } catch (err) {
    console.error('[NovelAssetPanel] AI生成场景描述词失败:', err)
  } finally {
    generatingScenePromptIndex.value = -1
  }
}

const handleGenerateSceneImage = async (index) => {
  if (!ensureAccess({ actionName: '场景图生成' })) return
  const scene = scenes.value[index]
  if (!scene?.id) {
    showToast('请先保存场景后再生成场景图', 'warning')
    return
  }
  generatingSceneImageIndex.value = index

  try {
    if (!scene.imagePrompt || !scene.imagePrompt.trim()) {
      sceneImageFlowStatus.value = '描述词生成中'
      await generateScenePromptCore(index, true)
    }

    sceneImageFlowStatus.value = '场景图生成中'
    const res = await $fetch(`${props.apiBase}/api/novel-asset/${scene.id}/generate-scene-image`, {
      method: 'POST',
      body: { prompt: scene.imagePrompt || '' },
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${useUserStore().token}`,
      },
    })
    if (res.code === 200) {
      scene.image = res.data.image
      if (res.data.imagePrompt) scene.imagePrompt = res.data.imagePrompt
      emitSceneSave()
      showToast('场景图生成成功', 'success')
    } else {
      showToast(res.message || 'AI生成失败', 'error')
    }
  } catch (err) {
    console.error('[NovelAssetPanel] AI生成场景图失败:', err)
    showToast(err?.data?.message || 'AI生成失败，请重试', 'error')
  } finally {
    generatingSceneImageIndex.value = -1
    sceneImageFlowStatus.value = ''
  }
}

const autoResizeScenePrompt = () => {
  const el = scenePromptTextareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

let scenePromptSaveTimer = null
const debounceSaveScenePrompt = () => {
  if (scenePromptSaveTimer) clearTimeout(scenePromptSaveTimer)
  scenePromptSaveTimer = setTimeout(async () => {
    const scene = activeScene.value
    if (!scene?.id) return
    emitSceneSave()
    try {
      await $fetch(`${props.apiBase}/api/novel-asset/${scene.id}`, {
        method: 'PUT',
        body: {
          assetType: 'scene',
          sceneImagePrompt: scene.imagePrompt || '',
        },
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${useUserStore().token}`,
        },
      })
    } catch (err) {
      console.error('[NovelAssetPanel] 保存场景描述词失败:', err)
    }
  }, 1000)
}

/* ===== 场景删除 ===== */
const showSceneDeleteConfirm = ref(false)
const sceneDeleteTargetName = computed(() => {
  if (sceneDrawerIdx.value < 0) return ''
  return scenes.value[sceneDrawerIdx.value]?.name || '未命名'
})
const isManualScene = computed(() => {
  if (sceneDrawerIdx.value < 0) return false
  return scenes.value[sceneDrawerIdx.value]?.source === 'manual'
})
const sceneDeleteDescription = computed(() => {
  if (isManualScene.value) {
    return `当前场景「<strong>${sceneDeleteTargetName.value}</strong>」是您手动创建的，删除后<strong>将无法恢复</strong>，确认删除吗？`
  }
  return `当前场景「<strong>${sceneDeleteTargetName.value}</strong>」是系统从大纲中抽离的，删除后如需恢复可重新点击<strong>「从大纲同步」</strong>，确认删除吗？`
})

const requestDeleteScene = () => {
  showSceneDeleteConfirm.value = true
}

const confirmDeleteScene = () => {
  const idx = sceneDrawerIdx.value
  const item = scenes.value[idx]
  if (!item) return

  const name = item.name || '未命名'
  showSceneDeleteConfirm.value = false
  const assets = { ...props.modelValue }
  const list = [...assets.scenes]
  list.splice(idx, 1)
  assets.scenes = list
  sceneDrawerIdx.value = -1
  emit('update:modelValue', assets)
  showToast(`场景「${name}」已删除`, 'success')
}

/* ===== 新增场景（打开空抽屉） ===== */
const handleAdd = () => {
  if (activeTab.value === 'character') {
    characterCardsRef.value?.addCharacter?.()
    return
  }
  const assets = { ...props.modelValue }
  const list = [...assets.scenes]
  list.push({ name: '', description: '', image: '', imagePrompt: '', source: 'manual' })
  assets.scenes = list
  emit('update:modelValue', assets)
  nextTick(() => {
    sceneDrawerIdx.value = list.length - 1
  })
}

const handleSaveCharacters = (data) => {
  emit('update:characterCards', [ ...data ])
}

/* ===== 从大纲同步（角色走后端 AI SSE，场景走本地抽取） ===== */
const isSyncing = ref(false)
const collectiveCharacterKeywords = new Set([
  '众人', '宾客', '家丁', '侍卫', '同学们', '路人', '群众',
  '百姓', '士兵', '仆人', '下人', '村民', '围观者',
])
const syncProgress = reactive({
  visible: false,
  mode: '',
  total: 0,
  processed: 0,
})
const syncProgressLabel = computed(() => (syncProgress.mode === 'scene' ? '场景' : '角色'))
const syncButtonText = computed(() => {
  const mode = isSyncing.value ? syncProgress.mode : activeTab.value
  const label = mode === 'scene' ? '场景' : '角色'
  return isSyncing.value ? `同步${label}中...` : `从大纲同步${label}`
})
const syncLoadingText = computed(() => {
  const label = syncProgressLabel.value
  if (!syncProgress.total) return `获取${label}中`
  return `获取中（${syncProgress.processed}/${syncProgress.total}）`
})
const normalizeSceneName = (name) => String(name || '').replace(/\s+/g, '').trim().toLowerCase()
const normalizeCharacterName = (name) => String(name || '').trim()
const resetSyncProgress = () => {
  syncProgress.visible = false
  syncProgress.mode = ''
  syncProgress.total = 0
  syncProgress.processed = 0
}
const startSyncProgress = (mode, total) => {
  syncProgress.visible = total > 0
  syncProgress.mode = mode
  syncProgress.total = total
  syncProgress.processed = 0
}
const updateSyncProgress = async (processed) => {
  if (!syncProgress.visible) return
  syncProgress.processed = Math.min(processed, syncProgress.total)
  await nextTick()
}
const finishSyncProgress = async () => {
  if (!syncProgress.visible) return
  syncProgress.processed = syncProgress.total
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 240))
  resetSyncProgress()
}
const extractScenesFromEpisodes = () => {
  const extracted = []
  for (const ep of props.episodes || []) {
    const detail = ep?.outlineDetail
    if (!detail || !Array.isArray(detail.scenes)) continue
    for (const scene of detail.scenes) {
      if (!scene?.name) continue
      extracted.push({
        name: scene.name,
        description: scene.description || scene.intro || '',
        image: '',
        imagePrompt: '',
        source: 'ai',
      })
    }
  }

  const uniqueSceneMap = new Map()
  for (const scene of extracted) {
    const key = normalizeSceneName(scene.name)
    if (!key) continue
    const normalizedScene = { ...scene, name: String(scene.name || '').trim() }
    const existing = uniqueSceneMap.get(key)
    if (!existing || (scene.description && scene.description.length > (existing.description || '').length)) {
      uniqueSceneMap.set(key, normalizedScene)
    }
  }
  return Array.from(uniqueSceneMap.values())
}
const extractCharactersFromEpisodes = () => {
  const charMap = new Map()
  const countMap = new Map()

  for (const ep of props.episodes || []) {
    const detail = ep?.outlineDetail
    if (!detail || !Array.isArray(detail.characters)) continue
    for (const character of detail.characters) {
      const name = normalizeCharacterName(character?.name)
      if (!name || collectiveCharacterKeywords.has(name)) continue

      const description = String(character?.description || '').trim()
      const existingDescription = charMap.get(name)
      if (!existingDescription || description.length > existingDescription.length) {
        charMap.set(name, description)
      }
      countMap.set(name, (countMap.get(name) || 0) + 1)
    }
  }

  return Array.from(charMap.entries()).map(([name, description]) => ({
    name,
    description,
    episodeCount: countMap.get(name) || 1,
  }))
}
const syncDisabled = computed(() => {
  if (isSyncing.value) return true
  if (!props.episodes || props.episodes.length === 0) return true
  if (activeTab.value === 'character' && !props.projectId) return true
  return false
})

const handleSync = async () => {
  if (syncDisabled.value) return
  if (activeTab.value === 'scene') {
    await syncScenesLocally()
    return
  }
  await syncCharactersViaSSE()
}

/**
 * 场景本地抽取（保留原逻辑）
 */
const syncScenesLocally = async () => {
  const newScenes = extractScenesFromEpisodes()
  if (newScenes.length === 0) {
    showToast('大纲中暂无可同步场景', 'warning')
    return
  }

  isSyncing.value = true
  startSyncProgress('scene', newScenes.length)
  const currentAssets = props.modelValue
  const currentScenes = Array.isArray(currentAssets.scenes) ? currentAssets.scenes : []
  const existingByKey = new Map(
    currentScenes
      .map(scene => [normalizeSceneName(scene.name), scene])
      .filter(([key]) => key)
  )
  const manualScenes = currentScenes.filter(scene => scene.source === 'manual')
  const manualKeys = new Set(manualScenes.map(scene => normalizeSceneName(scene.name)).filter(Boolean))
  const nextAiSceneKeys = new Set(newScenes.map(scene => normalizeSceneName(scene.name)).filter(Boolean))

  let added = 0
  let updated = 0
  let removed = 0

  const mergedAiScenes = []
  try {
    for (const [index, scene] of newScenes.entries()) {
      const key = normalizeSceneName(scene.name)
      if (!key) {
        await updateSyncProgress(index + 1)
        continue
      }

      /* 手动创建的同名场景始终优先，不让同步覆盖用户自己维护的图片和描述。 */
      if (manualKeys.has(key)) {
        await updateSyncProgress(index + 1)
        continue
      }

      const existing = existingByKey.get(key)
      if (existing) {
        const nextScene = {
          ...existing,
          ...scene,
          id: existing.id || scene.id || '',
          image: existing.image || scene.image || '',
          imagePrompt: existing.imagePrompt || scene.imagePrompt || '',
          source: existing.source || scene.source || 'ai',
        }
        const hasChanged = nextScene.name !== existing.name
          || (nextScene.description || '') !== (existing.description || '')
          || (nextScene.source || '') !== (existing.source || '')
        if (hasChanged) {
          updated++
        }
        mergedAiScenes.push(nextScene)
      } else {
        added++
        mergedAiScenes.push(scene)
      }

      await updateSyncProgress(index + 1)
    }

    for (const scene of currentScenes) {
      const key = normalizeSceneName(scene.name)
      if (!key || scene.source === 'manual') continue
      if (!nextAiSceneKeys.has(key)) {
        removed++
      }
    }

    const nextScenes = [...manualScenes, ...mergedAiScenes]
    const changed = added > 0 || updated > 0 || removed > 0 || nextScenes.length !== currentScenes.length

    if (changed) {
      emit('update:modelValue', { ...currentAssets, scenes: nextScenes })
      const summary = []
      if (added > 0) summary.push(`新增 ${added} 个`)
      if (updated > 0) summary.push(`覆盖 ${updated} 个`)
      if (removed > 0) summary.push(`删除 ${removed} 个`)
      showToast(`场景同步完成：${summary.join('、')}`, 'success')
    } else {
      showToast('场景同步完成：没有缺失场景', 'warning')
    }
    await finishSyncProgress()
  } finally {
    isSyncing.value = false
    resetSyncProgress()
  }
}

/**
 * 角色 AI 同步（SSE 流式）
 * 后端负责 AI 生成 + 逐角色落库，前端只消费事件并刷新列表
 */
const syncCharactersViaSSE = async () => {
  if (!ensureAccess({ actionName: '角色抽离' })) return
  const extractedCharacters = extractCharactersFromEpisodes()
  if (extractedCharacters.length === 0) {
    showToast('大纲中暂无可同步角色', 'warning')
    return
  }

  isSyncing.value = true
  const token = localStorage.getItem('token')
  const syncedNames = new Set()
  resetSyncProgress()

  try {
    const response = await fetch(`${props.apiBase}/api/novel-project/${props.projectId}/assets/sync-characters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      let errMsg = `请求失败: ${response.status}`
      if (text) {
        try {
          const errData = JSON.parse(text)
          if (errData?.message) errMsg = errData.message
          else errMsg = text
        } catch {
          errMsg = text
        }
      }
      showToast(errMsg, 'error')
      isSyncing.value = false
      resetSyncProgress()
      return
    }

    if (await checkSseResponse(response)) {
      isSyncing.value = false
      resetSyncProgress()
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const blocks = buffer.split('\n\n')
      buffer = blocks.pop() || ''

      for (const block of blocks) {
        if (!block.trim()) continue
        const eventMatch = block.match(/^event:\s*(.+)$/m)
        const dataMatch = block.match(/^data:\s*(.+)$/m)
        if (!dataMatch) continue

        const eventName = eventMatch ? eventMatch[1].trim() : 'message'
        let payload
        try { payload = JSON.parse(dataMatch[1]) } catch { continue }

        switch (eventName) {
          case 'start': {
            const totalCount = Number(payload.totalCount)
            startSyncProgress('character', Number.isFinite(totalCount) ? totalCount : extractedCharacters.length)
            break
          }

          case 'character': {
            /* 后端已落库，前端 upsert 到本地列表 */
            const char = payload.character
            if (!char?.name) break
            const list = [...characterCardsModel.value]
            const existIdx = list.findIndex(c => c.name === char.name)
            if (existIdx >= 0) {
              list[existIdx] = char
            } else {
              list.push(char)
            }
            characterCardsModel.value = list
            if (Number.isFinite(Number(payload.processedCount))) {
              await updateSyncProgress(Number(payload.processedCount))
            } else {
              const normalizedName = normalizeCharacterName(char.name)
              if (normalizedName && !syncedNames.has(normalizedName)) {
                syncedNames.add(normalizedName)
                await updateSyncProgress(syncedNames.size)
              }
            }
            break
          }

          case 'done': {
            /* 用后端返回的完整列表替换，确保数据一致 */
            if (Array.isArray(payload.characters)) {
              characterCardsModel.value = payload.characters
            }
            if (Number.isFinite(Number(payload.totalCount)) && syncProgress.total !== Number(payload.totalCount)) {
              startSyncProgress('character', Number(payload.totalCount))
            }
            await finishSyncProgress()
            const { addedCount = 0, updatedCount = 0 } = payload
            if (addedCount === 0 && updatedCount === 0) {
              showToast(payload.message || '未发现可同步的新角色', 'warning')
            } else {
              const parts = []
              if (addedCount > 0) parts.push(`新增 ${addedCount} 个`)
              if (updatedCount > 0) parts.push(`更新 ${updatedCount} 个`)
              showToast(`角色同步完成：${parts.join('、')}`, 'success')
            }
            break
          }

          case 'error': {
            showToast(payload.message || '同步角色失败，请稍后重试', 'error')
            break
          }
        }
      }
    }
  } catch (err) {
    console.error('[NovelAssetPanel] 角色同步失败:', err)
    showToast('角色同步失败，请检查网络后重试', 'error')
  } finally {
    isSyncing.value = false
    resetSyncProgress()
  }
}
</script>

<style scoped>
.asset-panel__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.asset-panel__title-icon {
  font-size: 18px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.asset-panel__title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
  white-space: nowrap;
  margin: 0;
  flex-shrink: 0;
}

.asset-panel__tabs {
  display: flex;
  gap: 4px;
  background: var(--color-bg);
  border-radius: 8px;
  padding: 3px;
  margin-left: 4px;
}

.asset-panel__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.asset-panel__tab {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.asset-panel__tab:hover {
  color: var(--color-text);
  background: var(--color-bg-white);
}

.asset-panel__tab--active {
  color: var(--color-primary);
  background: var(--color-bg-white);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  font-weight: 600;
}

.asset-panel__tab-count {
  font-size: 11px;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--color-bg);
  color: var(--color-text-light);
  font-weight: 500;
  line-height: 18px;
}

.asset-panel__tab--active .asset-panel__tab-count {
  background: rgba(255, 107, 53, 0.1);
  color: var(--color-primary);
}

.asset-panel__sync-btn,
.asset-panel__add-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.asset-panel__sync-btn {
  background: var(--color-bg-white);
  color: var(--color-text-secondary);
}

.asset-panel__sync-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: rgba(255, 107, 53, 0.04);
}

.asset-panel__sync-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.asset-panel__add-btn {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.asset-panel__add-btn:hover {
  opacity: 0.9;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.asset-panel__spin {
  animation: spin 0.8s linear infinite;
}

/* ===== 场景卡片网格 ===== */
.asset-panel__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}

.asset-panel__empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 28px 16px;
  color: var(--color-text-light);
  background: var(--color-bg);
  border-radius: var(--radius-sm);
  border: 1px dashed var(--color-border-light);
}

.asset-panel__empty p {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin: 0;
}

.asset-panel__empty span {
  font-size: 11px;
  text-align: center;
  line-height: 1.5;
}

/* ===== 场景卡片（与角色卡片风格一致） ===== */
.asset-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px 10px 15px;
  border-radius: 8px;
  border: 1px solid var(--color-border-light);
  background: var(--color-bg-white);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  overflow: hidden;
}

.asset-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  border-radius: 3px 0 0 3px;
}

.asset-card--scene::before {
  background: #66bb6a;
}

.asset-card:hover {
  border-color: var(--color-border);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  transform: translateY(-1px);
}

.asset-card--active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(255, 107, 53, 0.15);
}

.asset-card__name {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asset-card__desc {
  font-size: 12px;
  line-height: 18px;
  height: 36px;
  color: var(--color-text-secondary);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  margin: 0;
}

/* ===== 场景抽屉 ===== */
.sc-drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(2px);
  display: flex;
  justify-content: flex-end;
}

.sc-drawer {
  width: 560px;
  max-width: 92vw;
  height: 100%;
  background: var(--color-bg-white, #fff);
  box-shadow: -8px 0 30px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sc-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border-light);
  flex-shrink: 0;
}

.sc-drawer__header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text);
}

.sc-drawer__header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sc-drawer__del-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #ef4444;
  background: transparent;
  border: 1px solid rgba(239, 68, 68, 0.3);
  cursor: pointer;
  transition: all 0.2s;
}

.sc-drawer__del-btn:hover {
  background: #fef2f2;
  border-color: #ef4444;
}

.sc-drawer__close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: transparent;
  border: none;
  color: var(--color-text-light);
  cursor: pointer;
  transition: all 0.15s;
}

.sc-drawer__close-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

/* ===== 抽屉主体 ===== */
.sc-drawer__body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  gap: 20px;
}

/* 左列：场景图片 */
.sc-drawer__image-col {
  flex-shrink: 0;
  width: 180px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sc-drawer__image {
  width: 180px;
  height: 120px;
  border-radius: 10px;
  border: 2px dashed var(--color-border);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
  transition: border-color 0.2s;
  cursor: pointer;
  position: relative;
}

.sc-drawer__image--has {
  border-style: solid;
  border-color: var(--color-border-light);
}

.sc-drawer__image-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sc-drawer__image-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--color-text-light);
  font-size: 11px;
}

.sc-drawer__image-loading {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  border-radius: 8px;
}

.sc-drawer__image-actions {
  display: flex;
  gap: 6px;
}

.sc-drawer__image-btn {
  flex: 1;
  padding: 4px 0;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid var(--color-border);
  background: var(--color-bg-white);
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.sc-drawer__image-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.sc-drawer__image-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sc-drawer__image-btn--ai {
  background: #f0f5ff;
  border-color: #91caff;
  color: #1677ff;
}

.sc-drawer__prompt-box {
  padding: 10px;
  border-radius: 8px;
  background: var(--color-bg);
  border: 1px solid var(--color-border-light);
}

.sc-drawer__prompt-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.sc-drawer__prompt-refresh {
  width: 26px;
  height: 26px;
  border: none;
  background: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
  color: var(--color-text-light);
  padding: 0;
  flex-shrink: 0;
}

.sc-drawer__prompt-refresh:hover:not(:disabled) {
  color: var(--color-primary);
  background: var(--color-primary-bg, rgba(255, 107, 53, 0.06));
}

.sc-drawer__prompt-refresh.is-loading {
  background: var(--color-primary-bg, rgba(255, 107, 53, 0.06));
}

.sc-drawer__prompt-refresh:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.sc-drawer__prompt-input {
  width: 100%;
  font-size: 11px;
  padding: 6px 8px;
  border: 1px solid var(--color-border-light);
  border-radius: 5px;
  background: var(--color-bg-white);
  resize: none;
  overflow: hidden;
  min-height: 80px;
  font-family: inherit;
  line-height: 1.5;
  color: var(--color-text-secondary);
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s, height 0.15s ease;
}

.sc-drawer__prompt-input:focus {
  border-color: var(--color-primary);
}

.sc-drawer__spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: sc-spin 0.6s linear infinite;
}

@keyframes sc-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 右列：字段编辑 */
.sc-drawer__fields {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sc-drawer__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sc-drawer__label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-light);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.sc-drawer__input {
  padding: 7px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 13px;
  color: var(--color-text);
  background: var(--color-bg);
  outline: none;
  transition: border-color 0.2s;
  width: 100%;
}

.sc-drawer__input:focus {
  border-color: var(--color-primary);
  background: var(--color-bg-white);
}

.sc-drawer__textarea {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-text);
  background: var(--color-bg);
  resize: vertical;
  outline: none;
  font-family: inherit;
  transition: border-color 0.2s;
}

.sc-drawer__textarea:focus {
  border-color: var(--color-primary);
  background: var(--color-bg-white);
}

/* ===== 抽屉动画 ===== */
.sc-drawer-enter-active {
  transition: opacity 0.25s ease;
}
.sc-drawer-enter-active .sc-drawer {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.sc-drawer-leave-active {
  transition: opacity 0.2s ease;
}
.sc-drawer-leave-active .sc-drawer {
  transition: transform 0.2s ease-in;
}
.sc-drawer-enter-from {
  opacity: 0;
}
.sc-drawer-enter-from .sc-drawer {
  transform: translateX(100%);
}
.sc-drawer-leave-to {
  opacity: 0;
}
.sc-drawer-leave-to .sc-drawer {
  transform: translateX(100%);
}
</style>
