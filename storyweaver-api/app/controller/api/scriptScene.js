'use strict';

const { Controller } = require('egg');
const { chatStream } = require('../../lib/ai_chat');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class ScriptSceneController extends Controller {
  async list() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const scriptId = ctx.helper.decodeId(ctx.params.scriptId);
    if (!scriptId) {
      ctx.body = ctx.helper.fail('无效的剧本ID');
      return;
    }
    const scenes = await ctx.service.api.scriptScene.listScenes(scriptId, userId);
    ctx.body = ctx.helper.success({ scenes });
  }

  async save() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const scriptId = ctx.helper.decodeId(ctx.params.scriptId);
    if (!scriptId) {
      ctx.body = ctx.helper.fail('无效的剧本ID');
      return;
    }
    const scenes = Array.isArray(ctx.request.body?.scenes) ? ctx.request.body.scenes : [];
    const saved = await ctx.service.api.scriptScene.saveScenes(scriptId, userId, scenes);
    ctx.body = ctx.helper.success({ scenes: saved }, '保存成功');
  }

  async extractPrecheck() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const scriptId = ctx.helper.decodeId(ctx.params.scriptId);
    if (!scriptId) {
      ctx.body = ctx.helper.fail('无效的剧本ID');
      return;
    }
    const precheck = await ctx.service.api.scriptScene.getExtractPrecheck(scriptId, userId);
    ctx.body = ctx.helper.success(precheck);
  }

  async extract() {
    const { ctx, app } = this;
    const userId = ctx.state.user.id;
    const scriptId = ctx.helper.decodeId(ctx.params.scriptId);
    if (!scriptId) {
      ctx.body = ctx.helper.fail('无效的剧本ID');
      return;
    }

    const force = Boolean(ctx.request.body?.force);
    const precheck = await ctx.service.api.scriptScene.getExtractPrecheck(scriptId, userId);
    if (precheck.generatedEpisodes <= 0) {
      ctx.body = ctx.helper.fail('暂无可用大纲，请先生成大纲');
      return;
    }
    if (precheck.incomplete && !force) {
      ctx.status = 409;
      ctx.body = ctx.helper.fail('大纲尚未全部生成完成，请确认是否继续', 409);
      return;
    }

    const { episodes, batches } = await ctx.service.api.scriptScene.getOutlineBatches(scriptId, userId, 10);
    if (episodes.length === 0) {
      ctx.body = ctx.helper.fail('暂无可用大纲，请先生成大纲');
      return;
    }

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

    const writeEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      let scenes = await ctx.service.api.scriptScene.listScenes(scriptId, userId);
      const sceneMap = new Map(scenes.map(s => [ctx.service.api.scriptScene.normalizeName(s.name), s]));
      const extractedAiKeys = new Set();
      const findSceneKey = (candidate) => {
        if (!candidate) return '';
        if (sceneMap.has(candidate)) return candidate;
        for (const [key, scene] of sceneMap.entries()) {
          const aliases = Array.isArray(scene.aliases) ? scene.aliases : [];
          const matched = aliases.some(alias => ctx.service.api.scriptScene.normalizeName(alias) === candidate);
          if (matched) return key;
        }
        return '';
      };

      writeEvent({
        type: 'start',
        totalBatches: batches.length,
        totalEpisodes: episodes.length,
        existingScenes: scenes.length,
      });

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const startEpisode = Number(batch?.[0]?.episodeNumber || 0);
        const endEpisode = Number(batch?.[batch.length - 1]?.episodeNumber || 0);
        writeEvent({
          type: 'progress',
          batchIndex: i + 1,
          totalBatches: batches.length,
          startEpisode,
          endEpisode,
          totalEpisodes: episodes.length,
          message: `正在分析第 ${i + 1}/${batches.length} 组大纲...`,
        });

        const messages = ctx.service.api.scriptScene.buildExtractMessages(batch, scenes);
        const stream = await chatStream(aiConfig, messages, {
          maxTokens: 4096,
          temperature: 0.2,
        });

        let fullContent = '';
        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta?.content || chunk?.content || '';
          if (delta) fullContent += delta;
        }

        const extracted = ctx.service.api.scriptScene.parseAiScenes(fullContent);

        for (const item of extracted) {
          const normalized = ctx.service.api.scriptScene.normalizeScene({
            ...item,
            source: 'ai_extract',
          });
          if (!normalized.name) continue;
          const normalizedKey = ctx.service.api.scriptScene.normalizeName(normalized.name);
          if (!normalizedKey) continue;
          const key = findSceneKey(normalizedKey) || normalizedKey;

          let action = 'created';
          if (sceneMap.has(key)) {
            const existing = sceneMap.get(key);
            if (existing?.source === 'manual') {
              continue;
            }
            const merged = ctx.service.api.scriptScene.mergeScene(existing, normalized);
            sceneMap.set(key, merged);
            action = 'updated';
            extractedAiKeys.add(key);
          } else {
            sceneMap.set(key, normalized);
            extractedAiKeys.add(key);
          }

          scenes = Array.from(sceneMap.values());
          scenes = await ctx.service.api.scriptScene.saveScenes(scriptId, userId, scenes);
          writeEvent({
            type: 'scene_saved',
            action,
            scene: scenes.find(s => ctx.service.api.scriptScene.normalizeName(s.name) === key) || normalized,
            totalScenes: scenes.length,
            batchIndex: i + 1,
            totalBatches: batches.length,
          });
        }

        scenes = await ctx.service.api.scriptScene.listScenes(scriptId, userId);
        for (const s of scenes) {
          sceneMap.set(ctx.service.api.scriptScene.normalizeName(s.name), s);
        }
      }

      /* 本轮结束后：保留人工场景 + 本轮命中的AI场景，清理旧AI场景 */
      const cleanupScenes = [];
      for (const [key, scene] of sceneMap.entries()) {
        if (scene?.source === 'manual') {
          cleanupScenes.push(scene);
          continue;
        }
        if (extractedAiKeys.has(key)) {
          cleanupScenes.push(scene);
        }
      }
      scenes = await ctx.service.api.scriptScene.saveScenes(scriptId, userId, cleanupScenes);

      writeEvent({
        type: 'done',
        totalBatches: batches.length,
        totalEpisodes: episodes.length,
        totalScenes: scenes.length,
        scenes,
      });
    } catch (err) {
      writeEvent({
        type: 'error',
        message: err.message || '场景抽离失败，请稍后重试',
      });
    } finally {
      res.end();
    }
  }

  async uploadImage() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const sceneId = String(ctx.params.id || '').trim();
    if (!sceneId) {
      ctx.body = ctx.helper.fail('无效的场景ID');
      return;
    }
    const scriptId = ctx.helper.decodeId(ctx.request.body?.scriptId);
    if (!scriptId) {
      ctx.body = ctx.helper.fail('无效的剧本ID');
      return;
    }

    try {
      const scene = await ctx.service.api.scriptScene.getSceneById(scriptId, userId, sceneId);
      if (!scene) {
        ctx.body = ctx.helper.fail('场景不存在', 404);
        return;
      }

      const file = ctx.request.files[0];
      if (!file) {
        ctx.body = ctx.helper.fail('请选择要上传的图片');
        return;
      }

      const maxSize = 5 * 1024 * 1024;
      const fileStat = fs.statSync(file.filepath);
      if (fileStat.size > maxSize) {
        fs.unlinkSync(file.filepath);
        ctx.body = ctx.helper.fail('图片大小不能超过5MB');
        return;
      }

      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedMimeTypes.includes(file.mime)) {
        fs.unlinkSync(file.filepath);
        ctx.body = ctx.helper.fail('只支持jpg、png、webp格式的图片');
        return;
      }

      const ext = path.extname(file.filename).toLowerCase();
      const uniqueFilename = `${uuidv4()}_${Date.now()}${ext}`;
      const dateDir = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const uploadDir = path.join(this.app.baseDir, 'app/public/uploads/scenes', dateDir);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const targetPath = path.join(uploadDir, uniqueFilename);
      fs.copyFileSync(file.filepath, targetPath);
      fs.unlinkSync(file.filepath);
      const imagePath = `/public/uploads/scenes/${dateDir}/${uniqueFilename}`;

      if (scene.image) ctx.helper.removeUploadedFile(scene.image);
      await ctx.service.api.scriptScene.updateSceneFields(scriptId, userId, sceneId, { image: imagePath });

      ctx.body = ctx.helper.success({ image: imagePath }, '上传成功');
    } catch (err) {
      ctx.body = ctx.helper.fail('上传失败，请稍后重试');
    }
  }

  async updatePrompt() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const sceneId = String(ctx.params.id || '').trim();
    if (!sceneId) {
      ctx.body = ctx.helper.fail('无效的场景ID');
      return;
    }
    const scriptId = ctx.helper.decodeId(ctx.request.body?.scriptId);
    if (!scriptId) {
      ctx.body = ctx.helper.fail('无效的剧本ID');
      return;
    }

    const scene = await ctx.service.api.scriptScene.getSceneById(scriptId, userId, sceneId);
    if (!scene) {
      ctx.body = ctx.helper.fail('场景不存在', 404);
      return;
    }

    const imagePrompt = String(ctx.request.body?.imagePrompt || '');
    await ctx.service.api.scriptScene.updateSceneFields(scriptId, userId, sceneId, { imagePrompt });
    ctx.body = ctx.helper.success(null, '更新成功');
  }

  async generatePrompt() {
    const { ctx, app } = this;
    const userId = ctx.state.user.id;
    const sceneId = String(ctx.params.id || '').trim();
    if (!sceneId) {
      ctx.body = ctx.helper.fail('无效的场景ID');
      return;
    }
    const scriptId = ctx.helper.decodeId(ctx.request.body?.scriptId || ctx.query?.scriptId);
    if (!scriptId) {
      ctx.body = ctx.helper.fail('无效的剧本ID');
      return;
    }

    const scene = await ctx.service.api.scriptScene.getSceneById(scriptId, userId, sceneId);
    if (!scene) {
      ctx.body = ctx.helper.fail('场景不存在', 404);
      return;
    }

    const script = await ctx.service.api.scriptScene.getScript(scriptId, userId);
    const style = script?.style || '';

    const messages = [
      {
        role: 'system',
        content: `你是一位专业的AI绘画提示词专家。请根据用户提供的场景信息，生成一段用于AI图片生成的场景描述词（中文）。
要求：
1. 重点描述空间结构、材质细节、光线氛围、色彩气质、镜头构图
2. 保持短剧场景表达，能直接用于图像生成模型
3. 描述词长度控制在90-180字之间
4. 只输出描述词本身，不要添加解释或多余前后缀
5. 如提供画风信息，请自然融合到描述词中`,
      },
      {
        role: 'user',
        content: `请基于以下信息生成场景图描述词：\n场景名称：${scene.name || ''}\n环境描写：${scene.description || '无'}\n整部剧画风：${style || '未指定'}`,
      },
    ];

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
    try {
      const stream = await chatStream(aiConfig, messages, {
        maxTokens: 320,
        temperature: 0.7,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content || '';
        if (delta) {
          fullContent += delta;
          res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
        }
      }

      const imagePrompt = fullContent.trim();
      if (imagePrompt) {
        await ctx.service.api.scriptScene.updateSceneFields(scriptId, userId, sceneId, { imagePrompt });
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    } catch (err) {
      try {
        res.write(`data: ${JSON.stringify({ error: err.message || 'AI服务异常' })}\n\n`);
      } catch (_) {}
    } finally {
      res.end();
    }
  }

  async generateImage() {
    const { ctx, app } = this;
    const userId = ctx.state.user.id;
    const sceneId = String(ctx.params.id || '').trim();
    if (!sceneId) {
      ctx.body = ctx.helper.fail('无效的场景ID');
      return;
    }
    const scriptId = ctx.helper.decodeId(ctx.request.body?.scriptId);
    if (!scriptId) {
      ctx.body = ctx.helper.fail('无效的剧本ID');
      return;
    }

    const scene = await ctx.service.api.scriptScene.getSceneById(scriptId, userId, sceneId);
    if (!scene) {
      ctx.body = ctx.helper.fail('场景不存在', 404);
      return;
    }

    const script = await ctx.service.api.scriptScene.getScript(scriptId, userId);
    const customPrompt = String(ctx.request.body?.prompt || '').trim();
    const imagePrompt = customPrompt || scene.imagePrompt || this._buildSceneImagePrompt(scene, script?.style || '');

    try {
      const { OpenAI } = require('openai');
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
        prompt: imagePrompt,
        size: imageConfig.size,
        n: 1,
      });

      const remoteUrl = response.data[0]?.url;
      if (!remoteUrl) {
        ctx.body = ctx.helper.fail('图片生成失败，未返回图片URL');
        return;
      }

      const dateDir = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const uploadDir = path.join(app.baseDir, 'app/public/uploads/scenes', dateDir);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filename = `ai_${uuidv4()}_${Date.now()}.png`;
      const destPath = path.join(uploadDir, filename);
      await this._downloadImage(remoteUrl, destPath);

      const imagePath = `/public/uploads/scenes/${dateDir}/${filename}`;
      if (scene.image) ctx.helper.removeUploadedFile(scene.image);

      await ctx.service.api.scriptScene.updateSceneFields(scriptId, userId, sceneId, {
        image: imagePath,
        imagePrompt,
      });

      ctx.body = ctx.helper.success({
        image: imagePath,
        imagePrompt,
      }, '场景图生成成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(`场景图生成失败: ${err.message}`);
    }
  }

  _buildSceneImagePrompt(scene, style = '') {
    const parts = [];
    if (scene?.name) parts.push(`场景名称：${scene.name}`);
    if (scene?.description) parts.push(`环境描写：${scene.description}`);
    if (style) parts.push(`画风：${style}`);
    parts.push('构图完整，细节清晰，电影级光影，适合短剧场景设定图');
    return parts.join('，');
  }

  _downloadImage(url, destPath) {
    const https = require('https');
    const http = require('http');
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
        file.on('finish', () => file.close(resolve));
      }).on('error', (err) => {
        file.close();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        reject(err);
      });
    });
  }
}

module.exports = ScriptSceneController;
