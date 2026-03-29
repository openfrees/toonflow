<template>
  <div class="ai-chat">
    <!-- 聊天头部 -->
    <div class="ai-chat__header">
      <div class="ai-chat__header-left">
        <Icon name="lucide:bot" class="ai-chat__header-icon" size="18" />
        <span class="ai-chat__header-title">创作助手</span>
      </div>
      <div class="ai-chat__header-actions">
        <!-- 清空会话按钮 -->
        <button
          v-if="messages.length > 0"
          class="ai-chat__clear-btn"
          title="清空会话"
          @click="clearHistory"
        >
          <Icon name="lucide:trash-2" size="14" />
        </button>
        <!-- Agent 状态指示器 -->
        <div v-if="activeAgent" class="ai-chat__agent-badge">
          <Icon :name="agentIcon" size="12" />
          <span>{{ activeAgent }}</span>
        </div>
        <div class="ai-chat__header-status">
          <span class="ai-chat__status-dot" :class="{ 'ai-chat__status-dot--busy': isStreaming }"></span>
          <span class="ai-chat__status-text">{{ isStreaming ? '生成中' : '在线' }}</span>
        </div>
      </div>
    </div>

    <!-- 消息列表 -->
    <div ref="messagesRef" class="ai-chat__messages" @scroll="handleScroll">
      <!-- 欢迎消息 -->
      <div v-if="messages.length === 0" class="ai-chat__welcome">
        <div class="ai-chat__welcome-icon">
          <Icon name="lucide:book-open" size="36" />
        </div>
        <h4 class="ai-chat__welcome-title">你好，我是知剧小说助手</h4>
        <p class="ai-chat__welcome-desc">{{ welcomeHint }}</p>
        <!-- 阶段4：纯文字完成提示（不可点击） -->
        <p v-if="completionHint" class="ai-chat__completion-hint">
          <Icon name="lucide:circle-check" size="14" class="ai-chat__completion-icon" />
          {{ completionHint }}
        </p>
        <!-- 其他阶段：快捷操作按钮 -->
        <div v-if="quickActions.length > 0" class="ai-chat__quick-actions">
          <button
            v-for="action in quickActions"
            :key="action.text"
            class="ai-chat__quick-btn"
            @click="handleQuickAction(action)"
          >
            <Icon :name="action.icon" size="14" />
            {{ action.text }}
          </button>
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
          <template v-if="msg.role === 'status'">
            <div class="ai-chat__status-bubble">
              <Icon :name="statusIcon(msg.kind)" size="14" class="ai-chat__status-icon" />
              <span class="ai-chat__status-text-inline">{{ msg.text }}</span>
            </div>
          </template>
          <template v-else>
            <span v-if="msg.role === 'assistant'" class="ai-chat__bubble-name">
              {{ msg.agent || '小说助手' }}
            </span>
            <div class="ai-chat__bubble-text" v-html="renderContent(msg)"></div>
            <div class="ai-chat__bubble-footer">
              <span class="ai-chat__bubble-time">{{ msg.time }}</span>
              <span
                v-if="msg.role === 'assistant' && index === lastAssistantIndex && inlineStatus.visible"
                class="ai-chat__inline-status"
                :class="{ 'ai-chat__inline-status--spin': inlineStatus.kind === 'thinking' || inlineStatus.kind === 'tool' || inlineStatus.kind === 'subAgentStatus' }"
              >
                <Icon :name="statusIcon(inlineStatus.kind)" size="11" class="ai-chat__inline-status-icon" />
                <span>{{ inlineStatus.text }}</span>
              </span>
            </div>
          </template>
        </div>
      </div>

      <!-- 思考/工具调用状态指示器（位于所有消息之后） -->
      <div v-if="isThinking" class="ai-chat__thinking">
        <div class="ai-chat__thinking-dots">
          <span></span><span></span><span></span>
        </div>
        <span class="ai-chat__thinking-text">{{ thinkingText || '正在思考中' }}</span>
      </div>

      <!-- AI中断/超长截断后的恢复按钮 -->
      <div v-if="pendingRecoveryAction && !isStreaming" class="ai-chat__recovery">
        <button class="ai-chat__recovery-btn" @click="handleRecoveryAction">
          <Icon name="lucide:play" size="14" />
          {{ pendingRecoveryAction }}
        </button>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="ai-chat__input-area">
      <div class="ai-chat__input-wrap">
        <textarea
          v-model="inputText"
          class="ai-chat__input"
          placeholder="输入你的需求，如：开始分析小说生成故事线..."
          rows="3"
          @keydown.enter.exact.prevent="handleSend"
        ></textarea>
        <button
          v-if="isStreaming"
          class="ai-chat__stop-btn"
          @click="showStopConfirm = true"
        >
          <Icon name="lucide:square" size="14" />
        </button>
        <button
          v-else
          class="ai-chat__send-btn"
          :disabled="!inputText.trim()"
          @click="handleSend"
        >
          <Icon name="lucide:send" size="16" />
        </button>
      </div>
      <p class="ai-chat__input-tip">按 Enter 发送，Shift+Enter 换行</p>
    </div>
    <!-- 停止生成二次确认弹窗 -->
    <CommonConfirmDialog
      :visible="showStopConfirm"
      icon="lucide:pause-circle"
      title="确认停止生成？"
      description="当前助手正在努力生成内容，停止后<strong>已生成的部分会保留</strong>，但未完成的内容将丢失。<br>如需继续，可重新发送指令。"
      confirm-text="停止生成"
      cancel-text="继续生成"
      confirm-type="danger"
      @confirm="handleConfirmStop"
      @cancel="showStopConfirm = false"
    />
    <!-- 清空会话确认弹窗 -->
    <CommonConfirmDialog
      :visible="showClearConfirm"
      icon="lucide:trash-2"
      title="清空当前会话？"
      description="清空后将开始新的对话，<strong>历史消息不可恢复</strong>。"
      confirm-text="清空会话"
      cancel-text="取消"
      confirm-type="danger"
      @confirm="handleConfirmClear"
      @cancel="showClearConfirm = false"
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
 * 小说编辑 - AI聊天组件
 * 对接后端 SSE Agent 接口（POST /api/novel-agent/chat）
 * 支持多 Agent 切换显示（故事师/大纲师/导演）
 */
