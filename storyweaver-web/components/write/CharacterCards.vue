<template>
  <div class="character-cards">
    <div v-if="showHeader" class="character-cards__header">
      <span class="character-cards__title"><Icon name="lucide:drama" size="16" style="vertical-align: middle;" /> 结构化角色卡片</span>
      <div class="character-cards__actions">
        <button
          v-if="showParseButton"
          class="character-cards__btn character-cards__btn--parse"
          :disabled="!charactersText || parsing"
          @click="handleParse"
        >
          {{ parsing ? '解析中...' : '从文本解析' }}
        </button>
        <button
          v-if="showAddButton"
          class="character-cards__btn character-cards__btn--add"
          @click="addCharacter"
        >
          + 添加角色
        </button>
      </div>
    </div>

    <div v-if="characters.length > 0" class="character-cards__grid">
      <button
        v-for="(char, index) in characters"
        :key="char.id || index"
        type="button"
        class="character-cards__card"
        :class="{
          [`character-cards__card--${char.roleType || 'other'}`]: true,
          'character-cards__card--active': activeIndex === index,
        }"
        @click="openDrawer(index)"
      >
        <div class="character-cards__card-top">
          <span class="character-cards__card-role">{{ roleTypeLabels[char.roleType] || '其他' }}</span>
          <span class="character-cards__card-name">{{ char.name || '未命名' }}</span>
          <span v-if="char.gender || char.age" class="character-cards__card-meta">{{ [char.gender, char.age].filter(Boolean).join(' · ') }}</span>
        </div>
        <p class="character-cards__card-desc">{{ getSummary(char) }}</p>
      </button>
    </div>

    <div v-if="characters.length === 0" class="character-cards__empty">
      {{ emptyText }}
    </div>

    <Teleport to="body">
      <Transition name="character-drawer">
        <div v-if="activeChar" v-show="!showGuardDialog" class="character-drawer-overlay" @click.self="closeDrawer">
          <div class="character-drawer">
            <div class="character-drawer__header" :class="`character-drawer__header--${activeChar.roleType || 'other'}`">
              <select
                v-model="activeChar.roleType"
                class="character-drawer__role-select"
                @change="handleFieldChange(activeIndex)"
              >
                <option value="protagonist">主角</option>
                <option value="antagonist">反派</option>
                <option value="ally">朋友/盟友</option>
                <option value="lover">恋人</option>
                <option value="rival">对手/竞争者</option>
                <option value="other">其他</option>
              </select>
              <div class="character-drawer__header-actions">
                <button class="character-drawer__delete-btn" @click="removeCharacter(activeIndex)">删除</button>
                <button class="character-drawer__close-btn" @click="closeDrawer">
                  <Icon name="lucide:x" size="16" />
                </button>
              </div>
            </div>

            <div class="character-drawer__body" :class="{ 'character-drawer__body--no-media': !enableMedia }">
              <div v-if="enableMedia" class="character-drawer__avatar-col">
                <div class="character-drawer__avatar" :class="{ 'character-drawer__avatar--has': activeChar.avatar }" @click="handleAvatarClick">
                  <img
                    v-if="activeChar.avatar"
                    :src="getAvatarUrl(activeChar.avatar)"
                    :alt="activeChar.name"
                    class="character-drawer__avatar-img"
                  />
                  <div v-else class="character-drawer__avatar-empty">
                    <Icon name="lucide:camera" size="20" />
                    <span>暂无形象图</span>
                  </div>
                  <div v-if="avatarFlowStatus && generatingAvatarIndex === activeIndex" class="character-drawer__avatar-loading">
                    {{ avatarFlowStatus }}
                  </div>
                </div>
                <div class="character-drawer__avatar-actions">
                  <button
                    class="character-drawer__avatar-btn"
                    :disabled="generatingAvatarIndex === activeIndex"
                    @click="handleUploadAvatar(activeIndex)"
                  >上传</button>
                  <button
                    class="character-drawer__avatar-btn character-drawer__avatar-btn--ai"
                    :disabled="generatingAvatarIndex !== -1"
                    @click="handleGenerateAvatar(activeIndex)"
                  >AI生成</button>
                </div>
                <input
                  ref="fileInputRef"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style="display: none"
                  @change="onFileSelected($event, activeIndex)"
                />
                <div class="character-drawer__prompt-box">
                  <div class="character-drawer__prompt-title">
                    <label class="character-drawer__label">形象描述词</label>
                    <button
                      class="character-drawer__prompt-refresh"
                      :class="{ 'is-loading': generatingPromptIndex === activeIndex || generatingAvatarIndex === activeIndex }"
                      :disabled="generatingPromptIndex === activeIndex || generatingAvatarIndex === activeIndex"
                      title="AI重新生成描述词"
                      @click="handleGeneratePrompt(activeIndex)"
                    >
                      <svg v-if="generatingPromptIndex !== activeIndex" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="23 4 23 10 17 10"/>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                      </svg>
                      <span v-else class="character-cards__spinner"></span>
                    </button>
                  </div>
                  <textarea
                    ref="promptTextareaRef"
                    v-model="activeChar.avatarPrompt"
                    class="character-drawer__prompt-input"
                    placeholder="角色画像描述词，可手动编辑或AI生成..."
                    @input="autoResizePrompt(); debounceSavePrompt(activeIndex)"
                  ></textarea>
                </div>
              </div>

              <div class="character-drawer__fields">
                <div class="character-drawer__row">
                  <div class="character-drawer__field character-drawer__field--grow">
                    <label class="character-drawer__label">姓名</label>
                    <input v-model="activeChar.name" class="character-drawer__input" placeholder="角色姓名" @blur="handleFieldChange(activeIndex)" />
                  </div>
                  <div class="character-drawer__field character-drawer__field--sm">
                    <label class="character-drawer__label">性别</label>
                    <select v-model="activeChar.gender" class="character-drawer__input" @change="handleFieldChange(activeIndex)">
                      <option value="男">男</option>
                      <option value="女">女</option>
                      <option value="">未设定</option>
                    </select>
                  </div>
                  <div class="character-drawer__field character-drawer__field--sm">
                    <label class="character-drawer__label">年龄</label>
                    <input v-model="activeChar.age" class="character-drawer__input" placeholder="如20岁" @blur="handleFieldChange(activeIndex)" />
                  </div>
                </div>
                <div class="character-drawer__field">
                  <label class="character-drawer__label">性格特点</label>
                  <div class="character-drawer__tags">
                    <div v-for="(p, pIdx) in activeChar.personality" :key="pIdx" class="character-drawer__tag-row">
                      <input v-model="p.keyword" class="character-drawer__tag-keyword" placeholder="关键词" @blur="handleFieldChange(activeIndex)" />
                      <input v-model="p.desc" class="character-drawer__tag-desc" placeholder="描述" @blur="handleFieldChange(activeIndex)" />
                      <button class="character-drawer__tag-del" @click="removeTag(activeChar.personality, pIdx); handleFieldChange(activeIndex)">
                        <Icon name="lucide:x" size="12" />
                      </button>
                    </div>
                    <button class="character-drawer__tag-add" @click="addTag(activeChar.personality)">添加性格</button>
                  </div>
                </div>
                <div class="character-drawer__field">
                  <label class="character-drawer__label">容貌</label>
                  <div class="character-drawer__tags">
                    <div v-for="(a, aIdx) in activeChar.appearance" :key="aIdx" class="character-drawer__tag-row">
                      <input v-model="a.keyword" class="character-drawer__tag-keyword" placeholder="关键词" @blur="handleFieldChange(activeIndex)" />
                      <input v-model="a.desc" class="character-drawer__tag-desc" placeholder="描述" @blur="handleFieldChange(activeIndex)" />
                      <button class="character-drawer__tag-del" @click="removeTag(activeChar.appearance, aIdx); handleFieldChange(activeIndex)">
                        <Icon name="lucide:x" size="12" />
                      </button>
                    </div>
                    <button class="character-drawer__tag-add" @click="addTag(activeChar.appearance)">添加容貌</button>
                  </div>
                </div>
                <div class="character-drawer__field">
                  <label class="character-drawer__label">与主角关系</label>
                  <textarea v-model="activeChar.relationship" class="character-drawer__textarea" placeholder="与主角的关系描述..." rows="2" @blur="handleFieldChange(activeIndex)"></textarea>
                </div>
                <div class="character-drawer__field">
                  <label class="character-drawer__label">人物经历</label>
                  <textarea v-model="activeChar.background" class="character-drawer__textarea" placeholder="人物背景经历..." rows="4" @blur="handleFieldChange(activeIndex)"></textarea>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <ImagePreview
      :show="showPreview"
      :image-url="previewUrl"
      :image-alt="activeChar?.name || '角色形象图'"
      :download-name="`${activeChar?.name || '角色'}_形象图`"
      @close="closePreview"
    />

    <Teleport to="body">
      <Transition name="confirm-fade">
        <div v-if="showDeleteConfirm" class="confirm-overlay" @click.self="cancelDelete">
          <div class="confirm-dialog">
            <div class="confirm-dialog__header">
              <span class="confirm-dialog__icon"><Icon name="lucide:alert-triangle" size="32" color="#f59e0b" /></span>
              <span class="confirm-dialog__title">确认删除</span>
            </div>
            <div class="confirm-dialog__body">
              确定要删除角色「{{ characters[deleteTargetIndex]?.name || '未命名' }}」吗？删除后不可恢复。
            </div>
            <div class="confirm-dialog__footer">
              <button class="confirm-dialog__btn confirm-dialog__btn--cancel" @click="cancelDelete">取消</button>
              <button class="confirm-dialog__btn confirm-dialog__btn--confirm" @click="confirmDelete">确认删除</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="confirm-fade">
        <div v-if="showReparseConfirm" class="confirm-overlay" @click.self="cancelReparse">
          <div class="confirm-dialog reparse-dialog">
            <div class="confirm-dialog__header">
              <span class="confirm-dialog__icon"><Icon name="lucide:refresh-cw" size="16" color="#6366f1" /></span>
              <span class="confirm-dialog__title">重新解析角色</span>
            </div>
            <div class="confirm-dialog__body reparse-dialog__body">
              <!-- 将被更新的角色 -->
              <div v-if="reparsePreviewDiff?.updated?.length" class="reparse-dialog__section">
                <div class="reparse-dialog__label reparse-dialog__label--warn"><Icon name="lucide:file-text" size="14" style="vertical-align: middle;" /> 以下角色信息将被更新：</div>
                <div v-for="item in reparsePreviewDiff.updated" :key="item.name" class="reparse-dialog__item">
                  <span class="reparse-dialog__name">{{ item.name }}</span>
                  <span class="reparse-dialog__fields">（{{ item.changedFields.join('、') }}）</span>
                </div>
              </div>
              <!-- 形象图将被保留 -->
              <div v-if="reparsePreviewDiff?.preserved?.length" class="reparse-dialog__section">
                <div class="reparse-dialog__label reparse-dialog__label--safe"><Icon name="lucide:image" size="14" style="vertical-align: middle;" /> 以下角色的形象图将被保留：</div>
                <div v-for="item in reparsePreviewDiff.preserved" :key="item.name" class="reparse-dialog__item">
                  <span class="reparse-dialog__name">{{ item.name }}</span>
                  <span class="reparse-dialog__tag reparse-dialog__tag--safe">形象图保留</span>
                </div>
              </div>
              <!-- 新增角色 -->
              <div v-if="reparsePreviewDiff?.added?.length" class="reparse-dialog__section">
                <div class="reparse-dialog__label reparse-dialog__label--info">✨ 新增角色：</div>
                <div v-for="item in reparsePreviewDiff.added" :key="item.name" class="reparse-dialog__item">
                  <span class="reparse-dialog__name">{{ item.name }}</span>
                </div>
              </div>
              <!-- 将被删除的角色 -->
              <div v-if="reparsePreviewDiff?.removed?.length" class="reparse-dialog__section">
                <div class="reparse-dialog__label reparse-dialog__label--danger"><Icon name="lucide:trash-2" size="14" style="vertical-align: middle;" /> 以下角色将被删除：</div>
                <div v-for="item in reparsePreviewDiff.removed" :key="item.name" class="reparse-dialog__item">
                  <span class="reparse-dialog__name">{{ item.name }}</span>
                  <span v-if="item.hasAvatar" class="reparse-dialog__tag reparse-dialog__tag--warn">含形象图</span>
                </div>
              </div>
              <!-- 无任何变化 -->
              <div v-if="isNoDiff" class="reparse-dialog__section">
                <div class="reparse-dialog__label reparse-dialog__label--safe"><Icon name="lucide:circle-check" size="14" style="vertical-align: middle;" /> 解析结果与当前角色完全一致，无需更新。</div>
              </div>
            </div>
            <div class="confirm-dialog__footer">
              <button class="confirm-dialog__btn confirm-dialog__btn--cancel" @click="cancelReparse">取消</button>
              <button v-if="!isNoDiff" class="confirm-dialog__btn confirm-dialog__btn--confirm" @click="confirmReparse">确认重新解析</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

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
 * 角色卡片组件（标签式交互）
 * 角色以小按钮排列，点击展开详情卡片，再点击其他角色切换
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
  charactersText: { type: String, default: '' },
  scriptId: { type: String, default: '' },
  apiBase: { type: String, default: '' },
  showHeader: { type: Boolean, default: true },
  showParseButton: { type: Boolean, default: true },
  showAddButton: { type: Boolean, default: true },
  enableMedia: { type: Boolean, default: true },
  emptyText: { type: String, default: '暂无结构化角色数据，可点击「从文本解析」自动提取，或手动添加角色' },
})

