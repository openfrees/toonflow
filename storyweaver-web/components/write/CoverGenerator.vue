<template>
  <div class="cover-gen">
    <!-- 标题行 -->
    <div class="cover-gen__header">
      <h3 class="cover-gen__title">封面图生成</h3>
      <button class="cover-gen__gen-btn" :disabled="coverFlowActive || generatingImage" @click="handleGenerate">
        <svg v-if="!coverFlowActive && !generatingImage" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
        <span v-if="coverFlowActive || generatingImage" class="cover-gen__spinner"></span>
        {{ coverFlowActive && generatingPrompt ? '描述生成中...' : (generatingImage ? '封面生成中...' : '生成') }}
      </button>
    </div>

    <!-- 封面预览区 -->
    <div class="cover-gen__preview">
      <!-- 有封面图 -->
      <img v-if="coverUrl" :src="fullCoverUrl" alt="封面图" class="cover-gen__image" @click="handlePreviewCover" />
      <!-- 封面流程中：描述词生成阶段 -->
      <div v-else-if="coverFlowActive && generatingPrompt" class="cover-gen__empty">
        <span class="cover-gen__spinner cover-gen__spinner--large"></span>
        <span class="cover-gen__empty-text">描述词生成中...</span>
      </div>
      <!-- 封面图生成中 -->
      <div v-else-if="generatingImage" class="cover-gen__empty">
        <span class="cover-gen__spinner cover-gen__spinner--large"></span>
        <span class="cover-gen__empty-text">封面图生成中...</span>
      </div>
      <!-- 空状态 -->
      <div v-else class="cover-gen__empty">
        <svg class="cover-gen__empty-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        <span class="cover-gen__empty-text">点击生成按钮自动生成封面</span>
      </div>
    </div>

    <!-- 图片预览弹窗 -->
    <ImagePreview
      :show="showPreview"
      :image-url="fullCoverUrl"
      image-alt="封面图"
      download-name="封面图"
      @close="showPreview = false"
    />

    <!-- 描述输入框 -->
    <div class="cover-gen__input-wrap">
      <textarea
        v-model="prompt"
        class="cover-gen__textarea"
        rows="3"
        placeholder="AI将根据剧本信息自动生成描述词..."
        :readonly="generatingPrompt"
      />
      <!-- 右下角刷新按钮：重新生成描述词 -->
      <button class="cover-gen__refresh-btn" :class="{ 'is-loading': generatingPrompt }" :disabled="generatingPrompt || generatingImage" @click="handleGeneratePrompt" title="重新生成描述词">
        <svg v-if="!generatingPrompt" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        <span v-else class="cover-gen__spinner cover-gen__spinner--small"></span>
      </button>
    </div>

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
 * 封面图生成组件
 * 流程：点击生成 → AI流式生成描述词 → 描述词写入textarea → 自动调用生成封面图接口
 */
import ImagePreview from '~/components/common/ImagePreview.vue'

/** 后端API基础地址（从 runtimeConfig 读取） */
const API_BASE = useRuntimeConfig().public.apiBase

const props = defineProps({
  /* 剧本ID（混淆后的） */
  scriptId: { type: String, required: true },
  /* 初始封面图路径（从剧本数据中传入） */
  initialCover: { type: String, default: '' },
  /* 初始描述词（从剧本数据中传入） */
  initialPrompt: { type: String, default: '' },
  /* 项目类型：'script'=自己写剧本, 'novel'=小说转剧本 */
  type: { type: String, default: 'script' },
})

/* 描述文本 */
const prompt = ref('')

/* 生成状态 */
const generatingPrompt = ref(false)
const generatingImage = ref(false)
/* 是否处于「封面图生成」完整流程中（从生成按钮触发，含描述词→封面图连续步骤） */
const coverFlowActive = ref(false)

/* 封面图URL */
const coverUrl = ref('')

/* 预览弹窗状态 */
const showPreview = ref(false)

/* 全局Toast */
const { showToast } = useToast()
const {
  guardDialog,
  handleGuardConfirm,
  ensureAccess,
} = useAccessGuard()
const { checkSseResponse, checkModelConfig, triggerGuardDialog } = useModelGuard()

/* 拼接完整封面图URL */
const fullCoverUrl = computed(() => {
  if (!coverUrl.value) return ''
  if (coverUrl.value.startsWith('http')) return coverUrl.value
  return `${API_BASE}${coverUrl.value}`
})

/* 初始化：从props恢复数据 */
onMounted(() => {
  if (props.initialCover) coverUrl.value = props.initialCover
  if (props.initialPrompt) prompt.value = props.initialPrompt
})

/* 监听props变化（剧本数据异步加载后更新，或重写时清空） */
watch(() => props.initialCover, (val) => {
  if (val) {
    coverUrl.value = val
  } else if (coverUrl.value) {
    /* 父组件主动清空（重写场景） */
    coverUrl.value = ''
  }
})
watch(() => props.initialPrompt, (val) => {
  if (val) {
    prompt.value = val
  } else if (prompt.value) {
    /* 父组件主动清空（重写场景） */
    prompt.value = ''
  }
})

/**
 * 主生成按钮：直接调用生成封面图接口
 */
const handleGenerate = async () => {
  if (generatingImage.value || generatingPrompt.value || coverFlowActive.value) return
  if (!ensureAccess({ actionName: '封面图生成' })) return
  try {
    /* 没有描述词 → 先流式生成描述词，完成后自动接着生成封面图 */
    if (!prompt.value.trim()) {
      coverFlowActive.value = true
      await handleGeneratePrompt()
      if (!prompt.value.trim()) return
    }
    await handleGenerateImage()
  } finally {
    coverFlowActive.value = false
  }
}

