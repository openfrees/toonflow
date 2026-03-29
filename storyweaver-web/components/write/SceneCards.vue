<template>
  <div class="wsc-cards">
    <!-- 场景卡片网格 -->
    <div v-if="scenes.length > 0" class="wsc-cards__grid">
      <button
        v-for="(scene, index) in scenes"
        :key="scene.id || index"
        type="button"
        class="wsc-cards__card"
        :class="{ 'wsc-cards__card--active': drawerIndex === index }"
        @click="openDrawer(index)"
      >
        <span class="wsc-cards__card-name">{{ scene.name || '未命名场景' }}</span>
        <p class="wsc-cards__card-desc">{{ scene.description || '点击查看/编辑场景详情' }}</p>
      </button>
    </div>

    <!-- 空状态 -->
    <div v-else class="wsc-cards__empty">
      <Icon name="lucide:map-pin" size="28" />
      <p>{{ emptyText }}</p>
    </div>

    <!-- 右侧抽屉 -->
    <Teleport to="body">
      <Transition name="wsc-drawer">
        <div v-if="activeScene" class="wsc-drawer-overlay" @click.self="closeDrawer">
          <div class="wsc-drawer">
            <div class="wsc-drawer__header">
              <span class="wsc-drawer__header-title">
                <Icon name="lucide:map-pin" size="16" /> 场景详情
              </span>
              <div class="wsc-drawer__header-actions">
                <button class="wsc-drawer__del-btn" @click="requestDelete">
                  <Icon name="lucide:trash-2" size="14" /> 删除
                </button>
                <button class="wsc-drawer__close-btn" @click="closeDrawer">
                  <Icon name="lucide:x" size="16" />
                </button>
              </div>
            </div>

            <div class="wsc-drawer__body">
              <!-- 左列：场景图片区（上传 / AI生成 / 描述词） -->
              <div class="wsc-drawer__image-col">
                <div
                  class="wsc-drawer__image"
                  :class="{ 'wsc-drawer__image--has': activeScene.image }"
                  @click="handleImageClick"
                >
                  <img
                    v-if="activeScene.image"
                    :src="getImageUrl(activeScene.image)"
                    :alt="activeScene.name"
                    class="wsc-drawer__image-img"
                  />
                  <div v-else class="wsc-drawer__image-empty">
                    <Icon name="lucide:camera" size="24" />
                    <span>暂无场景图</span>
                  </div>
                  <div v-if="imageFlowStatus && generatingImageIdx === drawerIndex" class="wsc-drawer__image-loading">
                    {{ imageFlowStatus }}
                  </div>
                </div>

                <div class="wsc-drawer__image-actions">
                  <button
                    class="wsc-drawer__image-btn"
                    :disabled="generatingImageIdx === drawerIndex"
                    @click="handleUpload"
                  >
                    上传
                  </button>
                  <button
                    class="wsc-drawer__image-btn wsc-drawer__image-btn--ai"
                    :disabled="generatingImageIdx !== -1"
                    @click="handleGenerateImage(drawerIndex)"
                  >
                    AI生成
                  </button>
                </div>
                <input
                  ref="fileInputRef"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style="display: none"
                  @change="onFileSelected"
                />

                <!-- 场景描述词 -->
                <div class="wsc-drawer__prompt-box">
                  <div class="wsc-drawer__prompt-title">
                    <label class="wsc-drawer__label">场景描述词</label>
                    <button
                      class="wsc-drawer__prompt-refresh"
                      :class="{ 'is-loading': generatingPromptIdx === drawerIndex || generatingImageIdx === drawerIndex }"
                      :disabled="generatingPromptIdx === drawerIndex || generatingImageIdx === drawerIndex"
                      title="AI重新生成场景描述词"
                      @click="handleGeneratePrompt(drawerIndex)"
                    >
                      <Icon
                        v-if="generatingPromptIdx !== drawerIndex"
                        name="lucide:refresh-cw"
                        size="14"
                      />
                      <span v-else class="wsc-drawer__spinner"></span>
                    </button>
                  </div>
                  <textarea
                    ref="promptTextareaRef"
                    v-model="activeScene.imagePrompt"
                    class="wsc-drawer__prompt-input"
                    placeholder="场景图片描述词，可手动编辑或AI生成..."
                    @input="autoResizePrompt(); debounceSavePrompt()"
                  ></textarea>
                </div>
              </div>

              <!-- 右列：字段编辑区 -->
              <div class="wsc-drawer__fields">
                <div class="wsc-drawer__field">
                  <label class="wsc-drawer__label">场景名称</label>
                  <input
                    v-model="activeScene.name"
                    class="wsc-drawer__input"
                    placeholder="如：宫殿大殿、街头小巷..."
                    @blur="emitSave"
                  />
                </div>
                <div class="wsc-drawer__field">
                  <label class="wsc-drawer__label">环境描写</label>
                  <textarea
                    v-model="activeScene.description"
                    class="wsc-drawer__textarea"
                    placeholder="描述场景的环境、氛围、光线、天气等..."
                    rows="8"
                    @blur="emitSave"
                  ></textarea>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 删除确认 -->
    <CommonConfirmDialog
      :visible="showDeleteConfirm"
      icon="lucide:alert-triangle"
      :title="`删除场景「${deleteTargetName}」`"
      :description="`确定要删除场景「<strong>${deleteTargetName}</strong>」吗？删除后不可恢复。`"
      confirm-text="确认删除"
      cancel-text="取消"
      confirm-type="danger"
      @confirm="confirmDelete"
      @cancel="showDeleteConfirm = false"
    />

    <!-- 大图预览 -->
    <ImagePreview
      :show="showPreview"
      :image-url="previewUrl"
      :image-alt="activeScene?.name || '场景图'"
      :download-name="`${activeScene?.name || '场景'}_场景图`"
      @close="closePreview"
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
import { useUserStore } from '~/stores/user'
import ImagePreview from '~/components/common/ImagePreview.vue'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  emptyText: { type: String, default: '暂无场景数据' },
  scriptId: { type: String, default: '' },
  apiBase: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'save'])
