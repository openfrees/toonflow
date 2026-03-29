'use strict';

const { Controller } = require('egg');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * 小说资产控制器（C端）
 * 处理小说角色/场景的描述词生成、图片上传/AI生成
 * 与 scriptCharacter 接口逻辑一致，但操作 novel_asset 表
 */
class NovelAssetController extends Controller {

  /**
   * 更新资产字段（手动编辑描述词时的防抖保存）
   * PUT /api/novel-asset/:id
   */
  async update() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const assetId = Number(ctx.params.id);
    if (!assetId) {
      ctx.body = ctx.helper.fail('无效的资产ID');
      return;
    }

    const isScene = ctx.request.body?.assetType === 'scene' || ctx.request.body?.sceneImagePrompt !== undefined;
    const assetType = isScene ? '场景' : '角色';
    const asset = await this._getVerifiedAsset(assetId, userId, assetType);
    if (!asset) return;

    const parsed = this._safeJsonParse(asset.prompt, {});
    if (isScene) {
      const base = (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
        ? parsed
        : { description: asset.intro || '', image: '', imagePrompt: '' };
      const { sceneImagePrompt } = ctx.request.body;
      if (sceneImagePrompt !== undefined) {
        await ctx.service.api.novelProject.updateCharacterAssetField(assetId, base, { imagePrompt: sceneImagePrompt });
      }
    } else {
      const { avatarPrompt } = ctx.request.body;
      if (avatarPrompt !== undefined) {
        await ctx.service.api.novelProject.updateCharacterAssetField(assetId, parsed, { avatarPrompt });
      }
    }

    ctx.body = ctx.helper.success(null, '更新成功');
  }

  /**
   * 上传角色形象图
   * POST /api/novel-asset/:id/upload-avatar
   */
  async uploadAvatar() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const characterId = Number(ctx.params.id);
    if (!characterId) {
      ctx.body = ctx.helper.fail('无效的角色ID');
      return;
    }