const emit = defineEmits(['update:modelValue', 'parse', 'save'])

const characters = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const activeIndex = ref(-1)
const activeChar = computed(() => {
  if (activeIndex.value < 0 || activeIndex.value >= characters.value.length) return null
  return characters.value[activeIndex.value]
})

const parsing = ref(false)
const generatingAvatarIndex = ref(-1)
const generatingPromptIndex = ref(-1)
/** AI生成流程中图片区域的状态文字（'描述词生成中' / '形象生成中' / ''） */
const avatarFlowStatus = ref('')
const fileInputRef = ref(null)
const promptTextareaRef = ref(null)

/** 描述词textarea自动撑高 */
const autoResizePrompt = () => {
  const el = promptTextareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}
/** 大图预览状态 */
const showPreview = ref(false)
const previewUrl = ref('')
/** 删除确认弹窗状态 */
const showDeleteConfirm = ref(false)
const deleteTargetIndex = ref(-1)
/** 重新解析确认弹窗状态 */
const showReparseConfirm = ref(false)
const reparsePreviewDiff = ref(null)

const roleTypeLabels = {
  protagonist: '主角',
  antagonist: '反派',
  ally: '朋友/盟友',
  lover: '恋人',
  rival: '对手/竞争者',
  other: '其他',
}