const { showToast } = useToast()
const userStore = useUserStore()
const {
  guardDialog,
  handleGuardConfirm,
  ensureAccess,
} = useAccessGuard()
const { checkSseResponse } = useModelGuard()

const scenes = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

/* ===== 抽屉基础 ===== */
const drawerIndex = ref(-1)
const activeScene = computed(() => {
  if (drawerIndex.value < 0 || drawerIndex.value >= scenes.value.length) return null
  return scenes.value[drawerIndex.value]
})

const openDrawer = (index) => {
  drawerIndex.value = index
  const scene = scenes.value[index]
  if (
    scene
    && !scene.imagePrompt
    && scene.id
    && (scene.name || scene.description)
    && ensureAccess({ actionName: '场景描述词生成', silent: true })
  ) {
    handleGeneratePrompt(index)
  }
  nextTick(autoResizePrompt)
}
const closeDrawer = () => { drawerIndex.value = -1 }

const emitSave = () => {
  emit('update:modelValue', [...scenes.value])
  emit('save', [...scenes.value])
}

/* ===== 删除 ===== */
const showDeleteConfirm = ref(false)
const deleteTargetName = computed(() => {
  if (drawerIndex.value < 0) return ''
  return scenes.value[drawerIndex.value]?.name || '未命名'
})

const requestDelete = () => { showDeleteConfirm.value = true }

const confirmDelete = () => {
  const idx = drawerIndex.value
  const list = [...scenes.value]
  list.splice(idx, 1)
  drawerIndex.value = -1
  scenes.value = list
  emit('save', list)
  showDeleteConfirm.value = false
}

/* ===== 新增场景 ===== */
const addScene = () => {
  const list = [...scenes.value]
  list.push({ id: '', name: '', description: '', image: '', imagePrompt: '', source: 'manual' })
  scenes.value = list
  drawerIndex.value = list.length - 1
}

/* ===== 图片相关 ===== */
const fileInputRef = ref(null)
const promptTextareaRef = ref(null)
const generatingImageIdx = ref(-1)
const generatingPromptIdx = ref(-1)
const imageFlowStatus = ref('')
const showPreview = ref(false)
const previewUrl = ref('')

const getImageUrl = (image) => {
  if (!image) return ''
  if (image.startsWith('http')) return image
  return `${props.apiBase}${image}`
}

const handleImageClick = () => {
  if (generatingImageIdx.value === drawerIndex.value) return
  if (activeScene.value?.image) {
    previewUrl.value = getImageUrl(activeScene.value.image)
    showPreview.value = true
  } else {
    fileInputRef.value?.click()
  }
}

const closePreview = () => {
  showPreview.value = false
  previewUrl.value = ''
}

const handleUpload = () => {
  fileInputRef.value?.click()
}

/** 编码后的 scriptId（前端传给后端时需要原始混淆ID） */
const getAuthHeaders = () => ({
  Authorization: `Bearer ${userStore.token}`,
})

