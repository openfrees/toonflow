'use strict';

const { Controller } = require('egg');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { chatStream } = require('../../lib/ai_chat');

const CHARACTER_START = '<<<CHARACTER_START>>>';
const CHARACTER_END = '<<<CHARACTER_END>>>';

/* 角色同步并发互斥：key = `char_sync_${userId}_${projectId}` */
const activeCharSyncs = new Map();

const loadCharacterSyncPrompt = () => {
  const promptPath = path.join(__dirname, '../../prompts/novel_character_sync.txt');
  return fs.readFileSync(promptPath, 'utf-8');
};

/**
 * 小说项目控制器（C端）
 * 处理小说项目的创建、查询、更新
 */
class NovelProjectController extends Controller {

  /**
   * 创建小说项目（从 novel-to-script 页面保存时调用）
   * POST /api/novel-project
   */
  async create() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const {
      title,
      totalEpisodes,
      duration,
      gender,
      genre,
      genres,
      artStyle,
      aspectRatio,
      chapters,
      copyrightConfirmAccepted,
      copyrightConfirmText,
      copyrightConfirmVersion,
    } = ctx.request.body;

    if (!chapters || !Array.isArray(chapters) || chapters.length === 0) {
      ctx.body = ctx.helper.fail('请至少上传一个章节');
      return;
    }

    if (!copyrightConfirmAccepted) {
      ctx.body = ctx.helper.fail('请先确认已获得授权或内容为本人原创');
      return;
    }

    const clientIp = ctx.get('x-forwarded-for')?.split(',')[0]?.trim() || ctx.ip;

    const result = await ctx.service.api.novelProject.create({
      title,
      totalEpisodes,
      duration,
      gender,
      genre,
      genres,
      artStyle,
      aspectRatio,
      chapters,
      copyrightConfirmAccepted,
      copyrightConfirmText,
      copyrightConfirmVersion,
    }, userId, clientIp);