const openDrawer = async (index) => {
  activeIndex.value = index
  /* 展开时：如果没有描述词，且有足够信息，且已绑定文字模型 → 自动生成；未绑定则静默跳过 */
  if (activeIndex.value >= 0) {
    const char = characters.value[activeIndex.value]
    if (
      char
      && !char.avatarPrompt
      && char.id
      && char.name
      && (char.gender || char.personality?.length || char.appearance?.length)
      && ensureAccess({ actionName: '角色描述词生成', silent: true })
      && await isModelConfigured('script_gen')
    ) {
      handleGeneratePrompt(activeIndex.value)
    }
  }
  nextTick(autoResizePrompt)
}

/* AI流式写入时 avatarPrompt 持续变化，自动撑高 */
watch(() => activeChar.value?.avatarPrompt, () => {
  nextTick(autoResizePrompt)
})

const closeDrawer = () => {
  activeIndex.value = -1
}

const getSummary = (char) => {
  if (char.background) return char.background
  if (char.relationship) return char.relationship
  return '点击查看/编辑角色详情'
}

const getAvatarUrl = (avatar) => {
  if (!avatar) return ''
  if (avatar.startsWith('http')) return avatar
  return `${props.apiBase}${avatar}`
}

/** 点击"从文本解析"：无角色直接解析，有角色先预览对比再确认 */
const handleParse = async () => {
  if (characters.value.length === 0) {
    emit('parse')
    return
  }

  /* 已有角色 → 调 parse-preview 接口获取对比摘要 */
  parsing.value = true
  try {
    const res = await $fetch(`${props.apiBase}/api/script/${props.scriptId}/characters/parse-preview`, {
      method: 'POST',
      body: { text: props.charactersText },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${useUserStore().token}` },
    })
    if (res.code === 200 && res.data?.diff) {
      const diff = res.data.diff
      /* 检查是否完全无变化 */
      const hasNoChange = !diff.updated?.length && !diff.preserved?.length && !diff.added?.length && !diff.removed?.length
      if (hasNoChange) {
        /* 无变化 → 直接toast提示，不弹窗 */
        showToast('解析结果与当前角色完全一致，无需更新', 'success')
      } else {
        /* 有变化 → 显示对比弹窗 */
        reparsePreviewDiff.value = diff
        showReparseConfirm.value = true
      }
    } else {
      /* 没有对比数据（比如文本为空），直接解析 */
      emit('parse')
    }
  } catch (err) {
    console.error('预览解析失败:', err)
    showToast('预览解析失败，请重试', 'error')
  } finally {
    parsing.value = false
  }
}

/** 确认重新解析 */
const confirmReparse = () => {
  showReparseConfirm.value = false
  reparsePreviewDiff.value = null
  emit('parse')
}

/** 取消重新解析 */
const cancelReparse = () => {
  showReparseConfirm.value = false
  reparsePreviewDiff.value = null
}

/** 对比结果是否完全无变化 */
const isNoDiff = computed(() => {
  const d = reparsePreviewDiff.value
  if (!d) return true
  return !d.updated?.length && !d.preserved?.length && !d.added?.length && !d.removed?.length
})

const addCharacter = () => {
  const updated = [...characters.value, {
    id: '', roleType: 'other', name: '', gender: '', age: '',
    personality: [], appearance: [], relationship: '', background: '',
    avatar: '', avatarPrompt: '',
  }]
  characters.value = updated
  activeIndex.value = updated.length - 1
}

/** 点击删除 → 弹出确认弹窗 */
const removeCharacter = (index) => {
  deleteTargetIndex.value = index
  showDeleteConfirm.value = true
}

/** 确认删除角色 */
const confirmDelete = () => {
  const index = deleteTargetIndex.value
  const updated = [...characters.value]
  updated.splice(index, 1)
  characters.value = updated
  activeIndex.value = -1
  emit('save', updated)
  showDeleteConfirm.value = false
  deleteTargetIndex.value = -1
}

/** 取消删除 */
const cancelDelete = () => {
  showDeleteConfirm.value = false
  deleteTargetIndex.value = -1
}

const handleFieldChange = () => { emit('save', characters.value) }
const addTag = (list) => { list.push({ keyword: '', desc: '' }) }
const removeTag = (list, idx) => { list.splice(idx, 1) }
const handleUploadAvatar = () => { fileInputRef.value?.click() }

/** 点击头像区域：无图→上传，AI生成中→不响应，有图→预览大图 */
const handleAvatarClick = () => {
  // AI生成中，不响应点击
  if (generatingAvatarIndex.value === activeIndex.value) return
  if (activeChar.value?.avatar) {
    // 有图片 → 打开大图预览
    previewUrl.value = getAvatarUrl(activeChar.value.avatar)
    showPreview.value = true
  } else {
    // 无图片 → 触发本地上传
    fileInputRef.value?.click()
  }
}

/** 关闭大图预览 */
const closePreview = () => {
  showPreview.value = false
  previewUrl.value = ''
}

const onFileSelected = async (event, index) => {
  const file = event.target.files[0]
  if (!file) return
  /* 前端校验文件大小（5MB） */
  if (file.size > 5 * 1024 * 1024) {
    showToast('图片不能超过5MB，请压缩后重试', 'warning')
    event.target.value = ''
    return
  }
  const char = characters.value[index]
  if (!char.id) { showToast('请先保存角色后再上传头像', 'warning'); return }
  const formData = new FormData()
  formData.append('file', file)
  try {
    const res = await $fetch(`${props.apiBase}/api/script-character/${char.id}/upload-avatar`, {
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
    console.error('上传头像失败:', err)
    const status = err?.response?.status || err?.status
    if (status === 413) {
      showToast('图片文件过大，请压缩后重试', 'error')
    } else {
      showToast(err?.data?.message || '上传失败，请重试', 'error')
    }
  }
  event.target.value = ''
}

/** 防抖保存单个角色的描述词（手动编辑时触发） */
let promptSaveTimer = null
const debounceSavePrompt = (index) => {
  if (promptSaveTimer) clearTimeout(promptSaveTimer)
  promptSaveTimer = setTimeout(async () => {
    const char = characters.value[index]
    if (!char?.id) return
    try {
      await $fetch(`${props.apiBase}/api/script-character/${char.id}`, {
        method: 'PUT',
        body: { avatarPrompt: char.avatarPrompt || '' },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${useUserStore().token}` },
      })
    } catch (err) {
      console.error('保存描述词失败:', err)
    }
  }, 1000)
}