/* ===== 上传场景图 ===== */
const onFileSelected = async (event) => {
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
  formData.append('scriptId', props.scriptId)
  try {
    const res = await $fetch(`${props.apiBase}/api/script-scene/${scene.id}/upload-image`, {
      method: 'POST',
      body: formData,
      headers: getAuthHeaders(),
    })
    if (res.code === 200) {
      scene.image = res.data.image
      emitSave()
      showToast('场景图上传成功', 'success')
    } else {
      showToast(res.message || '上传失败，请重试', 'error')
    }
  } catch (err) {
    console.error('[SceneCards] 上传场景图失败:', err)
    const status = err?.response?.status || err?.status
    if (status === 413) {
      showToast('图片文件过大，请压缩后重试', 'error')
    } else {
      showToast(err?.data?.message || '上传失败，请重试', 'error')
    }
  }
  event.target.value = ''
}

/* ===== AI生成描述词（SSE流式） ===== */
const generatePromptCore = async (index) => {
  const scene = scenes.value[index]
  scene.imagePrompt = ''

  const response = await fetch(`${props.apiBase}/api/script-scene/${scene.id}/generate-prompt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ scriptId: props.scriptId }),
  })

  if (!response.ok) {
    let errorMessage = '请求失败'
    try {
      const errorData = await response.json()
      errorMessage = errorData.message || errorMessage
    } catch (_) {}

    showToast(`生成失败: ${errorMessage}`, 'error')
    generatingPromptIdx.value = -1
    return
  }

  /* 检查是否为模型未配置错误（后端返回 JSON 而非 SSE） */
  if (await checkSseResponse(response)) {
    generatingPromptIdx.value = -1
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
        if (data.done) emitSave()
      } catch (_) {}
    }
  }
}

const handleGeneratePrompt = async (index) => {
  const scene = scenes.value[index]
  if (!scene?.id) {
    showToast('请先保存场景后再生成描述词', 'warning')
    return
  }
  if (!ensureAccess({ actionName: '场景描述词生成' })) return
  generatingPromptIdx.value = index
  try {
    await generatePromptCore(index)
  } catch (err) {
    console.error('[SceneCards] AI生成场景描述词失败:', err)
  } finally {
    generatingPromptIdx.value = -1
  }
}

/* ===== AI生成场景图 ===== */
const handleGenerateImage = async (index) => {
  if (!ensureAccess({ actionName: '场景图生成' })) return
  const scene = scenes.value[index]
  if (!scene?.id) {
    showToast('请先保存场景后再生成场景图', 'warning')
    return
  }
  generatingImageIdx.value = index

  try {
    if (!scene.imagePrompt || !scene.imagePrompt.trim()) {
      imageFlowStatus.value = '描述词生成中'
      await generatePromptCore(index)
    }

    imageFlowStatus.value = '场景图生成中'
    const res = await $fetch(`${props.apiBase}/api/script-scene/${scene.id}/generate-image`, {
      method: 'POST',
      body: { prompt: scene.imagePrompt || '', scriptId: props.scriptId },
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
    })
    if (res.code === 200) {
      scene.image = res.data.image
      if (res.data.imagePrompt) scene.imagePrompt = res.data.imagePrompt
      emitSave()
      showToast('场景图生成成功', 'success')
    } else {
      showToast(res.message || 'AI生成失败', 'error')
    }
  } catch (err) {
    console.error('[SceneCards] AI生成场景图失败:', err)
    showToast(err?.data?.message || err?.message || 'AI生成失败，请重试', 'error')
  } finally {
    generatingImageIdx.value = -1
    imageFlowStatus.value = ''
  }
}

/* ===== 描述词自动撑高 + 防抖保存 ===== */
const autoResizePrompt = () => {
  const el = promptTextareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

watch(() => activeScene.value?.imagePrompt, () => {
  nextTick(autoResizePrompt)
})

let promptSaveTimer = null
const debounceSavePrompt = () => {
  if (promptSaveTimer) clearTimeout(promptSaveTimer)
  promptSaveTimer = setTimeout(async () => {
    const scene = activeScene.value
    if (!scene?.id) return
    emitSave()
    try {
      await $fetch(`${props.apiBase}/api/script-scene/${scene.id}/prompt`, {
        method: 'PUT',
        body: {
          scriptId: props.scriptId,
          imagePrompt: scene.imagePrompt || '',
        },
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
      })
    } catch (err) {
      console.error('[SceneCards] 保存场景描述词失败:', err)
    }
  }, 1000)
}

defineExpose({ addScene })
</script>

<style scoped>
/* 场景卡片网格 */
.wsc-cards__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}

.wsc-cards__card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px 10px 15px;
  border-radius: 8px;
  border: 1px solid var(--color-border-light, #e8e8e8);
  background: var(--color-bg-white, #fff);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  overflow: hidden;
}

.wsc-cards__card::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  border-radius: 3px 0 0 3px;
  background: #66bb6a;
}

.wsc-cards__card:hover {
  border-color: var(--color-border, #ccc);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  transform: translateY(-1px);
}

.wsc-cards__card--active {
  border-color: var(--color-primary, #ff6b35);
  box-shadow: 0 0 0 2px rgba(255, 107, 53, 0.15);
}

.wsc-cards__card-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text, #222);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wsc-cards__card-desc {
  font-size: 12px;
  line-height: 18px;
  height: 36px;
  color: var(--color-text-secondary, #555);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  margin: 0;
}

/* 空状态 */
.wsc-cards__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 16px;
  color: var(--color-text-light);
  background: var(--color-bg);
  border-radius: var(--radius-sm);
  border: 1px dashed var(--color-border-light);
}

.wsc-cards__empty p {
  font-size: 12px;
  margin: 0;
  text-align: center;
  line-height: 1.6;
}

/* ===== 场景抽屉（scoped 对 Teleport 同样生效） ===== */
.wsc-drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(2px);
  display: flex;
  justify-content: flex-end;
}

.wsc-drawer {
  width: 560px;
  max-width: 92vw;
  height: 100%;
  background: var(--color-bg-white, #fff);
  box-shadow: -8px 0 30px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.wsc-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border-light);
  flex-shrink: 0;
}

.wsc-drawer__header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text);
}

.wsc-drawer__header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.wsc-drawer__del-btn {
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

.wsc-drawer__del-btn:hover {
  background: #fef2f2;
  border-color: #ef4444;
}

.wsc-drawer__close-btn {
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

.wsc-drawer__close-btn:hover {
  background: var(--color-bg-hover, #f0f0f0);
  color: var(--color-text);
}

/* 抽屉主体 */
.wsc-drawer__body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  gap: 20px;
}

/* 左列：场景图片 */
.wsc-drawer__image-col {
  flex-shrink: 0;
  width: 180px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.wsc-drawer__image {
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

.wsc-drawer__image--has {
  border-style: solid;
  border-color: var(--color-border-light);
}

.wsc-drawer__image-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.wsc-drawer__image-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--color-text-light);
  font-size: 11px;
}

.wsc-drawer__image-loading {
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

.wsc-drawer__image-actions {
  display: flex;
  gap: 6px;
}

.wsc-drawer__image-btn {
  flex: 1;
  padding: 4px 0;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-secondary, #555);
  border: 1px solid var(--color-border, #d9d9d9);
  background: var(--color-bg-white, #fff);
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.wsc-drawer__image-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.wsc-drawer__image-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.wsc-drawer__image-btn--ai {
  background: #f0f5ff;
  border-color: #91caff;
  color: #1677ff;
}

/* 描述词区域 */
.wsc-drawer__prompt-box {
  padding: 10px;
  border-radius: 8px;
  background: var(--color-bg);
  border: 1px solid var(--color-border-light);
}

.wsc-drawer__prompt-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.wsc-drawer__prompt-refresh {
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

.wsc-drawer__prompt-refresh:hover:not(:disabled) {
  color: var(--color-primary);
  background: var(--color-primary-bg, rgba(255, 107, 53, 0.06));
}

.wsc-drawer__prompt-refresh.is-loading {
  background: var(--color-primary-bg, rgba(255, 107, 53, 0.06));
}

.wsc-drawer__prompt-refresh:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.wsc-drawer__prompt-input {
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

.wsc-drawer__prompt-input:focus {
  border-color: var(--color-primary);
}

.wsc-drawer__spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: wsc-spin 0.6s linear infinite;
}

@keyframes wsc-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 右列：字段 */
.wsc-drawer__fields {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.wsc-drawer__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wsc-drawer__label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-light);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.wsc-drawer__input {
  padding: 7px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 13px;
  color: var(--color-text);
  background: var(--color-bg);
  outline: none;
  transition: border-color 0.2s;
  width: 100%;
  box-sizing: border-box;
}

.wsc-drawer__input:focus {
  border-color: var(--color-primary);
  background: var(--color-bg-white);
}

.wsc-drawer__textarea {
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
  box-sizing: border-box;
}

.wsc-drawer__textarea:focus {
  border-color: var(--color-primary);
  background: var(--color-bg-white);
}

/* 抽屉动画 */
.wsc-drawer-enter-active { transition: opacity 0.25s ease; }
.wsc-drawer-enter-active .wsc-drawer { transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1); }
.wsc-drawer-leave-active { transition: opacity 0.2s ease; }
.wsc-drawer-leave-active .wsc-drawer { transition: transform 0.2s ease-in; }
.wsc-drawer-enter-from { opacity: 0; }
.wsc-drawer-enter-from .wsc-drawer { transform: translateX(100%); }
.wsc-drawer-leave-to { opacity: 0; }
.wsc-drawer-leave-to .wsc-drawer { transform: translateX(100%); }
</style>
