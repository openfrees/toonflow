/**
 * AI流式输出 → 剧本结构化解析器
 * 核心：状态机 + 关键词模糊匹配 + 分集智能拆分
 *
 * 工作原理：
 * 1. 每次收到 AI 的 delta token，调用 feedDelta(text)
 * 2. 解析器检测【xxx】段落标记，用关键词模糊匹配确定目标字段
 * 3. 当检测到新段落标记时，将上一段落的完整内容通过回调推送
 * 4. 分集内容会进一步解析出集数、标题、正文
 * 5. 流式结束时调用 flush() 推送最后一个段落
 */

/**
 * 段落关键词 → 字段名映射（模糊匹配用）
 * 优先级：越靠前越优先匹配（避免"分集剧情大纲"被"剧情"误匹配）
 */
const SECTION_KEYWORDS = [
  { keywords: ['标题'], field: 'title' },
  { keywords: ['分集剧情大纲', '分集剧情'], field: 'episodes' },
  { keywords: ['基本信息'], field: 'basicInfo' },
  { keywords: ['剧情梗概', '梗概'], field: 'synopsis' },
  { keywords: ['人物介绍', '人物'], field: 'characters' },
  { keywords: ['信息流情绪点', '情绪点', '信息流'], field: 'emotionPoints' },
  { keywords: ['剧情线', '分集大纲'], field: 'plotLines' },
]

/**
 * 从【xxx】标记内文本中，模糊匹配出目标字段
 * @param {string} markerText - 【】内的文本，如 "六、分集剧情大纲（前10集）："
 * @returns {string|null} 字段名或null
 */
const matchSection = (markerText) => {
  for (const { keywords, field } of SECTION_KEYWORDS) {
    for (const kw of keywords) {
      if (markerText.includes(kw)) return field
    }
  }
  return null
}

/**
 * 从分集文本行中提取集数和标题
 * 支持格式：第1集：标题 / 第1集 标题 / 第1集:标题
 * @param {string} line
 * @returns {{ num: number, title: string } | null}
 */
const parseEpisodeLine = (line) => {
  const m = line.match(/第\s*(\d+)\s*集[：:\s]*(.*)/)
  if (!m) return null
  return { num: parseInt(m[1], 10), title: (m[2] || '').trim() }
}

/**
 * 创建剧本流式解析器
 * @param {Object} callbacks
 * @param {Function} callbacks.onSection - 段落完成回调 (field, content)
 * @param {Function} callbacks.onEpisode - 单集完成回调 (episodeNum, title, content)
 * @param {Function} callbacks.onTitle - 标题区域内容回调 (content)
 * @returns {Object} { feedDelta, flush, reset }
 */
