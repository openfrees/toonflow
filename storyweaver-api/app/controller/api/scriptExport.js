'use strict';

const { Controller } = require('egg');
const fs = require('fs');
const path = require('path');

/**
 * 剧本导出控制器（C端）
 * 处理剧本导出 Word 文档的流式接口
 */
class ScriptExportController extends Controller {

  /**
   * 流式导出 Word 文档
   * GET /api/script/:id/export-word?token=xxx
   */
  async exportWord() {
    const { ctx } = this;

    /* 从 URL 参数获取 token（EventSource 不支持自定义 Headers） */
    const token = ctx.query.token;
    if (!token) {
      ctx.body = ctx.helper.fail('缺少认证令牌', 401);
      return;
    }

    /* 手动验证 token 获取用户信息 */
    let userId;
    try {
      const decoded = ctx.app.jwt.verify(token, ctx.app.config.jwt.secret);
      userId = decoded.id;
    } catch (e) {
      ctx.body = ctx.helper.fail('认证令牌无效', 401);
      return;
    }

    /* 解码混淆ID */
    const scriptId = ctx.helper.decodeId(ctx.params.id);
    if (!scriptId) {
      ctx.body = ctx.helper.fail('无效的剧本ID');
      return;
    }
    const mode = ctx.query.mode === 'novel' ? 'novel' : 'script';

    /* 设置 SSE 响应（使用原生 res 流输出） */
    ctx.status = 200;
    ctx.type = 'text/event-stream';
    ctx.set('Cache-Control', 'no-cache');
    ctx.set('Connection', 'keep-alive');
    ctx.set('X-Accel-Buffering', 'no');
    // 关闭 Koa/Egg 默认的自动响应，让我们自己控制 res.write/end
    ctx.respond = false;

    const res = ctx.res;

    /* 生成唯一任务ID */
    const { v4: uuidv4 } = require('uuid');
    const taskId = uuidv4();

    /* 用于存储任务状态，供取消接口读取 */
    const taskStatus = {
      cancelled: false,
      filePath: null,
    };
    /* 挂载到 app 上供取消接口访问 */
    ctx.app.scriptExportTasks = ctx.app.scriptExportTasks || {};
    ctx.app.scriptExportTasks[taskId] = taskStatus;

    /* 辅助函数：发送 SSE 事件 */
    const sendEvent = (event, data) => {
      if (ctx.req.socket.destroyed || taskStatus.cancelled) {
        return false;
      }
      try {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        return true;
      } catch (e) {
        return false;
      }
    };

    try {
      /* 发送任务开始 */
      sendEvent('start', { taskId, message: '开始生成 Word 文档' });

      /* 调用 service 执行导出逻辑 */
      const result = await ctx.service.api.scriptExport.exportWord({
        scriptId,
        userId,
        mode,
        taskId,
        taskStatus,
        sendEvent,
      });

      if (taskStatus.cancelled) {
        /* 已取消，清理文件 */
        if (taskStatus.filePath && fs.existsSync(taskStatus.filePath)) {
          fs.unlinkSync(taskStatus.filePath);
        }
        sendEvent('cancelled', { message: '用户取消导出' });
        return;
      }

      /* 导出成功 */
      sendEvent('done', {
        message: '导出完成',
        downloadUrl: result.downloadUrl,
      });

    } catch (e) {
      /* 清理已生成的文件 */
      if (taskStatus.filePath && fs.existsSync(taskStatus.filePath)) {
        try {
          fs.unlinkSync(taskStatus.filePath);
        } catch (cleanupErr) {
          ctx.logger.warn('[ScriptExport] 导出失败后清理临时文件失败: taskId=%s, message=%s', taskId, cleanupErr.message);
        }
      }
      ctx.logger.error('[ScriptExport] 导出失败: scriptId=%s, userId=%s, mode=%s, message=%s', scriptId, userId, mode, e.message);
      sendEvent('error', {
        message: e.message || '导出失败',
      });
    } finally {
      try {
        // 通知前端可以关闭连接
        res.write('event: close\ndata: {}\n\n');
        res.end();
      } catch (e) {
        // ignore
      }
    }
  }

  /**
   * 取消导出
   * POST /api/script-export/:taskId/cancel
   */
  async cancelExport() {
    const { ctx } = this;
    const { taskId } = ctx.params;

    if (!taskId) {
      ctx.body = ctx.helper.fail('缺少任务ID');
      return;
    }

    const tasks = ctx.app.scriptExportTasks || {};
    const task = tasks[taskId];

    if (!task) {
      ctx.body = ctx.helper.fail('任务不存在或已完成');
      return;
    }

    /* 标记为已取消 */
    task.cancelled = true;

    /* 如果文件已生成，删除它 */
    if (task.filePath && fs.existsSync(task.filePath)) {
      try {
        fs.unlinkSync(task.filePath);
      } catch (err) {
        ctx.logger.warn('[ScriptExport] 取消导出时删除临时文件失败: taskId=%s, message=%s', taskId, err.message);
      }
    }

    ctx.body = ctx.helper.success({ message: '已取消导出' });
  }

  /**
   * 下载导出的文件
   * GET /api/script-export/download/:taskId
   */
  async download() {
    const { ctx } = this;
    const { taskId } = ctx.params;

    if (!taskId) {
      ctx.status = 400;
      ctx.body = '缺少任务ID';
      return;
    }

    try {
      /* 根据 taskId 拼接临时文件路径 */
      const tempDir = path.join(ctx.app.config.baseDir, 'temp');
      const fileName = `script_export_${taskId}.docx`;
      const filePath = path.join(tempDir, fileName);

      if (!fs.existsSync(filePath)) {
        ctx.status = 404;
        ctx.body = '文件不存在或已过期';
        return;
      }

      /* 设置响应头：统一使用 ASCII 文件名，避免 Header 字符集问题 */
      ctx.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      ctx.set('Content-Disposition', 'attachment; filename="script.docx"');

      /* 使用 buffer 返回文件内容 */
      const buffer = fs.readFileSync(filePath);
      ctx.body = buffer;

      /* 返回后删除临时文件 */
      try {
        fs.unlinkSync(filePath);
      } catch (cleanupErr) {
        ctx.logger.warn('[ScriptExport] 下载完成后删除临时文件失败: taskId=%s, message=%s', taskId, cleanupErr.message);
      }
    } catch (err) {
      ctx.logger.error('[ScriptExport] 下载失败: taskId=%s, message=%s', taskId, err.message);
      ctx.status = 500;
      ctx.body = '文件下载失败';
    }
  }
}

module.exports = ScriptExportController;
