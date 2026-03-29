'use strict';

/**
 * 内容守卫模块
 * 1. 检测AI输出中是否泄露了系统提示词（prompt指纹检测）
 * 2. 替换AI输出中的第三方AI品牌名为自有品牌
 * 3. 支持流式chunk处理，带缓冲区解决跨chunk匹配问题
 */

/* ========== prompt 指纹：只选"元指令"级别的短语，正常创作输出中绝不会出现 ========== */
const PROMPT_FINGERPRINTS = [
  '专属G点提炼法',
  '飞卢风',
  '截断续传规则',
  '无需向用户展示',
  '分集格式规范（极其重要',
  '禁止markdown标志',
  '你是一位资深且极具创意的短剧编剧，擅长打造爆款短剧',
  '四大短剧爆点要素',
  '系统提示词',
  'system prompt',
  'system message',
];

/* ========== 品牌替换映射 + 内容清洗 ========== */
const BRAND_REPLACEMENTS = [
  /* AI不听话硬加的前缀标签，直接干掉 */
  { pattern: /内容正文[：:]\s*/g, replacement: '' },
  { pattern: /字节跳动/g, replacement: '溢彩视觉' },
  { pattern: /ByteDance/gi, replacement: '溢彩视觉' },
  { pattern: /豆包/g, replacement: '知剧AI' },
  { pattern: /Doubao/gi, replacement: '知剧AI' },
  { pattern: /DeepSeek/gi, replacement: '知剧AI' },
  { pattern: /OpenAI/gi, replacement: '溢彩视觉' },
  { pattern: /ChatGPT/gi, replacement: '知剧AI' },
  { pattern: /GPT[-\s]?4o?/gi, replacement: '知剧AI' },
  { pattern: /Claude/gi, replacement: '知剧AI' },
  { pattern: /Anthropic/gi, replacement: '溢彩视觉' },
  { pattern: /通义千问/g, replacement: '知剧AI' },
  { pattern: /文心一言/g, replacement: '知剧AI' },
  { pattern: /讯飞星火/g, replacement: '知剧AI' },
  { pattern: /Kimi/gi, replacement: '知剧AI' },
  { pattern: /Moonshot/gi, replacement: '知剧AI' },
  { pattern: /月之暗面/g, replacement: '溢彩视觉' },
  { pattern: /Gemini/gi, replacement: '知剧AI' },
  { pattern: /Google\s*AI/gi, replacement: '溢彩视觉' },
];

/* 被拦截时发送给前端的固定回复 */
const BLOCKED_REPLY = '我是知剧AI，一位专业的短剧编剧助手，请告诉我你想创作什么样的短剧？';

/* 计算所有关键词/品牌名中最长的字符数，用于缓冲区大小 */
const allKeywords = [
  ...PROMPT_FINGERPRINTS,
  ...BRAND_REPLACEMENTS.map(b => {
    // 从正则中提取原始文本的近似长度
    return b.pattern.source.replace(/\\/g, '').replace(/\[.*?\]/g, 'X');
  }),
];
const MAX_KEYWORD_LEN = Math.max(...allKeywords.map(k => k.length));

/**
 * 对文本执行品牌替换
 */
function replaceBrands(text) {
  let result = text;
  for (const { pattern, replacement } of BRAND_REPLACEMENTS) {
    // 每次使用前重置 lastIndex（因为带 g 标志）
    pattern.lastIndex = 0;
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * 检测文本中是否包含 prompt 指纹
 * @return {string|null} 命中的指纹，或 null
 */
function detectFingerprint(text) {
  const lower = text.toLowerCase();
  for (const fp of PROMPT_FINGERPRINTS) {
    if (lower.includes(fp.toLowerCase())) {
      return fp;
    }
  }
  return null;
}

/**
 * 处理完整文本（非流式场景）
 * @param {string} text - AI 原始输出
 * @return {{ safe: boolean, text: string, fingerprint?: string }}
 */
function guardFullText(text) {
  const fp = detectFingerprint(text);
  if (fp) {
    return { safe: false, text: BLOCKED_REPLY, fingerprint: fp };
  }
  return { safe: true, text: replaceBrands(text) };
}

/**
 * 创建流式内容守卫
 * 返回一个 transform 函数，每次传入一个 chunk，返回处理后的 chunk。
 * 内部维护缓冲区以处理跨 chunk 的关键词匹配。
 *
 * @return {{ push: (chunk: string) => string, flush: () => string, blocked: () => boolean }}
 */
function createStreamGuard() {
  let buffer = '';
  let isBlocked = false;

  return {
    /**
     * 推入一个新 chunk，返回可以安全发送的文本
     */
    push(chunk) {
      if (isBlocked) return '';

      buffer += chunk;

      // 检查指纹
      const fp = detectFingerprint(buffer);
      if (fp) {
        isBlocked = true;
        // 返回空字符串，调用方应在 blocked() 为 true 时发送 BLOCKED_REPLY
        return '';
      }

      // 保留尾部 MAX_KEYWORD_LEN 个字符作为缓冲，防止关键词被截断
      if (buffer.length <= MAX_KEYWORD_LEN) {
        return '';
      }

      const safeEnd = buffer.length - MAX_KEYWORD_LEN;
      const safeText = buffer.slice(0, safeEnd);
      buffer = buffer.slice(safeEnd);

      return replaceBrands(safeText);
    },

    /**
     * 流结束时调用，刷出缓冲区中剩余的文本
     */
    flush() {
      if (isBlocked) return '';
      const remaining = replaceBrands(buffer);
      buffer = '';
      return remaining;
    },

    /**
     * 是否已被拦截
     */
    blocked() {
      return isBlocked;
    },
  };
}

module.exports = {
  BLOCKED_REPLY,
  guardFullText,
  createStreamGuard,
  replaceBrands,
  detectFingerprint,
};
