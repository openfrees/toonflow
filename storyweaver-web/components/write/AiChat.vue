<template>
  <div class="ai-chat">
    <!-- 聊天头部 -->
    <div class="ai-chat__header">
      <div class="ai-chat__header-left">
        <Icon name="lucide:bot" class="ai-chat__header-icon" size="18" />
        <span class="ai-chat__header-title">创作助手</span>
      </div>
      <div class="ai-chat__header-status">
        <span class="ai-chat__status-dot" :class="{ 'ai-chat__status-dot--busy': isStreaming }"></span>
        <span class="ai-chat__status-text">{{ isStreaming ? '生成中' : '在线' }}</span>
      </div>
    </div>

    <!-- 消息列表 -->
    <div ref="messagesRef" class="ai-chat__messages" @scroll="handleScroll">
      <!-- 欢迎消息 -->
      <div v-if="messages.length === 0" class="ai-chat__welcome">
        <div class="ai-chat__welcome-icon">✨</div>
        <h4 class="ai-chat__welcome-title">你好，我是AI创作助手</h4>
        <p class="ai-chat__welcome-desc">告诉我你想生成剧本的哪个部分，我来帮你完成。</p>
        <div class="ai-chat__quick-actions">
          <button
            v-for="action in quickActions"
            :key="action"
            class="ai-chat__quick-btn"
            @click="handleQuickAction(action)"
          >{{ action }}</button>
        </div>
      </div>

      <!-- 消息气泡 -->
      <div
        v-for="(msg, index) in messages"
        :key="index"
        class="ai-chat__bubble"
        :class="`ai-chat__bubble--${msg.role}`"
      >
        <div class="ai-chat__bubble-content">
          <span v-if="msg.role === 'assistant'" class="ai-chat__bubble-name">编剧助手</span>
          <div class="ai-chat__bubble-text" v-html="renderContent(msg)"></div>
          <span class="ai-chat__bubble-time">{{ msg.time }}</span>
        </div>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="ai-chat__input-area">
      <div class="ai-chat__input-wrap">
        <textarea
          v-model="inputText"
          class="ai-chat__input"
          placeholder="输入你的需求，如：帮我生成剧情梗概..."
          rows="3"
          @keydown.enter.exact.prevent="handleSend"
        ></textarea>
        <button
          v-if="isStreaming"
          class="ai-chat__stop-btn"
          @click="stopStream"
        >
          <span>■</span>
        </button>
        <button
          v-else
          class="ai-chat__send-btn"
          :disabled="!inputText.trim()"
          @click="handleSend"
        >
          <span class="ai-chat__send-icon">➤</span>
        </button>
      </div>
      <p class="ai-chat__input-tip">按 Enter 发送，Shift+Enter 换行</p>
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
 * AI聊天组件
 * 对接后端DeepSeek流式接口，实时渲染AI回复
 */
const props = defineProps({
  scriptId: { type: String, required: true },
  /** AI流式回调选项，透传给 useAiChat */
  streamCallbacks: { type: Object, default: () => ({}) },
  /** 发送前由父组件补全“继续”类模糊指令 */
  resolveOutgoingMessage: { type: Function, default: null },
})

const emit = defineEmits(['generate'])

const { showToast } = useToast()
const {
  guardDialog,
  handleGuardConfirm,
  ensureAccess,
} = useAccessGuard()

/* 构建流式回调：通用错误透传 */
const mergedCallbacks = computed(() => ({
  ...props.streamCallbacks,
  onError: (data) => {
    const msg = data?.message || data?.error || '请求失败'
    showToast(msg, 'error')
    props.streamCallbacks.onError?.(data)
  },
}))

/* 使用AI对话composable，透传流式回调 */
const { messages, isStreaming, loadHistory, sendMessage, stopStream, clearHistory } = useAiChat(props.scriptId, mergedCallbacks.value)

/* 输入文本 */
const inputText = ref('')

/* 消息列表DOM引用 */
const messagesRef = ref(null)

/* 用户是否处于底部附近（阈值50px），默认true */
const isNearBottom = ref(true)

/* 快捷操作 */
const quickActions = [
  '生成剧情梗概',
  '生成人物介绍',
  '生成剧情线',
  '生成分集大纲',
]

/* 判断滚动容器是否在底部附近 */
const checkIfNearBottom = () => {
  const el = messagesRef.value
  if (!el) return true
  const threshold = 50
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold
}

/* 监听滚动事件，更新是否在底部的状态 */
const handleScroll = () => {
  isNearBottom.value = checkIfNearBottom()
}

/* 自动滚动到底部（仅在用户处于底部时触发） */
const scrollToBottom = (force = false) => {
  nextTick(() => {
    if (messagesRef.value && (force || isNearBottom.value)) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
      isNearBottom.value = true
    }
  })
}

/* 监听消息变化，智能滚动 */
watch(messages, () => { scrollToBottom() }, { deep: true })

/* 简单的markdown渲染（换行转br，加粗，标题） */
const renderContent = (msg) => {
  if (msg.role === 'user') return escapeHtml(msg.content)
  let text = escapeHtml(msg.content)
  text = text.replace(/\n/g, '<br>')
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/#{1,3}\s(.+?)(<br>|$)/g, '<strong>$1</strong>$2')
  return text
}

