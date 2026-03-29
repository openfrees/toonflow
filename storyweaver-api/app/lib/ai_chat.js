'use strict';

/**
 * AI 聊天模块
 * 完全对标 Toonflow 的 u.ai.text.stream / u.ai.text.invoke
 * 使用 Vercel AI SDK streamText + stopWhen: stepCountIs()
 * 工具由调用方用 tool() + Zod 定义，SDK 自动执行
 */

const { generateText, streamText, tool, stepCountIs } = require('ai');
const { createOpenAI } = require('@ai-sdk/openai');
const { createDeepSeek } = require('@ai-sdk/deepseek');

/**
 * 创建 AI 客户端（使用 Vercel AI SDK）
 * @param {object} config - app.config.ai 配置
 * @param {string} [provider] - 指定提供商，不传则用 defaultProvider
 */
function createClient(config, provider) {
  const providerName = provider || config.defaultProvider || 'deepseek';
  const providerConfig = config[providerName];
  console.log(`[AI] 使用提供商: ${providerName}, 模型: ${providerConfig?.model}, baseURL: ${providerConfig?.baseURL}`);

  if (!providerConfig || !providerConfig.apiKey) {
    throw new Error(`AI提供商 [${providerName}] 未配置或缺少apiKey`);
  }

  let modelInstance;
  const modelName = providerConfig.model || 'deepseek-chat';
  let sdkClient;

  if (providerName === 'deepseek') {
    const deepseek = createDeepSeek({
      baseURL: providerConfig.baseURL || 'https://api.deepseek.com',
      apiKey: providerConfig.apiKey,
    });
    modelInstance = deepseek.chat(modelName);
    sdkClient = deepseek;
  } else {
    const openai = createOpenAI({
      baseURL: providerConfig.baseURL || 'https://api.deepseek.com/v1',
      apiKey: providerConfig.apiKey,
    });
    modelInstance = openai.chat(modelName);
    sdkClient = openai;
  }

  return {
    client: sdkClient,
    model: modelInstance,
    modelName,
    maxTokens: providerConfig.maxTokens || 4096,
    temperature: providerConfig.temperature || 0.8,
  };
}

/**
 * 普通对话（非流式）
 */
async function chat(config, messages, options = {}) {
  const { model, maxTokens, temperature } = createClient(config, options.provider);

  const result = await generateText({
    model,
    messages,
    maxTokens: options.maxTokens || maxTokens,
    temperature: options.temperature || temperature,
  });

  return {
    content: result.text,
    usage: result.usage,
  };
}

/**
 * 流式对话 — 对标 Toonflow 的 u.ai.text.stream()
 *
 * 与 Toonflow 完全一致的调用方式：
 *   const result = await aiStream(config, { system, tools, messages, maxStep });
 *   for await (const chunk of result.fullStream) { ... }
 *
 * 工具必须用 tool() + Zod schema + execute 定义，SDK 自动执行。
 *
 * @param {object} config - app.config.ai
 * @param {object} params
 * @param {string} [params.system] - system prompt
 * @param {object} [params.tools] - Vercel AI SDK tool 对象（带 execute）
 * @param {Array}  params.messages - 消息列表
 * @param {number} [params.maxStep=100] - 最大工具调用步数
 * @param {string} [params.provider] - AI 提供商
 * @param {number} [params.maxTokens] - 最大 token 数
 * @param {number} [params.temperature] - 温度
 * @param {AbortSignal} [params.abortSignal] - 中断信号
 * @returns {Promise<ReturnType<typeof streamText>>}
 */
async function aiStream(config, params = {}) {
  const clientInfo = createClient(config, params.provider);
  const stepLimit = params.maxStep || (params.tools ? Object.keys(params.tools).length * 5 : 100);

  console.log(`[AI] aiStream: maxStep=${stepLimit}, tools=${Object.keys(params.tools || {}).join(', ')}`);

  return streamText({
    model: clientInfo.model,
    ...(params.system && { system: params.system }),
    ...(params.tools && { tools: params.tools }),
    messages: params.messages,
    maxTokens: params.maxTokens || clientInfo.maxTokens,
    temperature: params.temperature ?? 0.3,
    stopWhen: stepCountIs(stepLimit),
    ...(params.abortSignal && { abortSignal: params.abortSignal }),
  });
}

/**
 * 基础流式对话（generator，供其他控制器使用）
 * 不涉及工具调用，仅流式输出文本
 */
async function* chatStream(config, messages, options = {}) {
  const { model, maxTokens, temperature } = createClient(config, options.provider);

  const result = await streamText({
    model,
    messages,
    maxTokens: options.maxTokens || maxTokens,
    temperature: options.temperature || temperature,
    ...(options.signal && { abortSignal: options.signal }),
  });

  for await (const text of result.textStream) {
    yield { content: text, choices: [{ delta: { content: text } }] };
  }
}

module.exports = {
  createClient,
  chat,
  chatStream,
  aiStream,
  tool,
};
