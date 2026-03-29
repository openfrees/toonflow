<template>
  <div class="nc-cards">
    <!-- 卡片网格 -->
    <div v-if="characters.length > 0" class="nc-cards__grid">
      <button
        v-for="(char, index) in characters"
        :key="char.id || index"
        type="button"
        class="nc-cards__card"
        :class="{
          [`nc-cards__card--${char.roleType || 'other'}`]: true,
          'nc-cards__card--active': drawerIndex === index,
        }"
        @click="openDrawer(index)"
      >
        <div class="nc-cards__card-top">
          <span class="nc-cards__card-badge">{{ roleLabels[char.roleType] || '其他' }}</span>
          <span class="nc-cards__card-name">{{ char.name || '未命名' }}</span>
          <span v-if="char.gender || char.age" class="nc-cards__card-meta">{{ [char.gender, char.age].filter(Boolean).join(' · ') }}</span>
        </div>
        <p class="nc-cards__card-summary">{{ getSummary(char) }}</p>
      </button>
    </div>

    <!-- 空状态 -->
    <div v-else class="nc-cards__empty">
      <Icon name="lucide:users" size="28" />
      <p>{{ emptyText }}</p>
    </div>

    <!-- 右侧抽屉 -->
    <Teleport to="body">
      <Transition name="nc-drawer">
        <div v-if="activeChar" v-show="!showGuardDialog" class="nc-drawer-overlay" @click.self="closeDrawer">
          <div class="nc-drawer">
            <!-- 抽屉头部 -->
            <div class="nc-drawer__header" :class="`nc-drawer__header--${activeChar.roleType || 'other'}`">
              <select
                v-model="activeChar.roleType"
                class="nc-drawer__role-select"
                @change="emitSave"
              >
                <option value="protagonist">主角</option>
                <option value="antagonist">反派</option>
                <option value="ally">朋友/盟友</option>
                <option value="lover">恋人</option>
                <option value="rival">对手/竞争者</option>
                <option value="other">其他</option>
              </select>
              <div class="nc-drawer__header-actions">
                <button class="nc-drawer__del-btn" @click="requestDelete">
                  <Icon name="lucide:trash-2" size="14" /> 删除
                </button>
                <button class="nc-drawer__close-btn" @click="closeDrawer">
                  <Icon name="lucide:x" size="16" />
                </button>
              </div>
            </div>

            <!-- 抽屉主体 -->
            <div class="nc-drawer__body">
              <!-- 左列：头像区（可上传/AI生成） -->
              <div class="nc-drawer__avatar-col">
                <div class="nc-drawer__avatar" :class="{ 'nc-drawer__avatar--has': activeChar.avatar }" @click="handleAvatarClick">
                  <img
                    v-if="activeChar.avatar"
                    :src="getAvatarUrl(activeChar.avatar)"
                    :alt="activeChar.name"
                    class="nc-drawer__avatar-img"
                  />
                  <div v-else class="nc-drawer__avatar-empty">
                    <Icon name="lucide:camera" size="20" />
                    <span>暂无形象图</span>
                  </div>
                  <div v-if="avatarFlowStatus && generatingAvatarIndex === drawerIndex" class="nc-drawer__avatar-loading">
                    {{ avatarFlowStatus }}
                  </div>
                </div>
                <div class="nc-drawer__avatar-actions">
                  <button
                    class="nc-drawer__avatar-btn"
                    :disabled="generatingAvatarIndex === drawerIndex"
                    @click="handleUploadAvatar"
                  >上传</button>
                  <button
                    class="nc-drawer__avatar-btn nc-drawer__avatar-btn--ai"
                    :disabled="generatingAvatarIndex !== -1"
                    @click="handleGenerateAvatar(drawerIndex)"
                  >AI生成</button>
                </div>
                <input
                  ref="fileInputRef"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style="display: none"
                  @change="onFileSelected"
                />
                <div class="nc-drawer__prompt-box">
                  <div class="nc-drawer__prompt-title">
                    <label class="nc-drawer__label">形象描述词</label>
                    <button
                      class="nc-drawer__prompt-refresh"
                      :class="{ 'is-loading': generatingPromptIndex === drawerIndex || generatingAvatarIndex === drawerIndex }"
                      :disabled="generatingPromptIndex === drawerIndex || generatingAvatarIndex === drawerIndex"
                      title="AI重新生成描述词"
                      @click="handleGeneratePrompt(drawerIndex)"
                    >
                      <svg v-if="generatingPromptIndex !== drawerIndex" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="23 4 23 10 17 10"/>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                      </svg>
                      <span v-else class="nc-cards__spinner"></span>
                    </button>
                  </div>
                  <textarea
                    ref="promptTextareaRef"
                    v-model="activeChar.avatarPrompt"
                    class="nc-drawer__prompt-input"
                    placeholder="角色画像描述词，可手动编辑或AI生成..."
                    @input="autoResizePrompt(); debounceSavePrompt()"
                  ></textarea>
                </div>
              </div>

              <!-- 右列：字段编辑区 -->
              <div class="nc-drawer__fields">
                <div class="nc-drawer__row">
                  <div class="nc-drawer__field nc-drawer__field--grow">
                    <label class="nc-drawer__label">姓名</label>
                    <input v-model="activeChar.name" class="nc-drawer__input" placeholder="角色姓名" @blur="emitSave" />
                  </div>
                  <div class="nc-drawer__field nc-drawer__field--sm">
                    <label class="nc-drawer__label">性别</label>
                    <select v-model="activeChar.gender" class="nc-drawer__input" @change="emitSave">
                      <option value="男">男</option>
                      <option value="女">女</option>
                      <option value="">未设定</option>
                    </select>
                  </div>
                  <div class="nc-drawer__field nc-drawer__field--sm">
                    <label class="nc-drawer__label">年龄</label>
                    <input v-model="activeChar.age" class="nc-drawer__input" placeholder="如22岁" @blur="emitSave" />
                  </div>
                </div>

                <!-- 性格特点 -->
                <div class="nc-drawer__field">
                  <label class="nc-drawer__label">性格特点</label>
                  <div class="nc-drawer__tags">
                    <div v-for="(p, pIdx) in activeChar.personality" :key="pIdx" class="nc-drawer__tag-row">
                      <input v-model="p.keyword" class="nc-drawer__tag-kw" placeholder="关键词" @blur="emitSave" />
                      <input v-model="p.desc" class="nc-drawer__tag-desc" placeholder="描述" @blur="emitSave" />
                      <button class="nc-drawer__tag-del" @click="removeTag(activeChar.personality, pIdx)">
                        <Icon name="lucide:x" size="12" />
                      </button>
                    </div>
                    <button v-if="(activeChar.personality || []).length < 5" class="nc-drawer__tag-add" @click="addTag(activeChar, 'personality')">
                      <Icon name="lucide:plus" size="12" /> 添加性格
                    </button>
                  </div>
                </div>

                <!-- 容貌 -->
                <div class="nc-drawer__field">
                  <label class="nc-drawer__label">容貌</label>
                  <div class="nc-drawer__tags">
                    <div v-for="(a, aIdx) in activeChar.appearance" :key="aIdx" class="nc-drawer__tag-row">
                      <input v-model="a.keyword" class="nc-drawer__tag-kw" placeholder="关键词" @blur="emitSave" />
                      <input v-model="a.desc" class="nc-drawer__tag-desc" placeholder="描述" @blur="emitSave" />
                      <button class="nc-drawer__tag-del" @click="removeTag(activeChar.appearance, aIdx)">
                        <Icon name="lucide:x" size="12" />
                      </button>
                    </div>
                    <button v-if="(activeChar.appearance || []).length < 5" class="nc-drawer__tag-add" @click="addTag(activeChar, 'appearance')">
                      <Icon name="lucide:plus" size="12" /> 添加容貌
                    </button>
                  </div>
                </div>

                <!-- 与主角关系 -->
                <div class="nc-drawer__field">
                  <label class="nc-drawer__label">与主角关系</label>
                  <textarea v-model="activeChar.relationship" class="nc-drawer__textarea" placeholder="与主角的关系描述..." rows="2" @blur="emitSave"></textarea>
                </div>

                <!-- 人物经历 -->
                <div class="nc-drawer__field">
                  <label class="nc-drawer__label">人物经历</label>
                  <textarea v-model="activeChar.background" class="nc-drawer__textarea" placeholder="人物背景经历..." rows="3" @blur="emitSave"></textarea>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 大图预览 -->
    <ImagePreview
      :show="showPreview"
      :image-url="previewUrl"
      :image-alt="activeChar?.name || '角色形象图'"
      :download-name="`${activeChar?.name || '角色'}_形象图`"
      @close="closePreview"
    />

    <!-- 删除确认弹窗 -->
    <CommonConfirmDialog
      :visible="showDeleteConfirm"
      :icon="isManualCharacter ? 'lucide:alert-triangle' : 'lucide:info'"
      :title="`删除角色「${deleteTargetName}」`"
      :description="deleteDescription"
      confirm-text="确认删除"
      cancel-text="取消"
      confirm-type="danger"
      :loading="isDeleting"
      loading-text="删除中..."
      @confirm="confirmDelete"
      @cancel="showDeleteConfirm = false"
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
 * 小说转剧本 - 角色卡片组件
 * 卡片网格 + 右侧抽屉详情 + 形象图上传/AI生成 + 描述词编辑/AI生成 + 删除确认
 */
