/**
 * AI流式对话 composable
 * 封装与后端SSE流式接口的交互逻辑
 */
/**
 * @param {string|Ref} scriptId
 * @param {Object} [options]
 * @param {Function} [options.onDelta] - 每次收到AI内容片段时的回调 (deltaText: string)
 * @param {Function} [options.onComplete] - 流式完成时的回调 (fullText: string)
 * @param {Function} [options.onStreamStart] - 流式开始时的回调
 * @param {Function} [options.onError] - 错误的回调 (error: object)
 */
export const useAiChat = (scriptId, options = {}) => {
  /** 后端API基础地址（从 runtimeConfig 读取） */
  const API_BASE = useRuntimeConfig().public.apiBase
  /* 消息列表 */
  const messages = ref([])

  /* AI是否正在生成 */
  const isStreaming = ref(false)

  /* 当前流式请求的AbortController */
  let abortController = null

  const { checkSseResponse, checkModelConfig } = useModelGuard()

  /** 格式化日期为 MM-DD HH:mm:ss */
  const fmtDate = (d) => {
    const M = String(d.getMonth() + 1).padStart(2, '0')
    const D = String(d.getDate()).padStart(2, '0')
    const h = String(d.getHours()).padStart(2, '0')
    const m = String(d.getMinutes()).padStart(2, '0')
    const s = String(d.getSeconds()).padStart(2, '0')
    return `${M}-${D} ${h}:${m}:${s}`
  }

  /** 获取当前时间字符串 */
  const getTime = () => fmtDate(new Date())

  /** 安全解析时间，兼容各种格式 */
  const formatTime = (dateStr) => {
    if (!dateStr) return getTime()
    /* 如果已经是 Date 对象 */
    if (dateStr instanceof Date) return fmtDate(dateStr)
    const str = String(dateStr)
    /* 如果已经是 MM-DD HH:mm:ss 格式，直接返回 */
    if (/^\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(str)) return str
    /* 尝试多种解析方式 */
    let d = new Date(str)
    if (isNaN(d.getTime())) d = new Date(str.replace(' ', 'T'))
    if (isNaN(d.getTime())) {
      /* 最后兜底：直接从字符串截取 "2026-02-12 21:32:36" → "02-12 21:32:36" */
      const match = str.match(/\d{4}-(\d{2}-\d{2})\s(\d{2}:\d{2}:\d{2})/)
      if (match) return `${match[1]} ${match[2]}`
      return getTime()
    }
    return fmtDate(d)
  }

  /**
   * 加载历史聊天记录
   */
  const loadHistory = async () => {
    if (!process.client) return
    const token = localStorage.getItem('token')
    try {
      const res = await $fetch(`${API_BASE}/api/ai-chat/records?scriptId=${scriptId.value || scriptId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.code === 200 && res.data) {
        messages.value = res.data.map(r => ({
          role: r.role,
          content: r.content,
          time: formatTime(r.created_at),
        }))
      }
    } catch (e) {
      console.error('加载聊天记录失败:', e)
    }
  }

  /**
   * 发送消息并接收流式回复
   * @param {string} content - 用户消息内容
   */
  const sendMessage = async (content) => {
    if (!content.trim() || isStreaming.value) return
    if (!process.client) return

    /* 先检查模型配置，未配置直接弹窗引导，不添加消息、不清空输入 */
    if (!(await checkModelConfig('script_gen'))) return false

    const sid = scriptId.value || scriptId

    /* 模型检查通过后才添加用户消息到列表 */
    messages.value.push({ role: 'user', content, time: getTime() })

    /* 添加AI占位消息 */
    messages.value.push({ role: 'assistant', content: '', time: getTime() })
    const aiMsgIndex = messages.value.length - 1

    isStreaming.value = true
    abortController = new AbortController()

    /* 通知外部：流式开始（传入用户消息，供外部判断是否为"重新生成"场景） */
    console.log('[useAiChat] 流式开始，options.onStreamStart 存在:', !!options.onStreamStart)
    if (options.onStreamStart) options.onStreamStart(content)

    const token = localStorage.getItem('token')

    try {
      const response = await fetch(`${API_BASE}/api/ai-chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ scriptId: sid, message: content }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        let errorMessage = '请求失败'
        let errorData = null
        try {
          errorData = await response.json()
          errorMessage = errorData.message || errorMessage
        } catch (e) { /* 解析失败使用默认消息 */ }

        if (options.onError) {
          options.onError({ message: errorMessage, status: response.status, data: errorData })
        } else {
          messages.value[aiMsgIndex].content += `\n\n[错误: ${errorMessage}]`
        }
        isStreaming.value = false
        abortController = null
        return
      }

      /* 检查是否为模型未配置错误（后端返回 JSON 而非 SSE） */
      if (await checkSseResponse(response)) return

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        /* 解析SSE数据行 */
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue

          try {
            const data = JSON.parse(jsonStr)

            if (data.error) {
              messages.value[aiMsgIndex].content += `\n\n[错误: ${data.error}]`
              /* 通知外部：发生错误 */
              if (options.onError) options.onError(data)
              break
            }

            if (data.done) {
              /* 流式完成 */
              break
            }

            if (data.content) {
              /* 累积追加内容 */
              messages.value[aiMsgIndex].content += data.content
              /* 通知外部：收到内容片段 */
              console.log('[useAiChat] 收到内容片段，长度:', data.content.length, 'options.onDelta 存在:', !!options.onDelta)
              if (options.onDelta) options.onDelta(data.content)
            }
          } catch (e) {
            /* 忽略解析错误 */
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        messages.value[aiMsgIndex].content += `\n\n[请求失败: ${err.message}]`
      }
    } finally {
      /* 流式结束，更新AI消息的时间为实际完成时间 */
      messages.value[aiMsgIndex].time = getTime()
      /* 通知外部：流式完成 */
      console.log('[useAiChat] 流式完成，options.onComplete 存在:', !!options.onComplete)
      if (options.onComplete) options.onComplete(messages.value[aiMsgIndex].content)
      isStreaming.value = false
      abortController = null
    }
  }

  /** 停止当前流式生成 */
  const stopStream = () => {
    /* 先中断前端的 fetch 读取 */
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    isStreaming.value = false

    /* 通知外部：流式完成（中断也算完成，让解析器 flush 已有内容） */
    if (options.onComplete) {
      const lastMsg = messages.value[messages.value.length - 1]
      options.onComplete(lastMsg?.content || '')
    }

    /* 通知后端停止AI流，保存已生成的部分内容 */
    const sid = scriptId.value || scriptId
    const token = localStorage.getItem('token')
    fetch(`${API_BASE}/api/ai-chat/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ scriptId: sid }),
    }).catch(() => { /* 忽略停止请求的错误 */ })
  }

  /** 清空聊天历史（重写剧本时使用，开启全新会话） */
  const clearHistory = () => {
    messages.value = []
  }

  return {
    messages,
    isStreaming,
    loadHistory,
    sendMessage,
    stopStream,
    clearHistory,
  }
}