/* HTML转义防XSS */
const escapeHtml = (str) => {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/* 发送前让父组件有机会把“继续”改写成更明确的任务 */
const prepareOutgoingMessage = (message) => {
  const raw = String(message || '').trim()
  if (!raw) return ''
  try {
    const resolved = props.resolveOutgoingMessage ? props.resolveOutgoingMessage(raw) : raw
    return typeof resolved === 'string' && resolved.trim() ? resolved.trim() : raw
  } catch (e) {
    console.error('解析发送消息失败:', e)
    return raw
  }
}

/* 处理快捷操作 */
const handleQuickAction = async (action) => {
  if (!ensureAccess({ actionName: '创作助手聊天' })) return
  const started = await sendMessage(prepareOutgoingMessage(action))
  if (started === false) return
  scrollToBottom(true)
}

/* 处理发送（模型检查通过后才清空输入框） */
const handleSend = async () => {
  const text = inputText.value.trim()
  if (!text || isStreaming.value) return
  if (!ensureAccess({ actionName: '创作助手聊天' })) return
  const started = await sendMessage(prepareOutgoingMessage(text))
  if (started === false) return
  inputText.value = ''
  scrollToBottom(true)
}

/* 生成中离开页面拦截：浏览器原生 beforeunload */
const onBeforeUnload = (e) => {
  if (isStreaming.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}

/* 加载历史记录 */
onMounted(async () => {
  window.addEventListener('beforeunload', onBeforeUnload)
  await loadHistory()
  scrollToBottom(true)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
})

/* 暴露方法给父组件（用于初始消息自动发送、重写时清空历史） */
const guardedSendMessage = async (content) => {
  if (!content || isStreaming.value) return
  if (!ensureAccess({ actionName: '创作助手聊天' })) return
  await sendMessage(prepareOutgoingMessage(content))
}

defineExpose({ sendMessage: guardedSendMessage, clearHistory, isStreaming })
</script>

<style scoped>
/* AI聊天组件 */
.ai-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-white);
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.ai-chat__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--color-border-light);
  flex-shrink: 0;
}

.ai-chat__header-left { display: flex; align-items: center; gap: 8px; }
.ai-chat__header-icon { font-size: 18px; }
.ai-chat__header-title { font-size: 14px; font-weight: 700; color: var(--color-text); }
.ai-chat__header-status { display: flex; align-items: center; gap: 6px; }

.ai-chat__status-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--color-success);
  animation: pulse 2s infinite;
}
.ai-chat__status-dot--busy { background: #f59e0b; }

@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

.ai-chat__status-text { font-size: 11px; color: var(--color-success); }

.ai-chat__messages {
  flex: 1; overflow-y: auto; padding: 16px;
  display: flex; flex-direction: column; gap: 2px;
}

.ai-chat__welcome {
  display: flex; flex-direction: column; align-items: center;
  text-align: center; padding: 32px 16px;
}
.ai-chat__welcome-icon { font-size: 36px; margin-bottom: 12px; }
.ai-chat__welcome-title { font-size: 15px; font-weight: 700; color: var(--color-text); margin-bottom: 6px; }
.ai-chat__welcome-desc { font-size: 12px; color: var(--color-text-secondary); margin-bottom: 20px; }
.ai-chat__quick-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }

.ai-chat__quick-btn {
  padding: 8px 16px; border-radius: 20px; font-size: 12px;
  background: var(--color-bg); color: var(--color-text-secondary);
  border: 1px solid var(--color-border); transition: all 0.2s;
}
.ai-chat__quick-btn:hover {
  background: var(--color-primary-bg); color: var(--color-primary);
  border-color: rgba(255, 107, 53, 0.3);
}

.ai-chat__bubble { display: flex; gap: 10px; max-width: 100%; }
.ai-chat__bubble--user { align-self: flex-end; flex-direction: row-reverse; }
.ai-chat__bubble--assistant { align-self: flex-start; }

.ai-chat__bubble-content { display: flex; flex-direction: column; gap: 4px; }
.ai-chat__bubble--user .ai-chat__bubble-content { align-items: flex-end; }

.ai-chat__bubble-name {
  font-size: 11px; color: var(--color-text-light); font-weight: 500;
  padding-left: 2px;
}

.ai-chat__bubble-text {
  padding: 10px 14px; border-radius: 12px;
  font-size: 13px; line-height: 1.6; word-break: break-word;
}
.ai-chat__bubble--user .ai-chat__bubble-text {
  background: var(--color-primary); color: #fff; border-bottom-right-radius: 4px;
}
.ai-chat__bubble--assistant .ai-chat__bubble-text {
  background: var(--color-bg); color: var(--color-text); border-bottom-left-radius: 4px;
}
.ai-chat__bubble-time { font-size: 10px; color: var(--color-text-light); }

.ai-chat__input-area {
  padding: 12px 16px; border-top: 1px solid var(--color-border-light); flex-shrink: 0;
}
.ai-chat__input-wrap {
  display: flex; gap: 8px; align-items: flex-end;
  background: var(--color-bg); border-radius: var(--radius-sm);
  padding: 8px 10px; border: 1px solid var(--color-border); transition: border-color 0.2s;
}
.ai-chat__input-wrap:focus-within {
  border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.08);
}
.ai-chat__input {
  flex: 1; border: none; outline: none; background: transparent;
  font-size: 13px; line-height: 1.5; color: var(--color-text);
  resize: none; font-family: inherit; min-height: 40px;
}
.ai-chat__input::placeholder { color: var(--color-text-light); }

.ai-chat__send-btn {
  width: 36px; height: 36px; border-radius: 50%;
  background: var(--color-primary); color: #fff;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: all 0.2s;
}
.ai-chat__send-btn:hover:not(:disabled) { background: var(--color-primary-light); transform: scale(1.05); }
.ai-chat__send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ai-chat__send-icon { font-size: 16px; }

.ai-chat__stop-btn {
  width: 36px; height: 36px; border-radius: 50%;
  background: #ef4444; color: #fff;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: all 0.2s; font-size: 12px;
}
.ai-chat__stop-btn:hover { background: #dc2626; }

.ai-chat__input-tip { font-size: 10px; color: var(--color-text-light); margin-top: 6px; text-align: right; }
</style>