import { useUserStore } from '~/stores/user'
import { useToast } from '~/composables/useToast'
import ImagePreview from '~/components/common/ImagePreview.vue'

const { showToast } = useToast()
const {
  guardDialog,
  handleGuardConfirm,
  ensureAccess,
} = useAccessGuard()
const { showGuardDialog, checkSseResponse, isModelConfigured, checkModelConfig, triggerGuardDialog } = useModelGuard()

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  emptyText: { type: String, default: '暂无角色数据，可通过「从大纲同步」自动提取角色。' },
  projectId: { type: String, default: '' },
  apiBase: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'save'])

const characters = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const drawerIndex = ref(-1)
const activeChar = computed(() => {
  if (drawerIndex.value < 0 || drawerIndex.value >= characters.value.length) return null
  return characters.value[drawerIndex.value]
})

/* ===== 形象相关状态 ===== */
const generatingAvatarIndex = ref(-1)
const generatingPromptIndex = ref(-1)
const avatarFlowStatus = ref('')
const fileInputRef = ref(null)
const promptTextareaRef = ref(null)
const showPreview = ref(false)
const previewUrl = ref('')

/* ===== 删除相关状态 ===== */
const showDeleteConfirm = ref(false)
const isDeleting = ref(false)
const deleteTargetName = computed(() => {
  if (drawerIndex.value < 0) return ''
  return characters.value[drawerIndex.value]?.name || '未命名'
})