/** AI生成形象图（串联流程：无描述词时先生成描述词再生成形象图） */
const handleGenerateAvatar = async (index) => {
  if (!ensureAccess({ actionName: '角色形象图生成' })) return
  if (!(await checkModelConfig('image_gen'))) return
  const char = characters.value[index]
  if (!char.id) { showToast('请先保存角色后再生成头像', 'warning'); return }
  generatingAvatarIndex.value = index

  try {
    if (!char.avatarPrompt || !char.avatarPrompt.trim()) {
      avatarFlowStatus.value = '描述词生成中'
      await generatePromptCore(index, true)
    }

    avatarFlowStatus.value = '形象生成中'
    const res = await $fetch(`${props.apiBase}/api/script-character/${char.id}/generate-avatar`, {
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
    console.error('AI生成头像失败:', err)
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

/** 描述词流式生成核心逻辑（供单独生成和AI生成流程复用）
 *  @param {number} index - 角色索引
 *  @param {boolean} skipSaveEmit - 是否跳过完成后的save事件（AI生成流程中由外层控制保存）
 */
const generatePromptCore = async (index, skipSaveEmit = false) => {
  const char = characters.value[index]

  const response = await fetch(`${props.apiBase}/api/script-character/${char.id}/generate-prompt`, {
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

  /* 检查是否为模型未配置错误（后端返回 JSON 而非 SSE） */
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
        if (data.done && !skipSaveEmit) emit('save', characters.value)
        if (data.error) console.error('流式生成描述词错误:', data.error)
      } catch { /* ignore parse error */ }
    }
  }
}

/** 单独点击刷新按钮 - AI生成角色描述词（不触发图片区域状态） */
const handleGeneratePrompt = async (index) => {
  const char = characters.value[index]
  if (!char.id) { showToast('请先保存角色后再生成描述词', 'warning'); return }
  if (!ensureAccess({ actionName: '角色描述词生成' })) return
  if (!(await checkModelConfig('script_gen'))) return
  generatingPromptIndex.value = index
  try {
    await generatePromptCore(index)
  } catch (err) {
    console.error('AI生成描述词失败:', err)
  } finally { generatingPromptIndex.value = -1 }
}

defineExpose({
  addCharacter,
  triggerParse: handleParse,
})
</script>

<style scoped>
.character-cards { margin-top: 0; }

.character-cards__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.character-cards__title { font-size: 13px; font-weight: 600; color: var(--color-text-primary, #333); }
.character-cards__actions { display: flex; gap: 8px; }

.character-cards__btn {
  font-size: 12px; padding: 4px 12px; border-radius: 4px;
  border: 1px solid var(--color-border, #ddd); background: #fff;
  cursor: pointer; transition: all 0.2s;
}
.character-cards__btn:hover:not(:disabled) { border-color: #1677ff; color: #1677ff; }
.character-cards__btn:disabled { opacity: 0.5; cursor: not-allowed; }
.character-cards__btn--parse { background: #f0f5ff; border-color: #91caff; color: #1677ff; }
.character-cards__btn--add { background: #f6ffed; border-color: #b7eb8f; color: #52c41a; }

/* 角色卡片网格 - 左色条风格（对齐小说转剧本） */
.character-cards__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.character-cards__card {
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

.character-cards__card::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  border-radius: 3px 0 0 3px;
  background: #94a3b8;
  transition: background 0.2s;
}

.character-cards__card--protagonist::before { background: #6366f1; }
.character-cards__card--antagonist::before { background: #ef4444; }
.character-cards__card--ally::before { background: #22c55e; }
.character-cards__card--lover::before { background: #ec4899; }
.character-cards__card--rival::before { background: #f59e0b; }

.character-cards__card:hover {
  border-color: var(--color-border, #ccc);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  transform: translateY(-1px);
}

.character-cards__card--active {
  border-color: var(--color-primary, #ff6b35);
  box-shadow: 0 0 0 2px rgba(255, 107, 53, 0.15);
}

.character-cards__card-top {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.character-cards__card-role {
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

.character-cards__card--protagonist .character-cards__card-role { background: #6366f1; }
.character-cards__card--antagonist .character-cards__card-role { background: #ef4444; }
.character-cards__card--ally .character-cards__card-role { background: #22c55e; }
.character-cards__card--lover .character-cards__card-role { background: #ec4899; }
.character-cards__card--rival .character-cards__card-role { background: #f59e0b; }

.character-cards__card-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text, #222);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.character-cards__card-meta {
  font-size: 11px;
  color: var(--color-text-light, #888);
  white-space: nowrap;
  flex-shrink: 0;
  margin-left: auto;
}

.character-cards__card-desc {
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
.character-cards__empty {
  text-align: center; padding: 24px; color: #999; font-size: 12px;
  background: #fafafa; border-radius: 8px; border: 1px dashed #e8e8e8;
}

/* Spinner */
.character-cards__spinner {
  width: 14px; height: 14px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: character-spin 0.6s linear infinite;
}

@keyframes character-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>

<!-- 抽屉 + 弹窗样式（Teleport to body 需要 non-scoped） -->
<style>
/* ========== 角色详情抽屉 ========== */
.character-drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(2px);
  display: flex;
  justify-content: flex-end;
}

.character-drawer {
  width: 580px;
  max-width: 92vw;
  height: 100%;
  background: var(--color-bg-white, #fff);
  box-shadow: -8px 0 30px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.character-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border-light);
  flex-shrink: 0;
}

.character-drawer__header--protagonist { border-bottom-color: #6366f1; }
.character-drawer__header--antagonist { border-bottom-color: #ef4444; }
.character-drawer__header--ally { border-bottom-color: #22c55e; }
.character-drawer__header--lover { border-bottom-color: #ec4899; }
.character-drawer__header--rival { border-bottom-color: #f59e0b; }

.character-drawer__role-select {
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

.character-drawer__role-select:focus { border-color: var(--color-primary); }

.character-drawer__header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.character-drawer__delete-btn {
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

.character-drawer__delete-btn:hover {
  background: #fef2f2;
  border-color: #ef4444;
}

.character-drawer__close-btn {
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

.character-drawer__close-btn:hover {
  background: var(--color-bg-hover, #f0f0f0);
  color: var(--color-text);
}

/* 抽屉主体 */
.character-drawer__body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  gap: 20px;
}

.character-drawer__body--no-media .character-drawer__fields { width: 100%; }

/* 左列：头像区（写剧本版 - 含上传/AI生成） */
.character-drawer__avatar-col {
  flex-shrink: 0;
  width: 140px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.character-drawer__avatar {
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

.character-drawer__avatar--has {
  border-style: solid;
  border-color: var(--color-border-light);
}

.character-drawer__avatar--has:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
}

.character-drawer__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.character-drawer__avatar-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--color-text-light);
  font-size: 11px;
}

.character-drawer__avatar-loading {
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

.character-drawer__avatar-actions {
  display: flex;
  gap: 6px;
}

.character-drawer__avatar-btn {
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

.character-drawer__avatar-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.character-drawer__avatar-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.character-drawer__avatar-btn--ai {
  background: #f0f5ff;
  border-color: #91caff;
  color: #1677ff;
}

/* 形象描述词区域 */
.character-drawer__prompt-box {
  padding: 10px;
  border-radius: 8px;
  background: var(--color-bg);
  border: 1px solid var(--color-border-light);
}

.character-drawer__prompt-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.character-drawer__prompt-refresh {
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

.character-drawer__prompt-refresh:hover:not(:disabled) {
  color: var(--color-primary);
  background: var(--color-primary-bg, rgba(255, 107, 53, 0.06));
}

.character-drawer__prompt-refresh.is-loading {
  background: var(--color-primary-bg, rgba(255, 107, 53, 0.06));
}

.character-drawer__prompt-refresh:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.character-drawer__prompt-input {
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

.character-drawer__prompt-input:focus { border-color: var(--color-primary); }

/* 右列：字段编辑区 */
.character-drawer__label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-light);
  display: block;
  margin-bottom: 4px;
  letter-spacing: 0.3px;
}

.character-drawer__fields {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.character-drawer__row { display: flex; gap: 10px; }

.character-drawer__field { display: flex; flex-direction: column; gap: 4px; }
.character-drawer__field--grow { flex: 1; min-width: 0; }
.character-drawer__field--sm { width: 90px; flex-shrink: 0; }

.character-drawer__input {
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

.character-drawer__input:focus {
  border-color: var(--color-primary);
  background: var(--color-bg-white);
}

.character-drawer__textarea {
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

.character-drawer__textarea:focus {
  border-color: var(--color-primary);
  background: var(--color-bg-white);
}

/* 标签编辑 */
.character-drawer__tags { display: flex; flex-direction: column; gap: 6px; }

.character-drawer__tag-row { display: flex; gap: 6px; align-items: center; }

.character-drawer__tag-keyword {
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

.character-drawer__tag-keyword:focus { border-color: var(--color-primary); }

.character-drawer__tag-desc {
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

.character-drawer__tag-desc:focus { border-color: var(--color-primary); }

.character-drawer__tag-del {
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

.character-drawer__tag-del:hover { background: #fef2f2; color: #ef4444; }

.character-drawer__tag-add {
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

.character-drawer__tag-add:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: rgba(255, 107, 53, 0.04);
}

/* 抽屉滑入/滑出动画 */
.character-drawer-enter-active { transition: opacity 0.25s ease; }
.character-drawer-enter-active .character-drawer { transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1); }
.character-drawer-leave-active { transition: opacity 0.2s ease; }
.character-drawer-leave-active .character-drawer { transition: transform 0.2s ease-in; }
.character-drawer-enter-from { opacity: 0; }
.character-drawer-enter-from .character-drawer { transform: translateX(100%); }
.character-drawer-leave-to { opacity: 0; }
.character-drawer-leave-to .character-drawer { transform: translateX(100%); }

/* ========== 删除确认弹窗 ========== */
.confirm-overlay {
  position: fixed; inset: 0; z-index: 10000;
  background: rgba(0, 0, 0, 0.45); backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center;
}
.confirm-dialog {
  background: #fff; border-radius: 12px; padding: 24px;
  width: 360px; max-width: 90vw;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}
.confirm-dialog__header {
  display: flex; align-items: center; gap: 8px; margin-bottom: 12px;
}
.confirm-dialog__icon { font-size: 20px; }
.confirm-dialog__title { font-size: 16px; font-weight: 600; color: #333; }
.confirm-dialog__body {
  font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 20px;
}
.confirm-dialog__footer {
  display: flex; justify-content: flex-end; gap: 10px;
}
.confirm-dialog__btn {
  padding: 7px 20px; border-radius: 6px; font-size: 13px;
  cursor: pointer; transition: all 0.2s; border: 1px solid #d9d9d9;
}
.confirm-dialog__btn--cancel {
  background: #fff; color: #666;
}
.confirm-dialog__btn--cancel:hover { border-color: #1677ff; color: #1677ff; }
.confirm-dialog__btn--confirm {
  background: #ff4d4f; border-color: #ff4d4f; color: #fff;
}
.confirm-dialog__btn--confirm:hover { background: #ff7875; border-color: #ff7875; }

/* 确认弹窗过渡动画 */
.confirm-fade-enter-active { transition: all 0.25s ease-out; }
.confirm-fade-leave-active { transition: all 0.2s ease-in; }
.confirm-fade-enter-from { opacity: 0; }
.confirm-fade-leave-to { opacity: 0; }
.confirm-fade-enter-from .confirm-dialog { transform: scale(0.9) translateY(-10px); }
.confirm-fade-enter-active .confirm-dialog {
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.confirm-fade-leave-to .confirm-dialog { transform: scale(0.95); }

/* ========== 重新解析确认弹窗 ========== */
.reparse-dialog { width: 440px; max-width: 92vw; }
.reparse-dialog__body {
  max-height: 360px; overflow-y: auto;
  font-size: 13px; line-height: 1.7; color: #555;
}
.reparse-dialog__section { margin-bottom: 14px; }
.reparse-dialog__section:last-child { margin-bottom: 0; }
.reparse-dialog__label {
  font-size: 13px; font-weight: 600; margin-bottom: 4px;
}
.reparse-dialog__label--warn { color: #fa8c16; }
.reparse-dialog__label--safe { color: #52c41a; }
.reparse-dialog__label--info { color: #1677ff; }
.reparse-dialog__label--danger { color: #ff4d4f; }
.reparse-dialog__item {
  padding: 2px 0 2px 16px; display: flex; align-items: center; gap: 6px;
}
.reparse-dialog__name { font-weight: 500; color: #333; }
.reparse-dialog__fields { color: #888; font-size: 12px; }
.reparse-dialog__tag {
  font-size: 11px; padding: 1px 6px; border-radius: 4px; white-space: nowrap;
}
.reparse-dialog__tag--safe { background: #f6ffed; color: #52c41a; border: 1px solid #b7eb8f; }
.reparse-dialog__tag--warn { background: #fff7e6; color: #fa8c16; border: 1px solid #ffd591; }
</style>