const props = defineProps({
  novelId: { type: String, required: true },
  totalChapters: { type: Number, default: 0 },
  hasStoryline: { type: Boolean, default: false },
  /** 分集大纲数组（用于判断大纲生成进度） */
  episodes: { type: Array, default: () => [] },
  /** 目标总集数（用于判断大纲是否全部生成完毕） */
  totalEpisodes: { type: Number, default: 80 },
  resetSessionOnEnter: { type: Boolean, default: true },
})

const emit = defineEmits(['refresh'])

const { showToast } = useToast()
const {
  guardDialog,
  handleGuardConfirm,
  ensureAccess,
} = useAccessGuard()
const { checkSseResponse, checkModelConfig } = useModelGuard()
const config = useRuntimeConfig()
const API_BASE = config.public.apiBase

const inputText = ref('')
const messagesRef = ref(null)
const isNearBottom = ref(true)
const isStreaming = ref(false)
const isThinking = ref(false)
const thinkingText = ref('')
const messages = ref([])
let abortController = null
let lastUserMessage = ''

const showStopConfirm = ref(false)
const showClearConfirm = ref(false)
const activeAgent = ref('')
const currentStepTitle = ref('')
const pendingRecoveryAction = ref('')
let currentStatusMsg = null
const inlineStatus = ref({ text: '', kind: '', visible: false })

const lastAssistantIndex = computed(() => {
  for (let i = messages.value.length - 1; i >= 0; i--) {
    if (messages.value[i].role === 'assistant') return i
  }
  return -1
})

const agentIcon = computed(() => {
  const map = {
    '故事师': 'lucide:book-open',
    '大纲师': 'lucide:clipboard-list',
    '导演': 'lucide:clapperboard',
  }
  return map[activeAgent.value] || 'lucide:bot'
})

/**
 * 已生成大纲的集数（content 非空才算）
 */
const generatedEpisodeCount = computed(() =>
  props.episodes.filter(ep => ep.content && ep.content.trim()).length
)

/**
 * 项目阶段判断：
 * 1 = 无故事线
 * 2 = 有故事线，无大纲
 * 3 = 有部分大纲（未全部生成完）
 * 4 = 大纲全部生成完毕
 */
