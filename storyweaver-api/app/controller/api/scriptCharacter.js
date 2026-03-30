'use strict';

const { Controller } = require('egg');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * 剧本角色控制器（C端）
 * 处理角色的CRUD、文本解析、图片上传/生成
 */
class ScriptCharacterController extends Controller {

  /**
   * 获取剧本的所有结构化角色
   * GET /api/script/:scriptId/characters
   */
  async list() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const scriptId = ctx.helper.decodeId(ctx.params.scriptId);
    if (!scriptId) {
      ctx.body = ctx.helper.fail('无效的剧本ID');
      return;
    }

    const result = await ctx.service.api.scriptCharacter.list(scriptId, userId);
    ctx.body = ctx.helper.success(result);
  }

  /**
   * 批量保存角色（全量替换）
   * POST /api/script/:scriptId/characters
   */
  async batchSave() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const scriptId = ctx.helper.decodeId(ctx.params.scriptId);
    if (!scriptId) {
      ctx.body = ctx.helper.fail('无效的剧本ID');
      return;
    }

    const { characters } = ctx.request.body;
    if (!Array.isArray(characters)) {
      ctx.body = ctx.helper.fail('characters必须是数组');
      return;
    }

    await ctx.service.api.scriptCharacter.batchSave(scriptId, userId, characters);
    /* 返回保存后的最新数据 */
    const result = await ctx.service.api.scriptCharacter.list(scriptId, userId);
    ctx.body = ctx.helper.success(result, '保存成功');
  }

  /**
   * 更新单个角色
   * PUT /api/script-character/:id
   */
  async update() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const characterId = ctx.helper.decodeId(ctx.params.id);
    if (!characterId) {
      ctx.body = ctx.helper.fail('无效的角色ID');
      return;
    }

    await ctx.service.api.scriptCharacter.update(characterId, userId, ctx.request.body);
    ctx.body = ctx.helper.success(null, '更新成功');
  }

  /**
   * 删除单个角色
   * DELETE /api/script-character/:id
   */
  async destroy() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const characterId = ctx.helper.decodeId(ctx.params.id);
    if (!characterId) {
      ctx.body = ctx.helper.fail('无效的角色ID');
      return;
    }

    await ctx.service.api.scriptCharacter.destroy(characterId, userId);
    ctx.body = ctx.helper.success(null, '删除成功');
  }

  /**
   * 从人物介绍文本解析结构化角色
   * POST /api/script/:scriptId/characters/parse
   */
  async parseFromText() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const scriptId = ctx.helper.decodeId(ctx.params.scriptId);
    if (!scriptId) {
      ctx.body = ctx.helper.fail('无效的剧本ID');
      return;
    }

    const { text } = ctx.request.body;
    if (!text) {
      ctx.body = ctx.helper.fail('缺少人物介绍文本');
      return;
    }

    const result = await ctx.service.api.scriptCharacter.parseFromText(scriptId, userId, text);
    ctx.body = ctx.helper.success(result, '解析成功');
  }

  /**
   * 预览解析结果（只解析不保存），返回新旧对比摘要
   * POST /api/script/:scriptId/characters/parse-preview
   */
  async parsePreview() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const scriptId = ctx.helper.decodeId(ctx.params.scriptId);
    if (!scriptId) {
      ctx.body = ctx.helper.fail('无效的剧本ID');
      return;
    }

    const { text } = ctx.request.body;
    if (!text) {
      ctx.body = ctx.helper.fail('缺少人物介绍文本');
      return;
    }

    const result = await ctx.service.api.scriptCharacter.parsePreview(scriptId, userId, text);
    ctx.body = ctx.helper.success(result, '预览成功');
  }

  /**
   * 上传角色头像
   * POST /api/script-character/:id/upload-avatar
   */
  async uploadAvatar() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const characterId = ctx.helper.decodeId(ctx.params.id);
    if (!characterId) {
      ctx.body = ctx.helper.fail('无效的角色ID');
      return;
    }

    try {
      const file = ctx.request.files[0];
      if (!file) {
        ctx.body = ctx.helper.fail('请选择要上传的图片');
        return;
      }

      /* 验证文件大小（5MB） */
      const maxSize = 5 * 1024 * 1024;
      const fileStat = fs.statSync(file.filepath);
      if (fileStat.size > maxSize) {
        fs.unlinkSync(file.filepath);
        ctx.body = ctx.helper.fail('图片大小不能超过5MB');
        return;
      }

      /* 验证文件类型 */
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedMimeTypes.includes(file.mime)) {
        fs.unlinkSync(file.filepath);
        ctx.body = ctx.helper.fail('只支持jpg、png、webp格式的图片');
        return;
      }

      /* 生成唯一文件名 */
      const ext = path.extname(file.filename).toLowerCase();
      const uniqueFilename = `${uuidv4()}_${Date.now()}${ext}`;
      const dateDir = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const uploadDir = path.join(this.app.baseDir, 'app/public/uploads/characters', dateDir);

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const targetPath = path.join(uploadDir, uniqueFilename);
      fs.copyFileSync(file.filepath, targetPath);
      fs.unlinkSync(file.filepath);

      const avatarUrl = `/public/uploads/characters/${dateDir}/${uniqueFilename}`;

      /* 清理旧图片 */
      const oldChar = await ctx.model.ScriptCharacter.findOne({ where: { id: characterId }, attributes: ['avatar'], raw: true });
      if (oldChar?.avatar) ctx.helper.removeUploadedFile(oldChar.avatar);

      /* 更新角色头像字段 */
      await ctx.service.api.scriptCharacter.update(characterId, userId, { avatar: avatarUrl });

      ctx.body = ctx.helper.success({ avatar: avatarUrl }, '上传成功');
    } catch (err) {
      ctx.body = ctx.helper.fail('上传失败，请稍后重试');
    }
  }

  /**
   * AI生成角色头像
   * POST /api/script-character/:id/generate-avatar
   * 复用火山引擎Doubao-Seedream图片生成能力
   */
  async generateAvatar() {
    const { ctx, app } = this;
    const userId = ctx.state.user.id;
    const characterId = ctx.helper.decodeId(ctx.params.id);
    if (!characterId) {
      ctx.body = ctx.helper.fail('无效的角色ID');
      return;
    }

    /* 获取角色信息 */
    const character = await ctx.model.ScriptCharacter.findOne({
      where: { id: characterId },
      raw: true,
    });
    if (!character) {
      ctx.body = ctx.helper.fail('角色不存在');
      return;
    }

    /* 验证剧本归属 */
    const script = await ctx.model.Script.findOne({
      where: { id: character.script_id, user_id: userId },
      raw: true,
    });
    if (!script) {
      ctx.body = ctx.helper.fail('剧本不存在');
      return;
    }

    /* 使用前端传来的描述词，或根据角色信息自动构建 */
    const { prompt: customPrompt } = ctx.request.body;
    let avatarPrompt = customPrompt;

    if (!avatarPrompt) {
      /* 自动构建描述词 */
      avatarPrompt = this._buildAvatarPrompt(character);
    }

    try {
      /* 调用火山引擎生成图片（复用封面图生成逻辑） */
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

      /* 下载图片到本地 */
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
      if (character.avatar) ctx.helper.removeUploadedFile(character.avatar);

      /* 更新角色头像和描述词 */
      await ctx.service.api.scriptCharacter.update(characterId, userId, {
        avatar: avatarPath,
        avatarPrompt,
      });


      ctx.body = ctx.helper.success({
        avatar: avatarPath,
        avatarPrompt,
      }, '头像生成成功');
    } catch (err) {
      ctx.body = ctx.helper.fail(`头像生成失败: ${err.message}`);
    }
  }

  /**
   * AI生成角色画像描述词
   * POST /api/script-character/:id/generate-prompt
   * 根据角色结构化信息，调用大模型生成适合图片生成的描述词
   */
  async generatePrompt() {
    const { ctx, app } = this;
    const userId = ctx.state.user.id;
    const characterId = ctx.helper.decodeId(ctx.params.id);
    if (!characterId) {
      ctx.body = ctx.helper.fail('无效的角色ID');
      return;
    }

    /* 获取角色信息 */
    const character = await ctx.model.ScriptCharacter.findOne({
      where: { id: characterId },
      raw: true,
    });
    if (!character) {
      ctx.body = ctx.helper.fail('角色不存在');
      return;
    }

    /* 验证剧本归属 */
    const script = await ctx.model.Script.findOne({
      where: { id: character.script_id, user_id: userId },
      raw: true,
    });
    if (!script) {
      ctx.body = ctx.helper.fail('剧本不存在');
      return;
    }

    /* 组装角色信息摘要 */
    const charInfo = [];
    if (character.name) charInfo.push(`姓名：${character.name}`);
    if (character.gender) charInfo.push(`性别：${character.gender}`);
    if (character.age) charInfo.push(`年龄：${character.age}`);

    let personalityList = [];
    try { personalityList = JSON.parse(character.personality || '[]'); } catch { /* ignore */ }
    if (personalityList.length > 0) {
      charInfo.push(`性格：${personalityList.map(p => p.keyword || p.desc || '').filter(Boolean).join('、')}`);
    }

    let appearanceList = [];
    try { appearanceList = JSON.parse(character.appearance || '[]'); } catch { /* ignore */ }
    if (appearanceList.length > 0) {
      charInfo.push(`容貌：${appearanceList.map(a => `${a.keyword || ''}${a.desc ? '(' + a.desc + ')' : ''}`).filter(Boolean).join('、')}`);
    }

    if (character.background) charInfo.push(`人物经历：${character.background}`);

    const roleTypeLabels = {
      protagonist: '主角', antagonist: '反派', ally: '朋友/盟友',
      lover: '恋人', rival: '对手/竞争者', other: '配角',
    };
    charInfo.push(`角色定位：${roleTypeLabels[character.role_type] || '配角'}`);

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

      /* 流结束，保存到数据库 */
      const avatarPrompt = fullContent.trim();
      if (avatarPrompt) {
        await ctx.service.api.scriptCharacter.update(characterId, userId, { avatarPrompt });


        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      }
    } catch (err) {
      try {
        res.write(`data: ${JSON.stringify({ error: err.message || 'AI服务异常' })}\n\n`);
      } catch (_) { /* 连接已断开 */ }
    } finally {
      res.end();
    }
  }

  /**
   * 根据角色信息构建图片生成描述词
   * @param {object} character - 角色数据库记录
   * @returns {string}
   * @private
   */
  _buildAvatarPrompt(character) {
    const parts = ['一个'];

    if (character.gender) parts.push(character.gender === '女' ? '女性' : '男性');
    if (character.age) parts.push(`${character.age}`);

    /* 解析容貌描述 */
    let appearanceList = [];
    try {
      appearanceList = JSON.parse(character.appearance || '[]');
    } catch { /* ignore */ }

    if (appearanceList.length > 0) {
      const descs = appearanceList.map(a => a.desc || a.keyword).join('，');
      parts.push(`，${descs}`);
    }

    parts.push('，古风角色立绘，正面半身像，高清，精致，白色背景');

    return parts.join('');
  }

  /**
   * 下载远程图片到本地（复用封面控制器逻辑）
   * @param {string} url - 远程图片URL
   * @param {string} destPath - 本地保存路径
   * @returns {Promise<void>}
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

module.exports = ScriptCharacterController;