const isManualCharacter = computed(() => {
  if (drawerIndex.value < 0) return false
  return characters.value[drawerIndex.value]?.source === 'manual'
})

const deleteDescription = computed(() => {
  if (isManualCharacter.value) {
    return `当前角色「<strong>${deleteTargetName.value}</strong>」是您手动创建的，删除后<strong>将无法恢复</strong>，确认删除吗？`
  }
  return `当前角色「<strong>${deleteTargetName.value}</strong>」是系统从大纲中抽离的，删除后如需恢复可重新点击<strong>「从大纲同步」</strong>，确认删除吗？`
})

const roleLabels = {
  protagonist: '主角',
  antagonist: '反派',
  ally: '盟友',
  lover: '恋人',
  rival: '对手',
  other: '其他',
}

/* ===== 抽屉操作 ===== */
const openDrawer = async (index) => {
  drawerIndex.value = index
  /* 展开时：如果没有描述词且有足够信息，且已绑定文字模型 → 自动生成；未绑定则静默跳过 */
  if (drawerIndex.value >= 0) {
    const char = characters.value[drawerIndex.value]
    if (
      char
      && !char.avatarPrompt
      && char.id
      && char.name
      && (char.gender || char.personality?.length || char.appearance?.length)
      && ensureAccess({ actionName: '角色描述词生成', silent: true })
      && await isModelConfigured('script_gen')
    ) {
      handleGeneratePrompt(drawerIndex.value)
    }
  }
  nextTick(autoResizePrompt)
}