const projectPhase = computed(() => {
  if (!props.hasStoryline) return 1
  const generated = generatedEpisodeCount.value
  if (generated === 0) return 2
  if (generated < props.totalEpisodes) return 3
  return 4
})

const welcomeHint = computed(() => {
  const phase = projectPhase.value
  if (phase === 1) {
    return props.totalChapters > 0
      ? `咱们小说一共 ${props.totalChapters} 章，点击下方按钮开始分析生成故事线吧。`
      : '我可以帮你分析小说原文，生成故事线、大纲、角色设定等内容。'
  }
  if (phase === 2) {
    return '故事线已生成，您可以继续完善故事线，或开始生成分集大纲。'
  }
  if (phase === 3) {
    return `已生成 ${generatedEpisodeCount.value}/${props.totalEpisodes} 集大纲，继续加油！`
  }
  return `全部 ${props.totalEpisodes} 集大纲已生成完毕，可以进入下一阶段了。`
})

/**
 * 阶段4的纯文字完成提示（不可点击）
 */
const completionHint = computed(() => {
  if (projectPhase.value !== 4) return ''
  return `您已生成完全部 ${props.totalEpisodes} 集大纲，可以去左侧面板「生成剧本」、「提取角色」、「提取场景」`
})

const quickActions = computed(() => {
  const phase = projectPhase.value
  if (phase === 1) {
    return [
      { text: '开始分析，生成故事线', icon: 'lucide:scan-search' },
    ]
  }
  if (phase === 2) {
    return [
      { text: '继续生成故事线', icon: 'lucide:scan-search' },
      { text: '修改第5~8章的故事线内容', icon: 'lucide:pen-line' },
      { text: '生成分集大纲', icon: 'lucide:clipboard-list' },
    ]
  }
  if (phase === 3) {
    return [
      { text: '继续生成大纲', icon: 'lucide:clipboard-list' },
      { text: '重新生成第3集大纲', icon: 'lucide:refresh-cw' },
      { text: '重新优化第4集大纲', icon: 'lucide:sparkles' },
    ]
  }
  return []
})

const checkIfNearBottom = () => {
  const el = messagesRef.value
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight < 50
}

const handleScroll = () => {
  isNearBottom.value = checkIfNearBottom()
}

const scrollToBottom = (force = false) => {
  nextTick(() => {
    if (messagesRef.value && (force || isNearBottom.value)) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
      isNearBottom.value = true
    }
  })
}

watch(messages, () => { scrollToBottom() }, { deep: true })
watch(isThinking, (val) => { if (val) scrollToBottom() })

const renderContent = (msg) => {
  if (msg.role === 'user') return escapeHtml(msg.content)
  let text = escapeHtml(msg.content)
  text = text.replace(/\n/g, '<br>')
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/#{1,3}\s(.+?)(<br>|$)/g, '<strong>$1</strong>$2')
  return text
}