    ctx.body = ctx.helper.success(result, '创建成功');
  }

  /**
   * 小说项目详情
   * GET /api/novel-project/:id
   */
  async detail() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const id = ctx.helper.decodeId(ctx.params.id);
    if (!id) {
      ctx.body = ctx.helper.fail('无效的项目ID');
      return;
    }

    const result = await ctx.service.api.novelProject.detail(id, userId);
    ctx.body = ctx.helper.success(result);
  }

  /**
   * 小说项目列表
   * GET /api/novel-project
   */
  async list() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const { page, pageSize } = ctx.query;

    const result = await ctx.service.api.novelProject.list(userId, { page, pageSize });
    ctx.body = ctx.helper.paginate(result, page || 1, pageSize || 20);
  }

  /**
   * 更新小说项目
   * PUT /api/novel-project/:id
   */
  async update() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const id = ctx.helper.decodeId(ctx.params.id);
    if (!id) {
      ctx.body = ctx.helper.fail('无效的项目ID');
      return;
    }

    await ctx.service.api.novelProject.update(id, userId, ctx.request.body);
    ctx.body = ctx.helper.success(null, '更新成功');
  }

  /**
   * 批量保存小说分集大纲
   * POST /api/novel-project/:id/episodes/batch-save
   */
  async batchSaveEpisodes() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const id = ctx.helper.decodeId(ctx.params.id);
    const { episodes } = ctx.request.body;

    if (!id) {
      ctx.body = ctx.helper.fail('无效的项目ID');
      return;
    }
    if (!Array.isArray(episodes) || episodes.length === 0) {
      ctx.body = ctx.helper.fail('分集数据不能为空');
      return;
    }

    const result = await ctx.service.api.novelProject.batchSaveEpisodes(id, userId, episodes);
    ctx.body = ctx.helper.success(result, '保存成功');
  }

  /**
   * 获取小说项目资产
   * GET /api/novel-project/:id/assets
   */
  async assets() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const id = ctx.helper.decodeId(ctx.params.id);
    if (!id) {
      ctx.body = ctx.helper.fail('无效的项目ID');
      return;
    }

    const result = await ctx.service.api.novelProject.assets(id, userId);
    ctx.body = ctx.helper.success(result);
  }

  /**
   * 保存小说项目资产
   * PUT /api/novel-project/:id/assets
   */
  async saveAssets() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const id = ctx.helper.decodeId(ctx.params.id);
    if (!id) {
      ctx.body = ctx.helper.fail('无效的项目ID');
      return;
    }

    await ctx.service.api.novelProject.saveAssets(id, userId, ctx.request.body);
    ctx.body = ctx.helper.success(null, '保存成功');
  }

  /**
   * AI同步小说项目角色（SSE流式）
   * POST /api/novel-project/:id/assets/sync-characters
   */
  async syncCharacters() {
    const { ctx, app } = this;
    const userId = ctx.state.user.id;
    const id = ctx.helper.decodeId(ctx.params.id);
    if (!id) {
      ctx.body = ctx.helper.fail('无效的项目ID');
      return;
    }

    /* 并发互斥：同一项目同时只能有一个角色同步任务 */
    const syncKey = `char_sync_${userId}_${id}`;
    if (activeCharSyncs.has(syncKey)) {
      ctx.status = 409;
      ctx.body = ctx.helper.fail('角色同步正在进行中，请勿重复操作');
      return;
    }

    activeCharSyncs.set(syncKey, true);

    const context = await ctx.service.api.novelProject.getCharacterSyncContext(id, userId);
    if (!context.storyline && (!context.extractedCharacters || context.extractedCharacters.length === 0)) {
      ctx.body = ctx.helper.fail('缺少故事线或分集大纲角色，暂时无法同步');
      return;
    }

    const missingCharacters = Array.isArray(context.missingCharacters) ? context.missingCharacters : [];
    const batchSize = 20;
    const batches = [];
    for (let index = 0; index < missingCharacters.length; index += batchSize) {
      batches.push(missingCharacters.slice(index, index + batchSize));
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

    const writeEvent = (event, data) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    let addedCount = 0;
    let updatedCount = 0;
    let processedCount = 0;
    let totalAiOutputChars = 0;

    try {
      writeEvent('start', {
        message: '开始同步缺失角色',
        totalCount: missingCharacters.length,
        batchCount: batches.length,
        batchSize,
        skippedExistingCount: (context.extractedCharacters?.length || 0) - missingCharacters.length,
      });

      if (missingCharacters.length === 0) {
        const latestAssets = await ctx.service.api.novelProject.assets(id, userId);
        writeEvent('done', {
          message: '角色已是最新，无需同步',
          addedCount,
          updatedCount,
          processedCount,
          totalCount: 0,
          assetTotalCount: latestAssets.characters.length,
          characters: latestAssets.characters,
        });
        return;
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batchCharacters = batches[batchIndex];
        let rawBuffer = '';
        let batchOutputChars = 0;

        writeEvent('batchStart', {
          message: `开始同步第 ${batchIndex + 1}/${batches.length} 批角色`,
          batchIndex: batchIndex + 1,
          batchCount: batches.length,
          batchSize: batchCharacters.length,
          totalCount: missingCharacters.length,
        });

        const batchContext = {
          project: context.project,
          storyline: context.storylineSummary || context.storyline || '',
          storylineSummary: context.storylineSummary || context.storyline || '',
          extractedCharacters: batchCharacters,
          existingCharacters: context.existingCharacters,
        };

        const messages = [
          {
            role: 'system',
            content: loadCharacterSyncPrompt(),
          },
          {
            role: 'user',
            content: JSON.stringify(batchContext, null, 2),
          },
        ];

        const stream = await chatStream(aiConfig, messages, {
          maxTokens: 8192,
          temperature: 0.4,
        });

        for await (const chunk of stream) {
          const delta = chunk?.content || '';
          if (!delta) continue;

          rawBuffer += delta;
          batchOutputChars += delta.length;
          const parsed = await this._flushCharacterBlocks(rawBuffer, async characterJson => {
            const normalized = ctx.service.api.novelProject.normalizeCharacterPayload(this._parseCharacterJson(characterJson));
            if (!normalized?.name) return;

            const result = await ctx.service.api.novelProject.upsertCharacterAsset(id, userId, normalized);
            if (result.action === 'created') {
              addedCount++;
            } else if (result.action === 'updated') {
              updatedCount++;
            }
            processedCount++;

            writeEvent('character', {
              action: result.action,
              character: result.character,
              addedCount,
              updatedCount,
              processedCount,
              totalCount: missingCharacters.length,
              batchIndex: batchIndex + 1,
              batchCount: batches.length,
            });
          });
          rawBuffer = parsed.remaining;
        }

        totalAiOutputChars += batchOutputChars;

        writeEvent('batchDone', {
          message: `第 ${batchIndex + 1}/${batches.length} 批角色同步完成`,
          batchIndex: batchIndex + 1,
          batchCount: batches.length,
          processedCount,
          totalCount: missingCharacters.length,
        });
      }

      const latestAssets = await ctx.service.api.novelProject.assets(id, userId);
      writeEvent('done', {
          message: processedCount > 0 ? '角色同步完成' : '未发现可同步的新角色',
          addedCount,
          updatedCount,
          processedCount,
          totalCount: missingCharacters.length,
          assetTotalCount: latestAssets.characters.length,
          characters: latestAssets.characters,
        });
    } catch (err) {
      ctx.logger.error('[NovelProject] 同步角色失败:', err);
      try {
        writeEvent('error', {
          message: err.message || '同步角色失败，请稍后重试',
          addedCount,
          updatedCount,
          processedCount,
          totalCount: missingCharacters.length,
        });
      } catch (_) {
        // ignore
      }
    } finally {
      activeCharSyncs.delete(syncKey);
      res.end();
    }
  }

  /**
   * 删除单个角色资产
   * DELETE /api/novel-project/:id/assets/character/:characterId
   */
  async deleteCharacter() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const projectId = ctx.helper.decodeId(ctx.params.id);
    const characterId = Number(ctx.params.characterId);
    if (!projectId) {
      ctx.body = ctx.helper.fail('无效的项目ID');
      return;
    }
    if (!characterId) {
      ctx.body = ctx.helper.fail('无效的角色ID');
      return;
    }

    const deleted = await ctx.service.api.novelProject.deleteCharacterAsset(projectId, userId, characterId);
    if (!deleted) {
      ctx.body = ctx.helper.fail('角色不存在或无权操作', 404);
      return;
    }
    ctx.body = ctx.helper.success(null, '删除成功');
  }

  /**
   * 删除小说项目
   * DELETE /api/novel-project/:id
   */
  async destroy() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const id = ctx.helper.decodeId(ctx.params.id);
    if (!id) {
      ctx.body = ctx.helper.fail('无效的项目ID');
      return;
    }

    await ctx.service.api.novelProject.destroy(id, userId);
    ctx.body = ctx.helper.success(null, '删除成功');
  }

  async _flushCharacterBlocks(buffer, onCharacter) {
    let remaining = buffer;

    while (true) {
      const startIndex = remaining.indexOf(CHARACTER_START);
      const endIndex = remaining.indexOf(CHARACTER_END);

      if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
        break;
      }

      const jsonText = remaining
        .slice(startIndex + CHARACTER_START.length, endIndex)
        .trim();

      remaining = remaining.slice(endIndex + CHARACTER_END.length);

      if (jsonText) {
        await onCharacter(jsonText);
      }
    }

    return { remaining };
  }

  _parseCharacterJson(jsonText) {
    const cleaned = jsonText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    return JSON.parse(cleaned);
  }
}

module.exports = NovelProjectController;