/* AI流式写入时 avatarPrompt 持续变化，自动撑高 */
watch(() => activeChar.value?.avatarPrompt, () => {
  nextTick(autoResizePrompt)
})

const closeDrawer = () => {
  drawerIndex.value = -1
}

const emitSave = () => {
  emit('update:modelValue', [...characters.value])
  emit('save', [...characters.value])
}

const getSummary = (char) => {
  return char.background || char.relationship || '点击查看详情'
}

/* ===== 头像 URL 处理 ===== */
const getAvatarUrl = (avatar) => {
  if (!avatar) return ''
  if (avatar.startsWith('http')) return avatar
  return `${props.apiBase}${avatar}`
}

/* ===== 头像点击 ===== */
const handleAvatarClick = () => {
  if (generatingAvatarIndex.value === drawerIndex.value) return
  if (activeChar.value?.avatar) {
    previewUrl.value = getAvatarUrl(activeChar.value.avatar)
    showPreview.value = true
  } else {
    fileInputRef.value?.click()
  }
}

const closePreview = () => {
  showPreview.value = false
  previewUrl.value = ''
}

/* ===== 头像上传 ===== */
const handleUploadAvatar = () => { fileInputRef.value?.click() }

const onFileSelected = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  if (file.size > 5 * 1024 * 1024) {
    showToast('图片不能超过5MB，请压缩后重试', 'warning')
    event.target.value = ''
    return
  }

  const char = activeChar.value
  if (!char?.id) { showToast('请先保存角色后再上传头像', 'warning'); return }

  const formData = new FormData()
  formData.append('file', file)
  try {
    const res = await $fetch(`${props.apiBase}/api/novel-asset/${char.id}/upload-avatar`, {
      method: 'POST', body: formData,
      headers: { Authorization: `Bearer ${useUserStore().token}` },
    })
    if (res.code === 200) {
      char.avatar = res.data.avatar
      showToast('头像上传成功', 'success')
    } else {
      showToast(res.message || '上传失败，请重试', 'error')
    }
  } catch (err) {
    console.error('[NovelCharacterCards] 上传头像失败:', err)
    const status = err?.response?.status || err?.status
    if (status === 413) {
      showToast('图片文件过大，请压缩后重试', 'error')
    } else {
      showToast(err?.data?.message || '上传失败，请重试', 'error')
    }
  }
  event.target.value = ''
}