const escapeHtml = (str) => {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const handleQuickAction = async (action) => {
  if (!ensureAccess({ actionName: '创作助手聊天' })) return
  const started = await sendMessage(action.text)
  if (started === false) return
  scrollToBottom(true)
}

const handleSend = async () => {
  const text = inputText.value.trim()
  if (!text || isStreaming.value) return
  if (!ensureAccess({ actionName: '创作助手聊天' })) return
  const started = await sendMessage(text)
  if (started === false) return
  inputText.value = ''
  pendingRecoveryAction.value = ''
  scrollToBottom(true)
}

const handleRecoveryAction = async () => {
  if (!pendingRecoveryAction.value || isStreaming.value) return
  if (!ensureAccess({ actionName: '创作助手聊天' })) return
  const action = pendingRecoveryAction.value
  const started = await sendMessage(action)
  if (started === false) return
  pendingRecoveryAction.value = ''
  scrollToBottom(true)
}

const now = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

const statusIcon = (kind) => {
  const map = {
    thinking: 'lucide:loader-2',
    tool: 'lucide:wrench',
    transfer: 'lucide:arrow-right-left',
    refresh: 'lucide:refresh-cw',
    done: 'lucide:circle-check',
    error: 'lucide:circle-x',
    info: 'lucide:info',
    invoking: 'lucide:user-check',
    subAgentStatus: 'lucide:bot',
  }
  return map[kind] || 'lucide:info'
}

const pushOrUpdateStatus = (text, kind = 'info') => {
  if (!text) return
  if (kind === 'transfer' || kind === 'error') {
    const last = messages.value[messages.value.length - 1]
    if (last && last.role === 'status' && currentStatusMsg === last) {
      last.text = text
      last.kind = kind
      return
    }
    const msg = { role: 'status', text, kind, time: now() }
    messages.value.push(msg)
    currentStatusMsg = messages.value[messages.value.length - 1]
    return
  }
  inlineStatus.value = { text, kind, visible: true }
}

const endStatusBlock = () => {
  currentStatusMsg = null
}

/**
 * 发送消息，通过 fetch + ReadableStream 接收 SSE 流
 * 关键：pushAssistantMsg 后必须从响应式数组取回代理引用，
 * 否则 currentMsg.content += ... 绕过 Proxy SET trap，模板不会重渲染
 */
const sendMessage = async (text) => {
  /* 先检查模型配置，未配置直接弹窗，不添加消息、不清空输入 */
  if (!(await checkModelConfig('script_gen'))) return false
  lastUserMessage = text
  messages.value.push({ role: 'user', content: text, time: now() })
  isStreaming.value = true
  isThinking.value = true
  thinkingText.value = '正在连接AI助手'
  activeAgent.value = ''
  endStatusBlock()

  /* currentMsg 持有响应式代理引用，确保 content 修改可触发视图更新 */
  let currentMsg = null
  /* 标志位：下次主Agent输出时是否应该创建新消息（用于保持时间顺序，避免合并不同轮次的输出） */
  let shouldCreateNewMainMsg = false

  const pushAssistantMsg = (agent) => {
    isThinking.value = false
    const msg = { role: 'assistant', agent: agent || '小说助手', content: '', time: now() }
    messages.value.push(msg)
    currentMsg = messages.value[messages.value.length - 1]
    /* 重置标志位 */
    if (agent === '小说助手') shouldCreateNewMainMsg = false
  }

  abortController = new AbortController()
  const token = localStorage.getItem('token')

  try {
    const response = await fetch(`${API_BASE}/api/novel-agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ projectId: props.novelId, message: text }),
      signal: abortController.signal,
    })

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      isStreaming.value = false
      isThinking.value = false
      showToast(errData.message || `请求失败: ${response.status}`, 'error')
      return
    }

    if (await checkSseResponse(response)) return

    isThinking.value = false
    pushOrUpdateStatus('已连接，开始生成...', 'thinking')

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
        const jsonStr = line.slice(6).trim()
        if (!jsonStr) continue

        let event
        try { event = JSON.parse(jsonStr) } catch { continue }

        switch (event.type) {
          case 'agentText':
            endStatusBlock()
            /* 如果需要创建新消息（工具调用/子Agent之后），或者当前消息不是小说助手，则创建新消息 */
            if (!currentMsg || currentMsg.agent !== '小说助手' || shouldCreateNewMainMsg) {
              pushAssistantMsg('小说助手')
            }
            if (event.content && event.content !== 'undefined') {
              currentMsg.content += event.content
            }
            break

          case 'transfer':
            activeAgent.value = event.agent || ''
            currentStepTitle.value = event.title || ''
            isThinking.value = true
            thinkingText.value = event.title || `${event.agent || 'AI'}正在准备`
            pushOrUpdateStatus(event.title || `正在调用 ${event.agent || 'AI'}...`, 'transfer')
            pushAssistantMsg(event.agent)
            /* 子Agent被调用后，下次主Agent输出应该创建新消息 */
            shouldCreateNewMainMsg = true
            break

          case 'subAgentText':
            isThinking.value = false
            endStatusBlock()
            if (!currentMsg || currentMsg.agent !== event.agent) pushAssistantMsg(event.agent)
            if (event.content && event.content !== 'undefined') {
              currentMsg.content += event.content
            }
            break

          case 'subAgentStatus':
            /* 子 Agent 状态变化 - 对应 Toonflow 的各阶段标题 */
            isThinking.value = event.status === 'thinking'
            activeAgent.value = event.agent || ''
            currentStepTitle.value = event.message || ''
            thinkingText.value = event.message || ''
            /* 根据状态类型使用不同的样式 */
            pushOrUpdateStatus(event.message || '', event.status === 'completed' ? 'done' : 'subAgentStatus')
            break

          case 'subAgentEnd':
            currentMsg = null
            isThinking.value = false
            currentStepTitle.value = ''
            endStatusBlock()
            /* 子Agent结束后，下次主Agent输出应该创建新消息 */
            shouldCreateNewMainMsg = true
            /* 子 Agent 完成后的提示 */
            if (event.title) {
              pushOrUpdateStatus(event.title, 'done')
            }
            /* 如果需要刷新面板，发送刷新事件 */
            if (event.refreshPanel) {
              emit('refresh', 'outline')
            }
            break

          case 'thinking':
            isThinking.value = true
            thinkingText.value = event.message || '正在思考中'
            pushOrUpdateStatus(event.message || '正在思考中...', 'thinking')
            break

          case 'toolCall':
            isThinking.value = true
            /* 使用 toolTitle 如果有的话，否则使用工具名 */
            const toolDisplayName = event.toolTitle || TOOL_HINT_MAP[event.tool] || `正在执行: ${event.tool}`
            thinkingText.value = toolDisplayName
            pushOrUpdateStatus(toolDisplayName, 'tool')
            /* 工具调用后，下次主Agent输出应该创建新消息 */
            shouldCreateNewMainMsg = true
            break

          case 'refresh':
            emit('refresh', event.target)
            pushOrUpdateStatus(refreshHint(event.target), 'refresh')
            break

          case 'done':
            isThinking.value = false
            inlineStatus.value = { text: '', kind: '', visible: false }
            messages.value.push({ role: 'status', text: '生成结束。', kind: 'done', time: now() })
            endStatusBlock()
            break

          case 'error':
            isThinking.value = false
            if (currentMsg) {
              currentMsg.content += `\n\n[错误] ${event.message || '服务异常'}`
            } else {
              pushAssistantMsg('系统')
              currentMsg.content = `[错误] ${event.message || '服务异常'}`
            }
            pushOrUpdateStatus(`发生错误：${event.message || '服务异常'}`, 'error')
            endStatusBlock()
            break

          case 'heartbeat':
            break

          case 'recoveryHint':
            /* AI连接异常或超长截断后，引导用户点击"继续"快捷按钮 */
            isThinking.value = false
            endStatusBlock()
            if (event.suggestAction) {
              pendingRecoveryAction.value = event.suggestAction
            }
            pushOrUpdateStatus(event.message || 'AI连接中断', 'error')
            break

          default:
            if (event.content) {
              if (!currentMsg) pushAssistantMsg('小说助手')
              currentMsg.content += event.content
            }
        }
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('[NovelAiChat] SSE 错误:', err)
      if (!currentMsg) pushAssistantMsg('系统')
      if (currentMsg) currentMsg.content += '\n\n[连接中断] 服务连接意外断开，请点击下方按钮继续'
      endStatusBlock()
      pushOrUpdateStatus('服务连接中断，请点击下方按钮重新发送指令', 'error')
      pendingRecoveryAction.value = lastUserMessage || '继续分析故事线'
    }
  } finally {
    isStreaming.value = false
    isThinking.value = false
    activeAgent.value = ''
    currentStepTitle.value = ''
    inlineStatus.value = { text: '', kind: '', visible: false }
    abortController = null
  }
}

const TOOL_HINT_MAP = {
  getChapter: '正在读取章节原文',
  getStoryline: '正在获取故事线',
  saveStoryline: '正在保存故事线',
  deleteStoryline: '正在删除故事线',
  getOutline: '正在获取大纲',
  saveOutline: '正在保存大纲',
  updateOutline: '正在更新大纲',
  deleteOutline: '正在删除大纲',
  generateAssets: '正在生成资产',
  AI1: '正在召唤故事师',
  AI2: '正在召唤大纲师',
  director: '正在召唤导演',
}

const toolCallHint = (toolName, status) => {
  const base = TOOL_HINT_MAP[toolName] || `正在执行: ${toolName}`
  if (status === 'success') return `${base} - 完成`
  if (status === 'error') return `${base} - 出错了`
  return base + '...'
}

const refreshHint = (target) => {
  if (target === 'storyline') return '故事线已更新（左侧面板已刷新）'
  if (target === 'outline') return '大纲已更新（左侧面板已刷新）'
  return '数据已刷新'
}

const handleConfirmStop = () => {
  showStopConfirm.value = false
  stopStream()
}

const stopStream = async () => {
  if (abortController) {
    abortController.abort()
    abortController = null
  }
  isStreaming.value = false
  isThinking.value = false
  activeAgent.value = ''
  currentStepTitle.value = ''
  messages.value.push({ role: 'status', text: '已停止生成。', kind: 'info', time: now() })
  inlineStatus.value = { text: '', kind: '', visible: false }
  endStatusBlock()

  /* 通知后端停止 */
  const token = localStorage.getItem('token')
  try {
    await $fetch(`${API_BASE}/api/novel-agent/stop`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: { projectId: props.novelId },
    })
  } catch (_) { /* 忽略停止请求的错误 */ }
}

const clearHistory = () => {
  if (messages.value.length === 0) return
  showClearConfirm.value = true
}

const handleConfirmClear = async () => {
  showClearConfirm.value = false
  messages.value = []
  const token = localStorage.getItem('token')
  try {
    await $fetch(`${API_BASE}/api/novel-agent/history?projectId=${props.novelId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    })
    showToast('会话已清空', 'success')
  } catch (_) {
    showToast('会话已清空', 'success')
  }
}

/**
 * 加载历史消息
 */
const loadHistory = async () => {
  const token = localStorage.getItem('token')
  if (!token || !props.novelId) return
  try {
    const res = await $fetch(`${API_BASE}/api/novel-agent/history?projectId=${props.novelId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (res?.code === 200 && Array.isArray(res.data)) {
      const agentNameMap = { main: '小说助手', AI1: '故事师', AI2: '大纲师', director: '导演' }
      messages.value = res.data
        .filter(r => r.role === 'user' || r.role === 'assistant')
        .map(r => ({
          role: r.role,
          agent: r.role === 'assistant' ? (agentNameMap[r.agentType] || '小说助手') : undefined,
          content: r.content || '',
          time: r.createdAt ? new Date(r.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '',
        }))
    }
  } catch (_) { /* 首次访问可能没有历史 */ }
}

/**
 * 进入页面时默认开启新会话，避免历史对话污染当前创作阶段
 */
const startFreshSession = async () => {
  const token = localStorage.getItem('token')
  if (!token || !props.novelId) return
  try {
    await $fetch(`${API_BASE}/api/novel-agent/history?projectId=${props.novelId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    })
  } catch (_) {
    /* 忽略清空失败，避免阻塞页面进入 */
  }
  messages.value = []
}

/* 生成中离开页面拦截：浏览器原生 beforeunload */
const onBeforeUnload = (e) => {
  if (isStreaming.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}

onMounted(() => {
  window.addEventListener('beforeunload', onBeforeUnload)
  if (props.resetSessionOnEnter) {
    startFreshSession()
  } else {
    loadHistory()
  }
  scrollToBottom(true)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
})

const guardedSendMessage = async (content) => {
  if (!content || isStreaming.value) return
  if (!ensureAccess({ actionName: '创作助手聊天' })) return
  await sendMessage(content)
}

defineExpose({ sendMessage: guardedSendMessage, clearHistory, isStreaming })
</script>

<style scoped>
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
.ai-chat__header-actions { display: flex; align-items: center; gap: 10px; }

/* 清空会话按钮 */
.ai-chat__clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-light);
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}
.ai-chat__clear-btn:hover {
  background: var(--color-bg-hover);
  color: #ef4444;
}


