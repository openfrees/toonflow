'use strict';

const { Controller } = require('egg');
const { chatStream } = require('../../lib/ai_chat');
const { createStreamGuard, BLOCKED_REPLY } = require('../../lib/content_guard');

/* 存储正在进行的台本生成流：key = `script_${userId}_${episodeId}` */
const activeGenerations = new Map();

/**
 * 台本生成控制器
 * 将分集大纲扩写为详细台本（SSE流式）
 */
class ScriptGenerateController extends Controller {

  /**
   * 生成单集台本（SSE流式）
   * POST /api/script-episode/:id/generate-script
   */
  async generateEpisodeScript() {
    const { ctx, app } = this;
    const userId = ctx.state.user.id;
    const episodeId = ctx.helper.decodeId(ctx.params.id);

    if (!episodeId) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('无效的剧集ID');
      return;
    }

    /* 查询剧集数据 */
    const episode = await ctx.model.ScriptEpisode.findOne({
      where: { id: episodeId, user_id: userId },
      raw: true,
    });
    if (!episode) {
      ctx.status = 404;
      ctx.body = ctx.helper.fail('剧集不存在');
      return;
    }

    /* 检查大纲内容是否存在 */
    if (!episode.content || !episode.content.trim()) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('该集大纲内容为空，请先生成大纲');
      return;
    }

    /* 检查台本是否已锁定 */
    if (episode.script_locked === 1) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('该集台本已锁定，无法重新生成');
      return;
    }

    /* 并发互斥：同一集同时只能有一个生成任务 */
    const genKey = `script_${userId}_${episodeId}`;
    if (activeGenerations.has(genKey)) {
      ctx.status = 409;
      ctx.body = ctx.helper.fail('该集台本正在生成中，请勿重复操作');
      return;
    }

    /* 查询剧本主表数据（人物介绍、剧情线、创作参数等） */
    const script = await ctx.model.Script.findOne({
      where: { id: episode.script_id, user_id: userId },
      raw: true,
    });
    if (!script) {
      ctx.status = 404;
      ctx.body = ctx.helper.fail('关联剧本不存在');
      return;
    }

    /* 标记生成中 */
    await ctx.service.api.scriptGenerate.updateScriptStatus(episodeId, 1);

    /* 构建AI消息 */
    const messages = await ctx.service.api.scriptGenerate.buildEpisodeScriptMessages(script, episode);

    /* 调试日志 */
    ctx.logger.info('[ScriptGenerate] ========== 台本生成开始 ==========');
    ctx.logger.info('[ScriptGenerate] 剧集ID: %s, 第%d集', episodeId, episode.episode_number);
    messages.forEach((msg, i) => {
      ctx.logger.info('[ScriptGenerate] messages[%d] role=%s (%d字)', i, msg.role, msg.content.length);
    });

    const aiConfig = await ctx.service.api.modelConfig.getEffectiveAiConfig(userId, 'script_gen');
    if (!aiConfig) {
      ctx.body = ctx.helper.fail('请先在「模型设置」中配置并绑定文字模型', 4001);
      return;
    }

    /* 设置SSE响应头 */
    ctx.respond = false;
    const res = ctx.res;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });

    let fullContent = '';
    let saved = false;
    let clientAborted = false;

    /* AbortController 用于中断AI请求 */
    const abortController = new AbortController();
    const streamState = { abortController, getContent: () => fullContent };
    activeGenerations.set(genKey, streamState);

    try {
      /* 调用AI流式接口 */
      const stream = await chatStream(aiConfig, messages, {
        signal: abortController.signal,
        maxTokens: 8192,
      });

      /* 监听客户端断开 */
      ctx.req.on('close', () => {
        if (!saved) {
          clientAborted = true;
          ctx.logger.info('[ScriptGenerate] 客户端断开，中断生成');
          abortController.abort();
        }
      });

      /* 创建内容守卫 */
      const guard = createStreamGuard();

      /* 逐chunk写入SSE */
      for await (const chunk of stream) {
        if (clientAborted) break;

        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          const safeDelta = guard.push(delta);

          if (guard.blocked()) {
            ctx.logger.warn('[ScriptGenerate] 检测到prompt泄露，已拦截');
            fullContent = BLOCKED_REPLY;
            res.write(`data: ${JSON.stringify({ content: BLOCKED_REPLY })}\n\n`);
            abortController.abort();
            break;
          }

          if (safeDelta) {
            fullContent += safeDelta;
            res.write(`data: ${JSON.stringify({ content: safeDelta })}\n\n`);
          }
        }
      }

      /* 流结束，刷出缓冲区 */
      if (!clientAborted && !guard.blocked()) {
        const remaining = guard.flush();
        if (remaining) {
          fullContent += remaining;
          res.write(`data: ${JSON.stringify({ content: remaining })}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      }

      /* 保存台本内容 */
      if (fullContent && fullContent !== BLOCKED_REPLY) {
        await ctx.service.api.scriptGenerate.updateScriptStatus(episodeId, 2, fullContent);
        saved = true;
        ctx.logger.info('[ScriptGenerate] 台本保存成功，第%d集，%d字', episode.episode_number, fullContent.length);
      } else if (!fullContent) {
        /* AI没有返回内容，标记失败 */
        await ctx.service.api.scriptGenerate.updateScriptStatus(episodeId, 3);
      }
    } catch (err) {
      /* 用户主动停止（APIUserAbortError）或客户端断开，记录为INFO */
      if (clientAborted || err.name === 'APIUserAbortError' || err.message?.includes('aborted')) {
        ctx.logger.info('[ScriptGenerate] 生成被用户停止，保存部分内容');
      } else {
        /* 真正的异常才记录ERROR */
        ctx.logger.error('[ScriptGenerate] 生成异常:', err);
        try {
          res.write(`data: ${JSON.stringify({ error: err.message || 'AI服务异常' })}\n\n`);
        } catch (_) { /* 连接已断开 */ }
      }
    } finally {
      activeGenerations.delete(genKey);

      /* 兜底保存 */
      if (!saved && fullContent && fullContent !== BLOCKED_REPLY) {
        try {
          /* 客户端中断时保存部分内容，状态标记为已生成（内容可用） */
          await ctx.service.api.scriptGenerate.updateScriptStatus(episodeId, 2, fullContent);
          ctx.logger.info('[ScriptGenerate] 兜底保存（%d字）', fullContent.length);
        } catch (saveErr) {
          ctx.logger.error('[ScriptGenerate] 兜底保存失败:', saveErr);
          /* 保存失败则标记为生成失败 */
          try {
            await ctx.service.api.scriptGenerate.updateScriptStatus(episodeId, 3);
          } catch (_) { /* ignore */ }
        }
      } else if (!saved && !fullContent) {
        /* 没有任何内容，标记失败 */
        try {
          await ctx.service.api.scriptGenerate.updateScriptStatus(episodeId, 3);
        } catch (_) { /* ignore */ }
      }

      res.end();
    }
  }

  /**
   * 停止台本生成
   * POST /api/script-episode/:id/stop-generate
   */
  async stopGenerate() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const episodeId = ctx.helper.decodeId(ctx.params.id);

    if (!episodeId) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('无效的剧集ID');
      return;
    }

    const genKey = `script_${userId}_${episodeId}`;
    const streamState = activeGenerations.get(genKey);

    if (streamState) {
      ctx.logger.info('[ScriptGenerate] 收到停止请求，episodeId: %s', episodeId);
      streamState.abortController.abort();
      ctx.body = ctx.helper.success({ stopped: true });
    } else {
      ctx.body = ctx.helper.success({ stopped: false, message: '没有进行中的生成任务' });
    }
  }

  /**
   * 保存/编辑台本内容
   * PUT /api/script-episode/:id/script
   */
  async saveEpisodeScript() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const episodeId = ctx.helper.decodeId(ctx.params.id);

    if (!episodeId) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('无效的剧集ID');
      return;
    }

    const { scriptContent, scriptLocked } = ctx.request.body;

    /* 查询剧集并验证权限 */
    const episode = await ctx.model.ScriptEpisode.findOne({
      where: { id: episodeId, user_id: userId },
      raw: true,
    });
    if (!episode) {
      ctx.status = 404;
      ctx.body = ctx.helper.fail('剧集不存在');
      return;
    }

    /* 已锁定时只允许修改锁定状态（解锁） */
    if (episode.script_locked === 1 && scriptLocked !== 0) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('台本已锁定，请先解锁再编辑');
      return;
    }

    const updateData = {};
    if (scriptContent !== undefined) {
      updateData.script_content = scriptContent;
      /* 内容为空视为清空（未生成），有内容视为已生成 */
      updateData.script_status = scriptContent.trim() ? 2 : 0;
    }
    if (scriptLocked !== undefined) {
      updateData.script_locked = scriptLocked;
    }

    await ctx.model.ScriptEpisode.update(updateData, {
      where: { id: episodeId },
    });

    ctx.body = ctx.helper.success({ message: '保存成功' });
  }
}

module.exports = ScriptGenerateController;