export const useScriptParser = (callbacks = {}) => {
  /* ---- 状态 ---- */
  let currentSection = null       // 当前段落字段名（如 'synopsis'）
  let sectionBuffer = ''          // 当前段落累积的内容
  let markerBuffer = ''           // 【】标记的临时缓冲（处理 token 切割）
  let isInsideMarker = false      // 是否正在收集【】标记
  let fullText = ''               // 完整累积文本（用于标题提取）
  let firstMarkerSeen = false     // 是否已遇到第一个【】标记

  /* 分集相关状态 */
  let currentEpisodeNum = 0       // 当前正在解析的集数
  let currentEpisodeTitle = ''    // 当前集标题
  let episodeContentBuffer = ''   // 当前集内容缓冲

  /**
   * 提交上一个段落/分集的内容
   * 在检测到新段落标记或流式结束时调用
   */
  const flushCurrentSection = () => {
    if (!currentSection) {
      /* 还没遇到任何【】段落标记，丢弃内容（不再兜底当标题处理）
       * 修复："继续生成"场景下 reset 后 currentSection 为 null，
       * AI接着断点输出的内容没有【】标记，不应被误判为标题 */
      sectionBuffer = ''
      return
    }

    if (currentSection === 'title') {
      /* 标题段落：只有真正遇到【标题：】标记后的内容才触发 */
      if (sectionBuffer.trim() && callbacks.onTitle) {
        callbacks.onTitle(sectionBuffer.trim())
      }
      sectionBuffer = ''
      return
    }

    if (currentSection === 'episodes') {
      /* 先提交当前正在解析的集 */
      flushCurrentEpisode()
    } else {
      /* 普通段落：直接推送 */
      if (sectionBuffer.trim() && callbacks.onSection) {
        callbacks.onSection(currentSection, sectionBuffer.trim())
      }
    }
    sectionBuffer = ''
  }

  /**
   * 提交当前正在解析的单集内容
   */
  const flushCurrentEpisode = () => {
    if (currentEpisodeNum > 0 && callbacks.onEpisode) {
      const content = episodeContentBuffer.trim()
      console.log('[解析器-提交集] 集数:', currentEpisodeNum, '标题:', currentEpisodeTitle, '内容长度:', content.length)
      callbacks.onEpisode(currentEpisodeNum, currentEpisodeTitle, content)
    }
    currentEpisodeNum = 0
    currentEpisodeTitle = ''
    episodeContentBuffer = ''
  }

  /**
   * 喂入一个 delta token（核心方法）
   * 每次从 SSE 收到内容片段时调用
   * @param {string} delta - AI输出的文本片段
   */
  const feedDelta = (delta) => {
    if (!delta) return
    fullText += delta

    /* 逐字符处理，应对标记被 token 切割的情况 */
    for (const char of delta) {
      if (char === '【') {
        /* 开始收集标记 */
        isInsideMarker = true
        markerBuffer = ''
        continue
      }

      if (isInsideMarker) {
        if (char === '】') {
          /* 标记收集完成，判断属于哪个段落 */
          isInsideMarker = false
          const field = matchSection(markerBuffer)
          console.log('[解析器-标记] 检测到标记:', markerBuffer, '匹配字段:', field)

          if (field) {
            /* 匹配到有效段落 → 提交上一个段落，切换到新段落 */
            flushCurrentSection()
            if (!firstMarkerSeen) firstMarkerSeen = true
            currentSection = field
            console.log('[解析器-标记] 切换到新段落:', field)
            sectionBuffer = ''
            /* 分集段落重置集计数 */
            if (field === 'episodes') {
              currentEpisodeNum = 0
              episodeContentBuffer = ''
            }
          } else {
            /* 未匹配到有效段落 → 把【xxx】原样追加到当前内容 */
            sectionBuffer += '【' + markerBuffer + '】'
          }
          markerBuffer = ''
          continue
        }

        markerBuffer += char
        /* 防止超长误判：标记内文本超过40字符，认为不是段落标记 */
        if (markerBuffer.length > 40) {
          isInsideMarker = false
          sectionBuffer += '【' + markerBuffer
          markerBuffer = ''
        }
        continue
      }

      /* 普通字符：追加到当前段落缓冲 */
      sectionBuffer += char

      /* 如果当前在分集段落内，需要进一步解析每一集的边界 */
      if (currentSection === 'episodes') {
        processEpisodeChar(char)
      } else if (!currentSection && char === '\n') {
        /* 自动检测分集格式（"继续生成"场景：AI直接输出"第N集"而无【】标记）
         * 逐行检查，一旦发现"第N集"格式就自动切换到 episodes 模式 */
        const lines = sectionBuffer.split('\n')
        const lastCompleteLine = (lines.length >= 2 ? lines[lines.length - 2] : '').trim()
        if (lastCompleteLine) {
          const parsed = parseEpisodeLine(lastCompleteLine)
          if (parsed) {
            currentSection = 'episodes'
            firstMarkerSeen = true
            currentEpisodeNum = parsed.num
            /* 标题长度判断：超过30字视为内容 */
            if (parsed.title.length > 30) {
              currentEpisodeTitle = ''
              episodeContentBuffer = parsed.title
            } else {
              currentEpisodeTitle = parsed.title
              episodeContentBuffer = ''
            }
            episodeLineBuffer = ''
            sectionBuffer = ''
          }
        }
      }
    }
  }

  /**
   * 分集段落内的逐行解析
   * 检测 "第N集" 边界，拆分出集数、标题、内容
   * 策略：按换行符分割，每遇到新行就检查是否是新的一集
   */
  let episodeLineBuffer = ''  // 当前行缓冲

  const processEpisodeChar = (char) => {
    episodeLineBuffer += char

    if (char === '\n') {
      /* 一行结束，检查上一行是否是新集的开头 */
      const line = episodeLineBuffer.trim()
      episodeLineBuffer = ''

      if (!line) {
        /* 空行：追加换行到当前集内容 */
        if (currentEpisodeNum > 0) {
          episodeContentBuffer += '\n'
        }
        return
      }

      const parsed = parseEpisodeLine(line)
      if (parsed) {
        /* 检测到新的一集 → 先提交上一集 */
        console.log('[解析器-分集] 检测到新集:', parsed.num, '标题:', parsed.title)
        flushCurrentEpisode()
        currentEpisodeNum = parsed.num
        /*
         * 标题长度判断：超过30字说明AI把内容写在了标题行
         * 此时标题留空，整段作为内容的第一部分
         */
        if (parsed.title.length > 30) {
          currentEpisodeTitle = ''
          episodeContentBuffer = parsed.title
        } else {
          currentEpisodeTitle = parsed.title
          episodeContentBuffer = ''
        }
      } else {
        /* 普通内容行 → 追加到当前集 */
        if (currentEpisodeNum > 0) {
          if (episodeContentBuffer) episodeContentBuffer += '\n'
          episodeContentBuffer += line
        }
      }
    }
  }

  /**
   * 流式结束时调用，提交最后一个段落/集的内容
   */
  const flush = () => {
    /* 处理分集段落中最后一行（可能没有换行符结尾） */
    if (currentSection === 'episodes' && episodeLineBuffer.trim()) {
      const line = episodeLineBuffer.trim()
      const parsed = parseEpisodeLine(line)
      if (parsed) {
        flushCurrentEpisode()
        currentEpisodeNum = parsed.num
        /* 标题长度判断：超过30字视为内容 */
        if (parsed.title.length > 30) {
          currentEpisodeTitle = ''
          episodeContentBuffer = parsed.title
        } else {
          currentEpisodeTitle = parsed.title
          episodeContentBuffer = ''
        }
      } else if (currentEpisodeNum > 0) {
        if (episodeContentBuffer) episodeContentBuffer += '\n'
        episodeContentBuffer += line
      }
      episodeLineBuffer = ''
    }

    /* 提交最后一个段落 */
    flushCurrentSection()
  }

  /**
   * 重置解析器状态（新一轮对话开始时调用）
   */
  const reset = () => {
    currentSection = null
    sectionBuffer = ''
    markerBuffer = ''
    isInsideMarker = false
    fullText = ''
    firstMarkerSeen = false
    currentEpisodeNum = 0
    currentEpisodeTitle = ''
    episodeContentBuffer = ''
    episodeLineBuffer = ''
  }

  return { feedDelta, flush, reset }
}