/* ===== AI生成形象图 ===== */
const handleGenerateAvatar = async (index) => {
  if (!ensureAccess({ actionName: '角色形象图生成' })) return
  if (!(await checkModelConfig('image_gen'))) return
  const char = characters.value[index]
  if (!char?.id) { showToast('请先保存角色后再生成头像', 'warning'); return }
  generatingAvatarIndex.value = index

  try {
    if (!char.avatarPrompt || !char.avatarPrompt.trim()) {
      avatarFlowStatus.value = '描述词生成中'
      await generatePromptCore(index, true)
    }

    avatarFlowStatus.value = '形象生成中'
    const res = await $fetch(`${props.apiBase}/api/novel-asset/${char.id}/generate-avatar`, {
      method: 'POST',
      body: { prompt: char.avatarPrompt || '' },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${useUserStore().token}` },
    })
    if (res.code === 200) {
      char.avatar = res.data.avatar
      if (res.data.avatarPrompt) char.avatarPrompt = res.data.avatarPrompt
      showToast('角色图生成成功', 'success')
    } else if (res.code === 4001) {
      triggerGuardDialog(res.message?.includes('图片') ? '图片生成' : '剧本生成')
    } else {
      showToast(res.message || 'AI生成失败', 'error')
    }
  } catch (err) {
    console.error('[NovelCharacterCards] AI生成头像失败:', err)
    const errData = err?.response?._data || err?.data
    if (errData?.code === 4001) {
      triggerGuardDialog(errData.message?.includes('图片') ? '图片生成' : '剧本生成')
    } else {
      showToast(errData?.message || err?.message || 'AI生成失败，请重试', 'error')
    }
  } finally {
    generatingAvatarIndex.value = -1
    avatarFlowStatus.value = ''
  }
}

/* ===== 描述词流式生成核心 ===== */
const generatePromptCore = async (index, skipSaveEmit = false) => {
  const char = characters.value[index]

  const response = await fetch(`${props.apiBase}/api/novel-asset/${char.id}/generate-prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${useUserStore().token}` },
  })

  if (!response.ok) {
    let errorMessage = '请求失败'
    try {
      const errorData = await response.json()
      errorMessage = errorData.message || errorMessage
    } catch (e) { /* 解析失败使用默认消息 */ }

    showToast(`生成失败: ${errorMessage}`, 'error')
    generatingPromptIndex.value = -1
    return
  }

  if (await checkSseResponse(response)) {
    generatingPromptIndex.value = -1
    return
  }

  /* 确认响应为有效 SSE 流后再清空旧描述词 */
  char.avatarPrompt = ''
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

        if (data.content) char.avatarPrompt += data.content
        if (data.done && !skipSaveEmit) emitSave()
        if (data.error) console.error('[NovelCharacterCards] 流式生成描述词错误:', data.error)
      } catch { /* ignore parse error */ }
    }
  }
}

/* ===== 单独点击刷新按钮生成描述词 ===== */
const handleGeneratePrompt = async (index) => {
  const char = characters.value[index]
  if (!char?.id) { showToast('请先保存角色后再生成描述词', 'warning'); return }
  if (!ensureAccess({ actionName: '角色描述词生成' })) return
  if (!(await checkModelConfig('script_gen'))) return
  generatingPromptIndex.value = index
  try {
    await generatePromptCore(index)
  } catch (err) {
    console.error('[NovelCharacterCards] AI生成描述词失败:', err)
  } finally { generatingPromptIndex.value = -1 }
}

/* ===== 描述词textarea自动撑高 ===== */
const autoResizePrompt = () => {
  const el = promptTextareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

/* ===== 手动编辑描述词时的防抖保存 ===== */
let promptSaveTimer = null
const debounceSavePrompt = () => {
  if (promptSaveTimer) clearTimeout(promptSaveTimer)
  promptSaveTimer = setTimeout(async () => {
    const char = activeChar.value
    if (!char?.id) return
    try {
      await $fetch(`${props.apiBase}/api/novel-asset/${char.id}`, {
        method: 'PUT',
        body: { avatarPrompt: char.avatarPrompt || '' },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${useUserStore().token}` },
      })
    } catch (err) {
      console.error('[NovelCharacterCards] 保存描述词失败:', err)
    }
  }, 1000)
}

/* ===== 标签操作 ===== */
const addTag = (char, field) => {
  if (!Array.isArray(char[field])) char[field] = []
  if (char[field].length >= 5) return
  char[field].push({ keyword: '', desc: '' })
}

const removeTag = (arr, idx) => {
  arr.splice(idx, 1)
  emitSave()
}

/* ===== 删除操作 ===== */
const requestDelete = () => {
  showDeleteConfirm.value = true
}