    try {
      const asset = await this._getVerifiedAsset(characterId, userId, '角色');
      if (!asset) return;

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
      const uploadDir = path.join(this.app.baseDir, 'app/public/uploads/characters', dateDir);

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const targetPath = path.join(uploadDir, uniqueFilename);
      fs.renameSync(file.filepath, targetPath);

      const avatarUrl = `/public/uploads/characters/${dateDir}/${uniqueFilename}`;

      const parsed = this._safeJsonParse(asset.prompt, {});

      /* 清理旧图片 */
      if (parsed.avatar) ctx.helper.removeUploadedFile(parsed.avatar);

      await ctx.service.api.novelProject.updateCharacterAssetField(characterId, parsed, { avatar: avatarUrl });

      ctx.body = ctx.helper.success({ avatar: avatarUrl }, '上传成功');
    } catch (err) {
      ctx.logger.error('[NovelAsset] 角色头像上传失败:', err);
      ctx.body = ctx.helper.fail('上传失败，请稍后重试');
    }
  }

  /**
   * 上传场景图片
   * POST /api/novel-asset/:id/upload-scene-image
   */
  async uploadSceneImage() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const sceneId = Number(ctx.params.id);
    if (!sceneId) {
      ctx.body = ctx.helper.fail('无效的场景ID');
      return;
    }

    try {
      const asset = await this._getVerifiedAsset(sceneId, userId, '场景');
      if (!asset) return;

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
      fs.renameSync(file.filepath, targetPath);
      const imageUrl = `/public/uploads/scenes/${dateDir}/${uniqueFilename}`;

      const parsed = this._safeJsonParse(asset.prompt, {});
      const scenePayload = (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
        ? parsed
        : { description: asset.intro || '', image: '', imagePrompt: '' };

      if (scenePayload.image) ctx.helper.removeUploadedFile(scenePayload.image);
      await ctx.service.api.novelProject.updateCharacterAssetField(sceneId, scenePayload, { image: imageUrl });
      ctx.body = ctx.helper.success({ image: imageUrl }, '上传成功');
    } catch (err) {
      ctx.logger.error('[NovelAsset] 场景图上传失败:', err);
      ctx.body = ctx.helper.fail('上传失败，请稍后重试');
    }
  }

  /**
   * AI生成角色头像
   * POST /api/novel-asset/:id/generate-avatar
   * 复用火山引擎 Doubao-Seedream 图片生成能力
   */
  async generateAvatar() {
    const { ctx, app } = this;
    const userId = ctx.state.user.id;
    const characterId = Number(ctx.params.id);
    if (!characterId) {
      ctx.body = ctx.helper.fail('无效的角色ID');
      return;
    }

    const asset = await this._getVerifiedAsset(characterId, userId, '角色');
    if (!asset) return;

    const parsed = this._safeJsonParse(asset.prompt, {});

    const { prompt: customPrompt } = ctx.request.body;
    let avatarPrompt = customPrompt;
    if (!avatarPrompt) {
      avatarPrompt = this._buildAvatarPrompt(parsed);
    }

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
        prompt: avatarPrompt,
        size: imageConfig.size,
        n: 1,
      });

      const imageUrl = response.data[0]?.url;
      if (!imageUrl) {
        ctx.body = ctx.helper.fail('图片生成失败，未返回图片URL');
        return;
      }

      const dateDir = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const uploadDir = path.join(app.baseDir, 'app/public/uploads/characters', dateDir);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filename = `ai_${uuidv4()}_${Date.now()}.png`;
      const destPath = path.join(uploadDir, filename);
      await this._downloadImage(imageUrl, destPath);

      const avatarPath = `/public/uploads/characters/${dateDir}/${filename}`;

      /* 清理旧图片 */
      if (parsed.avatar) ctx.helper.removeUploadedFile(parsed.avatar);

      await ctx.service.api.novelProject.updateCharacterAssetField(characterId, parsed, {
        avatar: avatarPath,
        avatarPrompt,
      });

      ctx.body = ctx.helper.success({
        avatar: avatarPath,
        avatarPrompt,
      }, '头像生成成功');
    } catch (err) {
      ctx.logger.error('[NovelAsset] AI生成头像失败:', err);
      ctx.body = ctx.helper.fail(`头像生成失败: ${err.message}`);
    }
  }

  /**
   * AI生成场景图片
   * POST /api/novel-asset/:id/generate-scene-image
   */
  async generateSceneImage() {
    const { ctx, app } = this;
    const userId = ctx.state.user.id;
    const sceneId = Number(ctx.params.id);
    if (!sceneId) {
      ctx.body = ctx.helper.fail('无效的场景ID');
      return;
    }

    const asset = await this._getVerifiedAsset(sceneId, userId, '场景');
    if (!asset) return;

    const parsed = this._safeJsonParse(asset.prompt, {});
    const scenePayload = (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
      ? parsed
      : { description: asset.intro || '', image: '', imagePrompt: '' };

    const project = await ctx.model.NovelProject.findOne({
      where: { id: asset.novel_project_id },
      attributes: ['art_style'],
      raw: true,
    });
    const { prompt: customPrompt } = ctx.request.body;
    const imagePrompt = (customPrompt || scenePayload.imagePrompt || '').trim()
      || this._buildSceneImagePrompt(asset, scenePayload, project?.art_style || '');

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
      if (scenePayload.image) ctx.helper.removeUploadedFile(scenePayload.image);

      await ctx.service.api.novelProject.updateCharacterAssetField(sceneId, scenePayload, {
        image: imagePath,
        imagePrompt,
      });

      ctx.body = ctx.helper.success({
        image: imagePath,
        imagePrompt,
      }, '场景图生成成功');
    } catch (err) {
      ctx.logger.error('[NovelAsset] AI生成场景图失败:', err);
      ctx.body = ctx.helper.fail(`场景图生成失败: ${err.message}`);
    }
  }

  /**
   * AI生成角色形象描述词（SSE流式）
   * POST /api/novel-asset/:id/generate-prompt
   * 根据角色结构化信息，调用大模型生成适合图片生成的描述词
   */
  async generatePrompt() {
    const { ctx, app } = this;
    const userId = ctx.state.user.id;
    const characterId = Number(ctx.params.id);
    if (!characterId) {
      ctx.body = ctx.helper.fail('无效的角色ID');
      return;
    }

    const asset = await this._getVerifiedAsset(characterId, userId, '角色');
    if (!asset) return;

    const parsed = this._safeJsonParse(asset.prompt, {});

    const charInfo = [];
    if (asset.name) charInfo.push(`姓名：${asset.name}`);
    if (parsed.gender) charInfo.push(`性别：${parsed.gender}`);
    if (parsed.age) charInfo.push(`年龄：${parsed.age}`);

    const personalityList = Array.isArray(parsed.personality) ? parsed.personality : [];
    if (personalityList.length > 0) {
      charInfo.push(`性格：${personalityList.map(p => p.keyword || p.desc || '').filter(Boolean).join('、')}`);
    }

    const appearanceList = Array.isArray(parsed.appearance) ? parsed.appearance : [];
    if (appearanceList.length > 0) {
      charInfo.push(`容貌：${appearanceList.map(a => `${a.keyword || ''}${a.desc ? '(' + a.desc + ')' : ''}`).filter(Boolean).join('、')}`);
    }

    if (parsed.background) charInfo.push(`人物经历：${parsed.background}`);

    const roleTypeLabels = {
      protagonist: '主角', antagonist: '反派', ally: '朋友/盟友',
      lover: '恋人', rival: '对手/竞争者', other: '配角',
    };
    charInfo.push(`角色定位：${roleTypeLabels[parsed.roleType] || '配角'}`);

    const messages = [
      {
        role: 'system',
        content: `你是一位专业的AI绘画提示词专家。请根据用户提供的角色信息，生成一段用于AI图片生成的角色画像描述词（中文）。
要求：
1. 描述词应包含人物的外貌特征、气质、服饰风格等视觉元素
2. 风格偏向古风/现代短剧角色立绘
3. 描述词长度控制在80-150字之间
4. 只输出描述词本身，不要加任何前缀、解释或标点符号以外的内容
5. 描述词应适合直接用于Stable Diffusion或类似AI绘画工具`,
      },
      {
        role: 'user',
        content: `请根据以下角色信息生成画像描述词：\n${charInfo.join('\n')}`,
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
      const { chatStream } = require('../../lib/ai_chat');
      const stream = await chatStream(aiConfig, messages, {
        maxTokens: 300,
        temperature: 0.7,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          fullContent += delta;
          res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
        }
      }

      const avatarPrompt = fullContent.trim();
      if (avatarPrompt) {
        await ctx.service.api.novelProject.updateCharacterAssetField(characterId, parsed, { avatarPrompt });

        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      }
    } catch (err) {
      ctx.logger.error('[NovelAsset] AI生成描述词失败:', err);
      try {
        res.write(`data: ${JSON.stringify({ error: err.message || 'AI服务异常' })}\n\n`);
      } catch (_) { /* 连接已断开 */ }
    } finally {
      res.end();
    }
  }

  /**
   * AI生成场景图片描述词（SSE流式）
   * POST /api/novel-asset/:id/generate-scene-prompt
   */
  async generateScenePrompt() {
    const { ctx, app } = this;
    const userId = ctx.state.user.id;
    const sceneId = Number(ctx.params.id);
    if (!sceneId) {
      ctx.body = ctx.helper.fail('无效的场景ID');
      return;
    }

    const asset = await this._getVerifiedAsset(sceneId, userId, '场景');
    if (!asset) return;

    const parsed = this._safeJsonParse(asset.prompt, {});
    const scenePayload = (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
      ? parsed
      : { description: asset.intro || '', image: '', imagePrompt: '' };

    const project = await ctx.model.NovelProject.findOne({
      where: { id: asset.novel_project_id },
      attributes: ['art_style', 'genres', 'title'],
      raw: true,
    });
    const artStyle = project?.art_style || '';

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
        content: `请基于以下信息生成场景图描述词：\n场景名称：${asset.name || ''}\n环境描写：${scenePayload.description || asset.intro || '无'}\n整部剧画风：${artStyle || '未指定'}`,
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
      const { chatStream } = require('../../lib/ai_chat');
      const stream = await chatStream(aiConfig, messages, {
        maxTokens: 320,
        temperature: 0.7,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          fullContent += delta;
          res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
        }
      }

      const sceneImagePrompt = fullContent.trim();
      if (sceneImagePrompt) {
        await ctx.service.api.novelProject.updateCharacterAssetField(sceneId, scenePayload, { imagePrompt: sceneImagePrompt });
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      }
    } catch (err) {
      ctx.logger.error('[NovelAsset] AI生成场景描述词失败:', err);
      try {
        res.write(`data: ${JSON.stringify({ error: err.message || 'AI服务异常' })}\n\n`);
      } catch (_) {}
    } finally {
      res.end();
    }
  }

  /**
   * 查找资产并验证所属项目归属当前用户
   * @param {number} assetId - novel_asset.id
   * @param {number} userId - 用户ID
   * @param {string} type - 资产类型（角色/场景）
   * @returns {object|null} asset 记录，校验失败返回 null
   * @private
   */
  async _getVerifiedAsset(assetId, userId, type = '角色') {
    const { ctx } = this;
    const asset = await ctx.model.NovelAsset.findOne({
      where: { id: assetId, type },
      raw: true,
    });
    if (!asset) {
      ctx.body = ctx.helper.fail(type === '场景' ? '场景不存在' : '角色不存在', 404);
      return null;
    }

    const project = await ctx.model.NovelProject.findOne({
      where: { id: asset.novel_project_id, user_id: userId },
      attributes: ['id'],
      raw: true,
    });
    if (!project) {
      ctx.body = ctx.helper.fail('项目不存在或无权操作', 403);
      return null;
    }

    return asset;
  }

  /**
   * 根据角色信息构建图片生成兜底描述词
   * @private
   */
  _buildAvatarPrompt(parsed) {
    const parts = ['一个'];
    if (parsed.gender) parts.push(parsed.gender === '女' ? '女性' : '男性');
    if (parsed.age) parts.push(`${parsed.age}`);

    const appearanceList = Array.isArray(parsed.appearance) ? parsed.appearance : [];
    if (appearanceList.length > 0) {
      const descs = appearanceList.map(a => a.desc || a.keyword).join('，');
      parts.push(`，${descs}`);
    }

    parts.push('，古风角色立绘，正面半身像，高清，精致，白色背景');
    return parts.join('');
  }

  _buildSceneImagePrompt(asset, scenePayload, artStyle = '') {
    const parts = [];
    if (asset?.name) parts.push(`场景名称：${asset.name}`);
    if (scenePayload?.description || asset?.intro) parts.push(`环境描写：${scenePayload?.description || asset?.intro}`);
    if (artStyle) parts.push(`画风：${artStyle}`);
    parts.push('构图完整，细节清晰，电影级光影，适合短剧海报与场景设定图');
    return parts.join('，');
  }

  _safeJsonParse(str, defaultValue = null) {
    if (!str) return defaultValue;
    try {
      return JSON.parse(str);
    } catch (_) {
      return defaultValue;
    }
  }

  /**
   * 下载远程图片到本地
   * @private
   */
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

module.exports = NovelAssetController;
