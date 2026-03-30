'use strict';

const { Controller } = require('egg');
const { chatStream } = require('../../lib/ai_chat');
const { createStreamGuard, BLOCKED_REPLY } = require('../../lib/content_guard');

const activeGenerations = new Map();

class NovelScriptGenerateController extends Controller {

  async generateEpisodeScript() {
    const { ctx, app } = this;
    const userId = ctx.state.user.id;
    const episodeId = ctx.helper.decodeId(ctx.params.id);

    if (!episodeId) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('无效的剧集ID');
      return;
    }

    const episode = await ctx.model.NovelEpisode.findOne({
      where: { id: episodeId, user_id: userId },
      raw: true,
    });
    if (!episode) {
      ctx.status = 404;
      ctx.body = ctx.helper.fail('剧集不存在');
      return;
    }

    if (!episode.outline || !episode.outline.trim()) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('该集大纲内容为空，请先生成大纲');
      return;
    }

    if (episode.script_locked === 1) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('该集台本已锁定，无法重新生成');
      return;
    }

    const genKey = `novel_script_${userId}_${episodeId}`;
    if (activeGenerations.has(genKey)) {
      ctx.status = 409;
      ctx.body = ctx.helper.fail('该集台本正在生成中，请勿重复操作');
      return;
    }

    const project = await ctx.model.NovelProject.findOne({
      where: { id: episode.novel_project_id, user_id: userId },
      raw: true,
    });
    if (!project) {
      ctx.status = 404;
      ctx.body = ctx.helper.fail('关联项目不存在');
      return;
    }

    const storyline = await ctx.model.NovelStoryline.findOne({
      where: { novel_project_id: project.id },
      raw: true,
    });

    const messages = await ctx.service.api.novelScriptGenerate.buildEpisodeScriptMessages({
      ...project,
      storyline: storyline?.content || '',
    }, episode);

    await ctx.service.api.novelScriptGenerate.updateScriptStatus(episodeId, 1);

    const aiConfig = await ctx.service.api.modelConfig.getEffectiveAiConfig(userId, 'script_gen');
    if (!aiConfig) {
      ctx.body = ctx.helper.fail('请先在「模型设置」中配置并绑定文字模型', 4001);
      return;
    }

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
    const abortController = new AbortController();
    const streamState = { abortController, getContent: () => fullContent };
    activeGenerations.set(genKey, streamState);

    try {
      const stream = await chatStream(aiConfig, messages, {
        signal: abortController.signal,
        maxTokens: 8192,
      });

      ctx.req.on('close', () => {
        if (!saved) {
          clientAborted = true;
          abortController.abort();
        }
      });

      const guard = createStreamGuard();

      for await (const chunk of stream) {
        if (clientAborted) break;

        const delta = chunk.choices[0]?.delta?.content || '';
        if (!delta) continue;

        const safeDelta = guard.push(delta);
        if (guard.blocked()) {
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

      if (!clientAborted && !guard.blocked()) {
        const remaining = guard.flush();
        if (remaining) {
          fullContent += remaining;
          res.write(`data: ${JSON.stringify({ content: remaining })}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      }

      if (fullContent && fullContent !== BLOCKED_REPLY) {
        await ctx.service.api.novelScriptGenerate.updateScriptStatus(episodeId, 2, fullContent);
        saved = true;
      } else if (!fullContent) {
        await ctx.service.api.novelScriptGenerate.updateScriptStatus(episodeId, 3);
      }
    } catch (err) {
      if (!clientAborted && err.name !== 'APIUserAbortError' && !err.message?.includes('aborted')) {
        try {
          res.write(`data: ${JSON.stringify({ error: err.message || 'AI服务异常' })}\n\n`);
        } catch (_) {}
      }
    } finally {
      activeGenerations.delete(genKey);

      if (!saved && fullContent && fullContent !== BLOCKED_REPLY) {
        try {
          await ctx.service.api.novelScriptGenerate.updateScriptStatus(episodeId, 2, fullContent);
        } catch (saveErr) {
          try {
            await ctx.service.api.novelScriptGenerate.updateScriptStatus(episodeId, 3);
          } catch (_) {}
        }
      } else if (!saved && !fullContent) {
        try {
          await ctx.service.api.novelScriptGenerate.updateScriptStatus(episodeId, 3);
        } catch (_) {}
      }

      res.end();
    }
  }

  async stopGenerate() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const episodeId = ctx.helper.decodeId(ctx.params.id);

    if (!episodeId) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('无效的剧集ID');
      return;
    }

    const genKey = `novel_script_${userId}_${episodeId}`;
    const streamState = activeGenerations.get(genKey);
    if (streamState) {
      streamState.abortController.abort();
      ctx.body = ctx.helper.success({ stopped: true });
      return;
    }
    ctx.body = ctx.helper.success({ stopped: false, message: '没有进行中的生成任务' });
  }

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
    const episode = await ctx.model.NovelEpisode.findOne({
      where: { id: episodeId, user_id: userId },
      raw: true,
    });
    if (!episode) {
      ctx.status = 404;
      ctx.body = ctx.helper.fail('剧集不存在');
      return;
    }

    if (episode.script_locked === 1 && scriptLocked !== 0) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('台本已锁定，请先解锁再编辑');
      return;
    }

    const updateData = {};
    if (scriptContent !== undefined) {
      updateData.script_content = scriptContent;
      updateData.script_status = scriptContent.trim() ? 2 : 0;
    }
    if (scriptLocked !== undefined) {
      updateData.script_locked = scriptLocked;
    }

    await ctx.model.NovelEpisode.update(updateData, {
      where: { id: episodeId },
    });

    ctx.body = ctx.helper.success({ message: '保存成功' });
  }
}

module.exports = NovelScriptGenerateController;
