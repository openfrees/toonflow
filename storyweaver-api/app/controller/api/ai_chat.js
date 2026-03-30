'use strict';

const { Controller } = require('egg');
const { chatStream } = require('../../lib/ai_chat');
const { createStreamGuard, BLOCKED_REPLY } = require('../../lib/content_guard');

/* 存储正在进行的流式请求：key = `${userId}_${scriptId}`, value = { abortController, fullContent引用 } */
const activeStreams = new Map();

/**
 * AI对话控制器（C端）
 * 处理AI流式对话、聊天记录查询、流式中断
 */
class AiChatController extends Controller {

  /**
   * 流式对话
   * POST /api/ai-chat/stream
   * 使用SSE（Server-Sent Events）推送流式内容
   */
  async stream() {
    const { ctx, app } = this;
    const userId = ctx.state.user.id;
    const { scriptId, message } = ctx.request.body;

    if (!scriptId || !message) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('缺少scriptId或message参数');
      return;
    }

    /* 解码混淆的scriptId */
    const realScriptId = ctx.helper.decodeId(scriptId);
    if (!realScriptId) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('无效的剧本ID');
      return;
    }

    /* 验证剧本归属 */
    const script = await ctx.model.Script.findOne({
      where: { id: realScriptId, user_id: userId },
      raw: true,
    });
    if (!script) {
      ctx.status = 404;
      ctx.body = ctx.helper.fail('剧本不存在');
      return;
    }

    /* 1. 立即记录用户消息 */
    await ctx.service.api.aiChat.saveUserMessage(userId, realScriptId, message);

    /* 2. 构建AI消息上下文 */
    const messages = await ctx.service.api.aiChat.buildMessages(
      realScriptId, message, script
    );

    const aiConfig = await ctx.service.api.modelConfig.getEffectiveAiConfig(userId, 'script_gen');
    if (!aiConfig) {
      ctx.body = ctx.helper.fail('请先在「模型设置」中配置并绑定文字模型', 4001);
      return;
    }

    /* 3. 设置SSE响应头，告诉Egg不要自动处理响应 */
    ctx.respond = false;
    const res = ctx.res;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });

    let fullContent = '';
    let saved = false;
    let clientAborted = false;

    /* 创建 AbortController，用于中断 DeepSeek 请求 */
    const abortController = new AbortController();
    const streamKey = `${userId}_${realScriptId}`;

    /* 注册到活跃流 Map，供 stop 接口调用 */
    const streamState = { abortController, getContent: () => fullContent };
    activeStreams.set(streamKey, streamState);

    try {
      /* 4. 调用AI流式接口，传入 signal */
      const stream = await chatStream(aiConfig, messages, { signal: abortController.signal });

      const modelName = aiConfig[aiConfig.defaultProvider].model;

      /* 监听客户端断开（前端点击暂停），主动中断AI流 */
      ctx.req.on('close', () => {
        if (!saved) {
          clientAborted = true;
          /* 通过 AbortController 中断 DeepSeek 的HTTP请求 */
          abortController.abort();
        }
      });

      /* 5. 创建流式内容守卫 */
      const guard = createStreamGuard();

      /* 6. 逐chunk写入SSE，经过guard过滤 */
      for await (const chunk of stream) {
        /* 客户端已断开，停止处理 */
        if (clientAborted) break;

        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          const safeDelta = guard.push(delta);

          /* 如果guard检测到prompt泄露，立即中断并替换全部内容 */
          if (guard.blocked()) {
            fullContent = BLOCKED_REPLY;
            res.write(`data: ${JSON.stringify({ content: BLOCKED_REPLY })}\n\n`);
            abortController.abort();
            break;
          }

          if (safeDelta) {
            fullContent += safeDelta;

            /* SSE格式：data: {json}\n\n */
            res.write(`data: ${JSON.stringify({ content: safeDelta })}\n\n`);
          }
        }
      }

      /* 7. 流结束时刷出guard缓冲区剩余内容 */
      if (!clientAborted && !guard.blocked()) {
        const remaining = guard.flush();
        if (remaining) {
          fullContent += remaining;
          res.write(`data: ${JSON.stringify({ content: remaining })}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      }

      /* 8. AI回复入库 */
      if (fullContent) {
        await ctx.service.api.aiChat.saveAssistantMessage(
          userId, realScriptId, fullContent, modelName, 0
        );
        saved = true;
      }
    } catch (err) {
      /* 流式出错或中断抛出的异常 */
      if (!clientAborted) {
        try {
          res.write(`data: ${JSON.stringify({ error: err.message || 'AI服务异常' })}\n\n`);
        } catch (_) { /* 连接已断开，忽略写入错误 */ }
      }
    } finally {
      /* 从活跃流 Map 中移除 */
      activeStreams.delete(streamKey);

      /* 兜底：如果还没保存且已有部分内容，入库 */
      if (!saved && fullContent) {
        try {
          const modelName = aiConfig[aiConfig.defaultProvider].model;
          await ctx.service.api.aiChat.saveAssistantMessage(
            userId, realScriptId, fullContent, modelName, 0
          );
        } catch {
        }
      }
      res.end();
    }
  }

  /**
   * 获取聊天记录
   * GET /api/ai-chat/records?scriptId=xxx
   */
  async records() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const { scriptId } = ctx.query;

    if (!scriptId) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('缺少scriptId参数');
      return;
    }

    /* 解码混淆的scriptId */
    const realScriptId = ctx.helper.decodeId(scriptId);
    if (!realScriptId) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('无效的剧本ID');
      return;
    }

    const list = await ctx.service.api.aiChat.getRecords(realScriptId, userId);
    ctx.body = ctx.helper.success(list);
  }

  /**
   * 停止流式生成
   * POST /api/ai-chat/stop
   * 前端点击暂停时调用，通知后端中断AI流
   */
  async stop() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const { scriptId } = ctx.request.body;

    if (!scriptId) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('缺少scriptId参数');
      return;
    }

    const realScriptId = ctx.helper.decodeId(scriptId);
    if (!realScriptId) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('无效的剧本ID');
      return;
    }

    const streamKey = `${userId}_${realScriptId}`;
    const streamState = activeStreams.get(streamKey);

    if (streamState) {
      streamState.abortController.abort();
      ctx.body = ctx.helper.success({ stopped: true });
    } else {
      ctx.body = ctx.helper.success({ stopped: false, message: '没有进行中的生成' });
    }
  }
}

module.exports = AiChatController;
