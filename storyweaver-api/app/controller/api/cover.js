'use strict';

const { Controller } = require('egg');
const { chatStream } = require('../../lib/ai_chat');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

/**
 * 封面图控制器（C端）
 * 处理封面描述词生成（流式SSE）、封面图生成
 * 支持两种项目类型：script（自己写剧本）/ novel（小说转剧本）
 */
class CoverController extends Controller {

  /**
   * 根据 type 参数查找对应的项目记录并验证归属
   * @param {string} type - 'script' | 'novel'
   * @param {number} realId - 解码后的真实ID
   * @param {number} userId - 当前用户ID
   * @returns {object|null} 项目记录
   */
  async _findProject(type, realId, userId) {
    const { ctx } = this;
    if (type === 'novel') {
      return ctx.model.NovelProject.findOne({
        where: { id: realId, user_id: userId },
        raw: true,
      });
    }
    return ctx.model.Script.findOne({
      where: { id: realId, user_id: userId },
      raw: true,
    });
  }

  /**
   * 生成封面描述词（流式SSE）
   * POST /api/cover/generate-prompt
   * body: { scriptId, type?: 'script'|'novel' }
   */
  async generatePrompt() {
    const { ctx, app } = this;
    const userId = ctx.state.user.id;
    const { scriptId, type = 'script' } = ctx.request.body;

    if (!scriptId) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('缺少scriptId参数');
      return;
    }

    const realId = ctx.helper.decodeId(scriptId);
    if (!realId) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('无效的项目ID');
      return;
    }

    /* 验证项目归属 */
    const project = await this._findProject(type, realId, userId);
    if (!project) {
      ctx.status = 404;
      ctx.body = ctx.helper.fail('项目不存在');
      return;
    }

    /* 根据类型构建不同的 prompt 输入 */
    const scriptInfo = type === 'novel'
      ? await ctx.service.api.cover.buildNovelCoverPromptInput(realId)
      : await ctx.service.api.cover.buildCoverPromptInput(realId);

    const messages = ctx.service.api.cover.buildCoverPromptMessages(scriptInfo);

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
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });

    let fullContent = '';

    try {
      const stream = await chatStream(aiConfig, messages, {
        maxTokens: 1024,
        temperature: 0.9,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        const content = delta.content || '';
        if (content) {
          fullContent += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      /* 保存描述词到对应模型 */
      if (fullContent) {
        await ctx.service.api.cover.saveCoverPrompt(realId, fullContent.trim(), type);
      }


      res.write(`data: ${JSON.stringify({
        done: true,
        coverUrl: project.cover || '',
      })}\n\n`);
    } catch (err) {
      try {
        res.write(`data: ${JSON.stringify({ error: err.message || '生成描述词失败' })}\n\n`);
      } catch (_) { /* 连接已断开 */ }
    } finally {
      res.end();
    }
  }

  /**
   * 生成封面图
   * POST /api/cover/generate-image
   * body: { scriptId, type?: 'script'|'novel' }
   */
  async generateImage() {
    const { ctx, app } = this;
    const userId = ctx.state.user.id;
    const { scriptId, type = 'script' } = ctx.request.body;

    if (!scriptId) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('缺少scriptId参数');
      return;
    }

    const realId = ctx.helper.decodeId(scriptId);
    if (!realId) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('无效的项目ID');
      return;
    }

    /* 验证项目归属 */
    const project = await this._findProject(type, realId, userId);
    if (!project) {
      ctx.status = 404;
      ctx.body = ctx.helper.fail('项目不存在');
      return;
    }

    /* 获取封面描述词 */
    const coverPrompt = await ctx.service.api.cover.getCoverPrompt(realId, type);
    if (!coverPrompt) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('请先生成封面描述词');
      return;
    }


    try {
      /* 调用火山引擎Doubao-Seedream生成图片 */
      const imageConfig = await ctx.service.api.modelConfig.getEffectiveAiConfig(userId, 'image_gen');
      if (!imageConfig) {
        ctx.body = ctx.helper.fail('请先在「模型设置」中配置并绑定图片模型', 4001);
        return;
      }
      const client = new OpenAI({
        apiKey: imageConfig.apiKey,
        baseURL: imageConfig.baseURL,
      });

      const response = await client.images.generate({
        model: imageConfig.model,
        prompt: coverPrompt,
        n: 1,
        size: imageConfig.size,
        response_format: 'url',
      });

      const imageUrl = response.data[0]?.url;
      if (!imageUrl) {
        ctx.body = ctx.helper.fail('图片生成失败，未返回图片地址');
        return;
      }


      /* 下载图片到本地 */
      const coversDir = path.join(app.baseDir, 'app/public/covers');
      if (!fs.existsSync(coversDir)) {
        fs.mkdirSync(coversDir, { recursive: true });
      }

      const prefix = type === 'novel' ? 'novel_cover' : 'cover';
      const fileName = `${prefix}_${realId}_${Date.now()}.png`;
      const filePath = path.join(coversDir, fileName);

      await this._downloadImage(imageUrl, filePath);

      /* 保存路径到对应模型 */
      const coverPath = `/public/covers/${fileName}`;
      await ctx.service.api.cover.saveCoverImage(realId, coverPath, type);


      ctx.body = ctx.helper.success({ cover: coverPath }, '封面图生成成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(`封面图生成失败: ${err.message}`);
    }
  }

  /**
   * 下载远程图片到本地
   * @param {string} url - 远程图片URL
   * @param {string} destPath - 本地保存路径
   * @returns {Promise<void>}
   * @private
   */
  _downloadImage(url, destPath) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const file = fs.createWriteStream(destPath);

      protocol.get(url, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          file.close();
          if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
          return this._downloadImage(response.headers.location, destPath).then(resolve).catch(reject);
        }

        if (response.statusCode !== 200) {
          file.close();
          if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
          return reject(new Error(`下载失败，HTTP状态码: ${response.statusCode}`));
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      }).on('error', (err) => {
        file.close();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        reject(err);
      });
    });
  }
}

module.exports = CoverController;