@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.ai-chat__header-status { display: flex; align-items: center; gap: 6px; }

.ai-chat__agent-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  background: var(--color-primary-bg);
  color: var(--color-primary);
  animation: agent-pulse 2s ease-in-out infinite;
}

@keyframes agent-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

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
.ai-chat__welcome-icon { color: var(--color-primary); margin-bottom: 12px; opacity: 0.7; }
.ai-chat__welcome-title { font-size: 15px; font-weight: 700; color: var(--color-text); margin-bottom: 6px; }
.ai-chat__welcome-desc { font-size: 12px; color: var(--color-text-secondary); margin-bottom: 20px; line-height: 1.6; }

.ai-chat__completion-hint {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 12px 16px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.06), rgba(34, 197, 94, 0.12));
  border: 1px solid rgba(34, 197, 94, 0.2);
  font-size: 12px;
  line-height: 1.7;
  color: var(--color-text-secondary);
  text-align: left;
  margin-bottom: 12px;
}
.ai-chat__completion-icon { color: #22c55e; flex-shrink: 0; margin-top: 2px; }

.ai-chat__quick-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }

.ai-chat__quick-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px; border-radius: 20px; font-size: 12px;
  background: var(--color-bg); color: var(--color-text-secondary);
  border: 1px solid var(--color-border); transition: all 0.2s;
  cursor: pointer;
}
.ai-chat__quick-btn:hover {
  background: var(--color-primary-bg); color: var(--color-primary);
  border-color: rgba(255, 107, 53, 0.3);
}