/**
 * 生成封面描述词（流式SSE）
 */
const handleGeneratePrompt = async () => {
  if (generatingPrompt.value) return
  if (!ensureAccess({ actionName: '封面描述词生成' })) return

  generatingPrompt.value = true
  /* 不立即清空描述词，等流式数据首次返回时再清空 */
  let firstChunk = true

  const token = localStorage.getItem('token')

  try {
    const response = await fetch(`${API_BASE}/api/cover/generate-prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ scriptId: props.scriptId, type: props.type }),
    })

    if (!response.ok) {
      let errorMessage = '请求失败'
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorMessage
      } catch (e) { /* 解析失败使用默认消息 */ }

      showToast(`描述词生成失败: ${errorMessage}`, 'error')
      generatingPrompt.value = false
      return
    }

    /* 检查是否为模型未配置错误（后端返回 JSON 而非 SSE） */
    if (await checkSseResponse(response)) {
      generatingPrompt.value = false
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let hasCover = false

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const jsonStr = line.slice(6).trim()
        if (!jsonStr) continue

        try {
          const data = JSON.parse(jsonStr)

          if (data.done) {
            /* 流式完成，检查是否已有封面图 */
            hasCover = !!data.coverUrl
            break
          }
          if (data.error) {
            showToast(`描述词生成失败: ${data.error}`)
            break
          }
          if (data.content) {
            /* 首次收到流式数据时才清空旧描述词 */
            if (firstChunk) {
              prompt.value = ''
              firstChunk = false
            }
            /* 流式追加描述词到textarea */
            prompt.value += data.content
          }
        } catch (e) { /* 忽略解析错误 */ }
      }
    }

    /* 描述词生成完成 */
  } catch (err) {
    showToast('生成描述词请求失败，请重试')
  } finally {
    generatingPrompt.value = false
  }
}

/**
 * 生成封面图（调用后端接口）
 */
const handleGenerateImage = async () => {
  if (generatingImage.value) return
  if (!(await checkModelConfig('image_gen'))) return

  generatingImage.value = true
  const token = localStorage.getItem('token')

  try {
    const res = await $fetch(`${API_BASE}/api/cover/generate-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: { scriptId: props.scriptId, type: props.type },
    })

    if (res.code === 200 && res.data?.cover) {
      coverUrl.value = res.data.cover
    } else if (res.code === 4001) {
      triggerGuardDialog(res.message?.includes('图片') ? '图片生成' : '剧本生成')
    } else {
      showToast(res.message || '封面图生成失败')
    }
  } catch (err) {
    const errData = err?.response?._data || err?.data
    if (errData?.code === 4001) {
      triggerGuardDialog(errData.message?.includes('图片') ? '图片生成' : '剧本生成')
    } else {
      const msg = errData?.message || err.message || '封面图生成失败，请重试'
      showToast(msg)
    }
  } finally {
    generatingImage.value = false
  }
}

/**
 * 点击封面图 → 打开预览
 */
const handlePreviewCover = () => {
  if (coverUrl.value) {
    showPreview.value = true
  }
}
</script>

<style scoped>
/* 封面生成卡片 */
.cover-gen {
  background: var(--color-bg-white);
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  padding: 20px;
}

/* 标题行 */
.cover-gen__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border-light);
}

.cover-gen__title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
}

/* 生成按钮 */
.cover-gen__gen-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  background: var(--color-primary-gradient);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.cover-gen__gen-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 3px 10px rgba(255, 107, 53, 0.3);
}

.cover-gen__gen-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 加载动画 */
.cover-gen__spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: cover-spin 0.6s linear infinite;
}

@keyframes cover-spin {
  to { transform: rotate(360deg); }
}

/* 大号加载动画（封面预览区用） */
.cover-gen__spinner--large {
  width: 28px;
  height: 28px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
}

/* 小号加载动画（刷新按钮用） */
.cover-gen__spinner--small {
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: cover-spin 0.6s linear infinite;
}

/* 封面预览区 */
.cover-gen__preview {
  width: 100%;
  aspect-ratio: 3 / 4;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--color-bg);
  border: 1px dashed var(--color-border);
  margin-bottom: 14px;
}

.cover-gen__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer;
  transition: transform 0.2s;
}

.cover-gen__image:hover {
  transform: scale(1.02);
}

/* 空状态 */
.cover-gen__empty {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.cover-gen__empty-icon {
  color: var(--color-text-light);
  opacity: 0.5;
}

.cover-gen__empty-text {
  font-size: 12px;
  color: var(--color-text-light);
}

/* 描述输入框容器 */
.cover-gen__input-wrap {
  position: relative;
}

.cover-gen__textarea {
  width: 100%;
  height: calc(1.5em * 3 + 20px); /* 3行高度 */
  padding: 10px 12px;
  padding-right: 36px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--color-text);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  resize: none;
  overflow-y: auto;
  font-family: inherit;
  transition: border-color 0.2s;
}

.cover-gen__textarea:focus {
  outline: none;
  border-color: var(--color-primary-light);
}

.cover-gen__textarea::placeholder {
  color: var(--color-text-light);
}

/* 右下角刷新按钮 */
.cover-gen__refresh-btn {
  position: absolute;
  right: 6px;
  bottom: 6px;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: 4px;
  color: var(--color-text-light);
  cursor: pointer;
  transition: all 0.2s;
}

.cover-gen__refresh-btn:hover:not(:disabled) {
  color: var(--color-primary);
  background: var(--color-primary-bg);
}

.cover-gen__refresh-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
