'use strict';

const { Controller } = require('egg');

/* 活跃的 Agent 流：key = `${userId}_${projectId}`, value = { abortController } */
const activeAgentStreams = new Map();

/**
 * 小说 Agent 控制器（C端）
 * 处理 Agent 对话流式交互、历史查询、中断
 */
class NovelAgentController extends Controller {

  /**
   * Agent 对话（SSE 流式）
   * POST /api/novel-agent/chat
   * body: { projectId, message }
   */
  async chat() {
    const { ctx, app } = this;
    const userId = ctx.state.user.id;
    const { projectId, message } = ctx.request.body;

    if (!projectId || !message) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('缺少 projectId 或 message 参数');
      return;
    }

    const realProjectId = ctx.helper.decodeId(projectId);
    if (!realProjectId) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('无效的项目ID');
      return;
    }

    /* 验证项目归属 */
    const project = await ctx.model.NovelProject.findOne({
      where: { id: realProjectId, user_id: userId },
      raw: true,
    });
    if (!project) {
      ctx.status = 404;
      ctx.body = ctx.helper.fail('项目不存在');
      return;
    }

    /* 设置 SSE 响应，显式禁用 Node/EggJS 自带超时 */
    ctx.respond = false;
    const res = ctx.res;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });

    /* 禁用 Socket 超时，防止长任务被 Node 底层断开 */
    if (ctx.req.socket) ctx.req.socket.setTimeout(0);
    if (res.setTimeout) res.setTimeout(0);

    const abortController = new AbortController();
    const streamKey = `${userId}_${realProjectId}`;
    activeAgentStreams.set(streamKey, { abortController });

    let clientAborted = false;

    /* SSE 心跳：每 15 秒发一次，防止代理/浏览器因静默超时断连 */
    const heartbeatInterval = setInterval(() => {
      if (clientAborted) return;
      try {
        res.write(`data: ${JSON.stringify({ type: 'heartbeat', ts: Date.now() })}\n\n`);
      } catch (_) {
        clearInterval(heartbeatInterval);
      }
    }, 15000);


    ctx.req.on('close', () => {
      if (!clientAborted) {
        clientAborted = true;
        abortController.abort();
        clearInterval(heartbeatInterval);
      }
    });

    try {
      await ctx.service.api.novelAgent.chat(
        realProjectId, userId, message, res, abortController.signal,
        {}
      );

      if (!clientAborted) {
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      }
    } catch (err) {
      if (!clientAborted && err.name !== 'AbortError') {
        if (err.message === 'MODEL_NOT_CONFIGURED') {
          try {
            res.write(`data: ${JSON.stringify({ type: 'error', code: 'MODEL_NOT_CONFIGURED', message: '请先在设置中配置AI模型后再使用Agent功能' })}\n\n`);
          } catch (_) { /* 连接已断开 */ }
        } else {
          try {
            res.write(`data: ${JSON.stringify({ type: 'error', message: err.message || 'Agent服务异常' })}\n\n`);
          } catch (_) { /* 连接已断开 */ }
        }
      }
    } finally {
      clearInterval(heartbeatInterval);
      activeAgentStreams.delete(streamKey);

      res.end();
    }
  }

  /**
   * 停止 Agent 生成
   * POST /api/novel-agent/stop
   */
  async stop() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const { projectId } = ctx.request.body;

    if (!projectId) {
      ctx.body = ctx.helper.fail('缺少 projectId');
      return;
    }

    const realProjectId = ctx.helper.decodeId(projectId);
    if (!realProjectId) {
      ctx.body = ctx.helper.fail('无效的项目ID');
      return;
    }

    const streamKey = `${userId}_${realProjectId}`;
    const streamState = activeAgentStreams.get(streamKey);

    if (streamState) {
      streamState.abortController.abort();
      ctx.body = ctx.helper.success({ stopped: true });
    } else {
      ctx.body = ctx.helper.success({ stopped: false, message: '没有进行中的生成' });
    }
  }

  /**
   * 获取对话历史
   * GET /api/novel-agent/history?projectId=xxx
   */
  async history() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const { projectId } = ctx.query;

    if (!projectId) {
      ctx.body = ctx.helper.fail('缺少 projectId');
      return;
    }

    const realProjectId = ctx.helper.decodeId(projectId);
    if (!realProjectId) {
      ctx.body = ctx.helper.fail('无效的项目ID');
      return;
    }

    const list = await ctx.service.api.novelAgent.getHistoryForDisplay(realProjectId, userId);
    ctx.body = ctx.helper.success(list);
  }

  /**
   * 清空对话历史
   * DELETE /api/novel-agent/history?projectId=xxx
   */
  async clearHistory() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const { projectId } = ctx.query;

    if (!projectId) {
      ctx.body = ctx.helper.fail('缺少 projectId');
      return;
    }

    const realProjectId = ctx.helper.decodeId(projectId);
    if (!realProjectId) {
      ctx.body = ctx.helper.fail('无效的项目ID');
      return;
    }

    await ctx.service.api.novelAgent.clearHistory(realProjectId, userId);
    ctx.body = ctx.helper.success(null, '已清空对话历史');
  }
}

module.exports = NovelAgentController;