.ai-chat__bubble { display: flex; gap: 10px; max-width: 85%; }
.ai-chat__bubble--user { align-self: flex-end; flex-direction: row-reverse; }
.ai-chat__bubble--assistant { align-self: flex-start; }
.ai-chat__bubble--status { align-self: center; justify-content: center; max-width: 85%; }

.ai-chat__bubble-content { display: flex; flex-direction: column; gap: 4px; width: fit-content; }
.ai-chat__bubble--user .ai-chat__bubble-content { align-items: flex-end; }
.ai-chat__bubble--status .ai-chat__bubble-content { align-items: center; }

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
.ai-chat__bubble-footer { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ai-chat__bubble-time { font-size: 10px; color: var(--color-text-light); flex-shrink: 0; }

.ai-chat__inline-status {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--color-bg-hover);
  font-size: 10px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  border: 1px solid var(--color-border-light);
  transition: all 0.3s ease;
}
.ai-chat__inline-status--spin .ai-chat__inline-status-icon { animation: spin 1s linear infinite; }
.ai-chat__inline-status-icon { color: var(--color-primary); flex-shrink: 0; }

.ai-chat__status-bubble {
  display: inline-flex;
  align-items: flex-start;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 16px;
  background: var(--color-bg-hover);
  border: 1px solid var(--color-border-light);
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.5;
  text-align: left;
}
.ai-chat__status-icon { color: var(--color-primary); flex-shrink: 0; margin-top: 2px; }
.ai-chat__status-text-inline { word-break: break-word; }

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
  flex-shrink: 0; transition: all 0.2s; border: none; cursor: pointer;
}
.ai-chat__send-btn:hover:not(:disabled) { background: var(--color-primary-light); transform: scale(1.05); }
.ai-chat__send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ai-chat__send-icon { font-size: 16px; }