const confirmDelete = async () => {
  const idx = drawerIndex.value
  const char = characters.value[idx]
  if (!char) return

  const charId = char.id
  const charName = char.name || '未命名'

  if (charId && props.projectId && props.apiBase) {
    isDeleting.value = true
    try {
      const token = localStorage.getItem('token')
      await $fetch(`${props.apiBase}/api/novel-project/${props.projectId}/assets/character/${charId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch (err) {
      console.error('[NovelCharacterCards] 删除角色失败:', err)
      showToast('删除失败，请稍后重试', 'error')
      isDeleting.value = false
      showDeleteConfirm.value = false
      return
    }
    isDeleting.value = false
  }

  showDeleteConfirm.value = false
  const list = [...characters.value]
  list.splice(idx, 1)
  drawerIndex.value = -1
  emit('update:modelValue', list)
  emit('save', list)
  showToast(`角色「${charName}」已删除`, 'success')
}

const addCharacter = () => {
  const list = [...characters.value]
  list.push({
    id: '',
    roleType: 'other',
    name: '',
    gender: '',
    age: '',
    personality: [],
    appearance: [],
    relationship: '',
    background: '',
    avatar: '',
    avatarPrompt: '',
    source: 'manual',
  })
  characters.value = list
  drawerIndex.value = list.length - 1
}

defineExpose({ addCharacter })
</script>

<style scoped>
/* ===== 卡片网格 ===== */
.nc-cards__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}

.nc-cards__card {
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

.nc-cards__card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  border-radius: 3px 0 0 3px;
  background: #94a3b8;
  transition: background 0.2s;
}

.nc-cards__card--protagonist::before { background: #6366f1; }
.nc-cards__card--antagonist::before { background: #ef4444; }
.nc-cards__card--ally::before { background: #22c55e; }
.nc-cards__card--lover::before { background: #ec4899; }
.nc-cards__card--rival::before { background: #f59e0b; }

.nc-cards__card:hover {
  border-color: var(--color-border);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  transform: translateY(-1px);
}

.nc-cards__card--active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(255, 107, 53, 0.15);
}

.nc-cards__card-top {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.nc-cards__card-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  color: #fff;
  background: #94a3b8;
  flex-shrink: 0;
}

.nc-cards__card--protagonist .nc-cards__card-badge { background: #6366f1; }
.nc-cards__card--antagonist .nc-cards__card-badge { background: #ef4444; }
.nc-cards__card--ally .nc-cards__card-badge { background: #22c55e; }
.nc-cards__card--lover .nc-cards__card-badge { background: #ec4899; }
.nc-cards__card--rival .nc-cards__card-badge { background: #f59e0b; }

.nc-cards__card-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.nc-cards__card-meta {
  font-size: 11px;
  color: var(--color-text-light);
  white-space: nowrap;
  flex-shrink: 0;
  margin-left: auto;
}

.nc-cards__card-summary {
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

/* ===== 空状态 ===== */
.nc-cards__empty {
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

.nc-cards__empty p {
  font-size: 12px;
  margin: 0;
  text-align: center;
  line-height: 1.6;
}

/* ===== 抽屉 ===== */
.nc-drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(2px);
  display: flex;
  justify-content: flex-end;
}

.nc-drawer {
  width: 580px;
  max-width: 92vw;
  height: 100%;
  background: var(--color-bg-white, #fff);
  box-shadow: -8px 0 30px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.nc-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border-light);
  flex-shrink: 0;
}

.nc-drawer__header--protagonist { border-bottom-color: #6366f1; }
.nc-drawer__header--antagonist { border-bottom-color: #ef4444; }
.nc-drawer__header--ally { border-bottom-color: #22c55e; }
.nc-drawer__header--lover { border-bottom-color: #ec4899; }
.nc-drawer__header--rival { border-bottom-color: #f59e0b; }

.nc-drawer__role-select {
  padding: 5px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  background: var(--color-bg);
  cursor: pointer;
  outline: none;
}

.nc-drawer__role-select:focus {
  border-color: var(--color-primary);
}

.nc-drawer__header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nc-drawer__del-btn {
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

.nc-drawer__del-btn:hover {
  background: #fef2f2;
  border-color: #ef4444;
}

.nc-drawer__close-btn {
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

.nc-drawer__close-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

/* ===== 抽屉主体 ===== */
.nc-drawer__body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  gap: 20px;
}

/* 左列：头像 */
.nc-drawer__avatar-col {
  flex-shrink: 0;
  width: 140px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.nc-drawer__avatar {
  width: 140px;
  height: 200px;
  border-radius: 10px;
  border: 2px dashed var(--color-border);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
  cursor: pointer;
  position: relative;
  transition: border-color 0.2s;
}

.nc-drawer__avatar--has {
  border-style: solid;
  border-color: var(--color-border-light);
}

.nc-drawer__avatar--has:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
}

.nc-drawer__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.nc-drawer__avatar-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--color-text-light);
  font-size: 11px;
}

.nc-drawer__avatar-loading {
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

/* 头像操作按钮 */
.nc-drawer__avatar-actions {
  display: flex;
  gap: 6px;
}

.nc-drawer__avatar-btn {
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

.nc-drawer__avatar-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.nc-drawer__avatar-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nc-drawer__avatar-btn--ai {
  background: #f0f5ff;
  border-color: #91caff;
  color: #1677ff;
}

/* 形象描述词区域 */
.nc-drawer__prompt-box {
  padding: 10px;
  border-radius: 8px;
  background: var(--color-bg);
  border: 1px solid var(--color-border-light);
}

.nc-drawer__prompt-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.nc-drawer__prompt-refresh {
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

.nc-drawer__prompt-refresh:hover:not(:disabled) {
  color: var(--color-primary);
  background: var(--color-primary-bg, rgba(255, 107, 53, 0.06));
}

.nc-drawer__prompt-refresh.is-loading {
  background: var(--color-primary-bg, rgba(255, 107, 53, 0.06));
}

.nc-drawer__prompt-refresh:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.nc-drawer__prompt-input {
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

.nc-drawer__prompt-input:focus {
  border-color: var(--color-primary);
}

/* Spinner */
.nc-cards__spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: nc-spin 0.6s linear infinite;
}

@keyframes nc-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 右列：字段 */
.nc-drawer__fields {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.nc-drawer__row {
  display: flex;
  gap: 10px;
}

.nc-drawer__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nc-drawer__field--grow { flex: 1; min-width: 0; }
.nc-drawer__field--sm { width: 90px; flex-shrink: 0; }

.nc-drawer__label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-light);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.nc-drawer__input {
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

.nc-drawer__input:focus {
  border-color: var(--color-primary);
  background: var(--color-bg-white);
}

.nc-drawer__textarea {
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

.nc-drawer__textarea:focus {
  border-color: var(--color-primary);
  background: var(--color-bg-white);
}

/* ===== 标签编辑 ===== */
.nc-drawer__tags {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nc-drawer__tag-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.nc-drawer__tag-kw {
  width: 80px;
  flex-shrink: 0;
  padding: 5px 8px;
  border: 1px solid var(--color-border);
  border-radius: 5px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text);
  background: var(--color-bg);
  outline: none;
  transition: border-color 0.2s;
}

.nc-drawer__tag-kw:focus { border-color: var(--color-primary); }

.nc-drawer__tag-desc {
  flex: 1;
  min-width: 0;
  padding: 5px 8px;
  border: 1px solid var(--color-border);
  border-radius: 5px;
  font-size: 12px;
  color: var(--color-text);
  background: var(--color-bg);
  outline: none;
  transition: border-color 0.2s;
}

.nc-drawer__tag-desc:focus { border-color: var(--color-primary); }

.nc-drawer__tag-del {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  background: transparent;
  border: none;
  color: var(--color-text-light);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
}

.nc-drawer__tag-del:hover {
  background: #fef2f2;
  color: #ef4444;
}

.nc-drawer__tag-add {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: var(--color-bg);
  border: 1px dashed var(--color-border);
  cursor: pointer;
  transition: all 0.15s;
  align-self: flex-start;
}

.nc-drawer__tag-add:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: rgba(255, 107, 53, 0.04);
}

/* ===== 抽屉动画 ===== */
.nc-drawer-enter-active {
  transition: opacity 0.25s ease;
}
.nc-drawer-enter-active .nc-drawer {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.nc-drawer-leave-active {
  transition: opacity 0.2s ease;
}
.nc-drawer-leave-active .nc-drawer {
  transition: transform 0.2s ease-in;
}
.nc-drawer-enter-from {
  opacity: 0;
}
.nc-drawer-enter-from .nc-drawer {
  transform: translateX(100%);
}
.nc-drawer-leave-to {
  opacity: 0;
}
.nc-drawer-leave-to .nc-drawer {
  transform: translateX(100%);
}
</style>