.ai-chat__stop-btn {
  width: 36px; height: 36px; border-radius: 50%;
  background: #ef4444; color: #fff;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: all 0.2s; font-size: 12px;
  border: none; cursor: pointer;
}
.ai-chat__stop-btn:hover { background: #dc2626; }

.ai-chat__input-tip { font-size: 10px; color: var(--color-text-light); margin-top: 6px; text-align: right; }

/* 思考/工具调用状态指示器 */
.ai-chat__thinking {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  margin-top: 4px;
  align-self: flex-start;
}

.ai-chat__thinking-dots {
  display: flex;
  gap: 4px;
}

.ai-chat__thinking-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-primary);
  animation: thinking-bounce 1.4s ease-in-out infinite;
}

.ai-chat__thinking-dots span:nth-child(2) { animation-delay: 0.16s; }
.ai-chat__thinking-dots span:nth-child(3) { animation-delay: 0.32s; }

@keyframes thinking-bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

.ai-chat__thinking-text {
  font-size: 12px;
  color: var(--color-text-light);
  font-style: italic;
}

/* AI 中断/超长截断后的恢复按钮 */
.ai-chat__recovery {
  display: flex;
  justify-content: center;
  padding: 12px 0;
}

.ai-chat__recovery-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  background: var(--color-primary);
  color: #fff;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  animation: recovery-pulse 2s ease-in-out infinite;
}

.ai-chat__recovery-btn:hover {
  background: var(--color-primary-light);
  transform: scale(1.03);
}

@keyframes recovery-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 107, 53, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(255, 107, 53, 0); }
}
</style>
