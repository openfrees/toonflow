'use strict';

const { Controller } = require('egg');
const { chatStream } = require('../../lib/ai_chat');

/* 存储正在进行的分镜生成流：key = `storyboard_${userId}_${episodeId}` */
const activeGenerations = new Map();

/* 存储正在进行的视频分镜生成流：key = `video_storyboard_${userId}_${episodeId}` */
const activeVideoGenerations = new Map();

/**
 * 分镜头生成控制器
 * 将台本通过AI生成结构化分镜头提示词（SSE流式）
 */
class StoryboardGenerateController extends Controller {

  /**
   * 生成分镜头提示词（SSE流式）
   * POST /api/script-episode/:id/generate-storyboard
   * Body: { style?: string, aspectRatio?: string }
   */
  async generateStoryboard() {
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

    /* 检查台本内容是否存在 */
    if (!episode.script_content || !episode.script_content.trim()) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('该集台本内容为空，请先生成台本');
      return;
    }

    /* 并发互斥：同一集同时只能有一个分镜生成任务 */
    const genKey = `storyboard_${userId}_${episodeId}`;
    if (activeGenerations.has(genKey)) {
      ctx.status = 409;
      ctx.body = ctx.helper.fail('该集分镜正在生成中，请勿重复操作');
      return;
    }

    /* 查询剧本主表数据 */
    const script = await ctx.model.Script.findOne({
      where: { id: episode.script_id, user_id: userId },
      raw: true,
    });
    if (!script) {
      ctx.status = 404;
      ctx.body = ctx.helper.fail('关联剧本不存在');
      return;
    }

    const style = script.style || '日系动漫';
    const aspectRatio = script.aspect_ratio || '16:9';

    /* 创建或更新分镜记录，标记生成中 */
    const storyboardId = await ctx.service.api.storyboardGenerate.getOrCreateStoryboard(
      episodeId, episode.script_id, userId, style, aspectRatio
    );

    ctx.logger.info('[StoryboardGenerate] ========== 分镜分场景生成开始 ==========');
    ctx.logger.info('[StoryboardGenerate] 剧集ID: %s, 第%d集, 风格: %s, 比例: %s',
      episodeId, episode.episode_number, style, aspectRatio);

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

    let saved = false;
    const completedScenes = []; /* 已完成的场景数据 */
    let structureData = null; /* 场景结构规划结果 */

    /* AbortController 用于主动停止（通过 stop 接口调用） */
    const abortController = new AbortController();
    activeGenerations.set(genKey, { abortController });

    /* 检查是否被主动停止 */
    const checkAborted = () => {
      return abortController.signal.aborted;
    };

    try {
      /* ========== 第一步：场景结构规划 ========== */
      try { res.write(`data: ${JSON.stringify({ type: 'progress', phase: 'structure', message: '正在规划场景结构...' })}\n\n`); } catch (_) {}

      const structureMessages = await ctx.service.api.storyboardGenerate.buildStructureMessages(
        script, episode, style, aspectRatio
      );

      ctx.logger.info('[StoryboardGenerate] 开始调用AI规划场景结构...');

      /* 用流式调用消费完整内容（支持 AbortSignal） */
      let structureContent = '';
      const structureStream = await chatStream(aiConfig, structureMessages, {
        signal: abortController.signal,
        maxTokens: 4096,
      });
      for await (const chunk of structureStream) {
        if (checkAborted()) break;
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) structureContent += delta;
      }

      if (checkAborted()) {
        ctx.logger.info('[StoryboardGenerate] ⛔ 场景结构规划阶段被中断');
        throw new Error('ABORTED');
      }

      /* 解析场景结构JSON */
      let jsonStr = structureContent.trim();
      if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
      if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
      if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
      jsonStr = jsonStr.trim();
      const firstBrace = jsonStr.indexOf('{');
      const lastBrace = jsonStr.lastIndexOf('}');
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
      }

      try {
        structureData = JSON.parse(jsonStr);
      } catch (parseErr) {
        /* JSON 解析失败（可能是主动停止导致的不完整 JSON） */
        ctx.logger.error('[StoryboardGenerate] 场景结构 JSON 解析失败: %s\n内容前500字: %s',
          parseErr.message, jsonStr.substring(0, 500));
        throw new Error('场景结构解析失败');
      }

      if (!structureData.scenes || structureData.scenes.length === 0) {
        throw new Error('场景结构规划结果为空');
      }

      ctx.logger.info('[StoryboardGenerate] 场景结构规划完成：%d个场景', structureData.scenes.length);

      /* 推送场景结构给前端 */
      try { res.write(`data: ${JSON.stringify({ type: 'structure', data: structureData })}\n\n`); } catch (_) {}

      /* ========== 第二步：分场景生成镜头 ========== */
      let shotStart = 1;
      let prevLastShot = null;

      for (let sceneIdx = 0; sceneIdx < structureData.scenes.length; sceneIdx++) {
        if (checkAborted()) {
          ctx.logger.info('[StoryboardGenerate] ⛔ 场景循环中检测到中断');
          break;
        }

        const sceneInfo = structureData.scenes[sceneIdx];
        const sceneNum = sceneIdx + 1;

        try { res.write(`data: ${JSON.stringify({ type: 'progress', phase: 'scene', scene: sceneNum, totalScenes: structureData.scenes.length, message: `正在生成场景${sceneNum}镜头...` })}\n\n`); } catch (_) {}

        /* 构建单场景消息 */
        const sceneMessages = await ctx.service.api.storyboardGenerate.buildSceneStoryboardMessages(
          script, episode, sceneInfo, structureData, prevLastShot, style, aspectRatio, shotStart
        );

        ctx.logger.info('[StoryboardGenerate] 场景%d/%d 开始调用AI（镜头%d起，规划%d个）...',
          sceneNum, structureData.scenes.length, shotStart, sceneInfo.planned_shots);

        /* 解析场景镜头JSON（失败自动重试一次） */
        let sceneResult = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
          if (checkAborted()) break;

          let content = '';
          try {
            const stream = await chatStream(aiConfig, sceneMessages, {
              maxTokens: 8192,
              signal: abortController.signal,
            });
            for await (const chunk of stream) {
              if (checkAborted()) break;
              const delta = chunk.choices[0]?.delta?.content || '';
              if (delta) content += delta;
            }
          } catch (streamErr) {
            if (checkAborted()) break;
            ctx.logger.error('[StoryboardGenerate] 场景%d第%d次AI调用异常: %s', sceneNum, attempt, streamErr.message);
            if (attempt === 2) {
              try { res.write(`data: ${JSON.stringify({ type: 'error', scene: sceneNum, message: `场景${sceneNum}生成失败，已跳过` })}\n\n`); } catch (_) {}
            }
            continue;
          }

          if (checkAborted()) break;
          if (!content.trim()) {
            if (attempt === 2) {
              try { res.write(`data: ${JSON.stringify({ type: 'error', scene: sceneNum, message: `场景${sceneNum}AI返回空内容，已跳过` })}\n\n`); } catch (_) {}
            }
            continue;
          }

          try {
            let sJson = content.trim();
            if (sJson.startsWith('```json')) sJson = sJson.slice(7);
            if (sJson.startsWith('```')) sJson = sJson.slice(3);
            if (sJson.endsWith('```')) sJson = sJson.slice(0, -3);
            sJson = sJson.trim();
            const fb = sJson.indexOf('{');
            const lb = sJson.lastIndexOf('}');
            if (fb >= 0 && lb > fb) sJson = sJson.substring(fb, lb + 1);

            sceneResult = JSON.parse(sJson);
            ctx.logger.info('[StoryboardGenerate] 场景%d解析成功（第%d次），%d个镜头',
              sceneNum, attempt, (sceneResult.shots || []).length);
            break;
          } catch (e) {
            ctx.logger.error('[StoryboardGenerate] 场景%d第%d次解析失败: %s\n前500字: %s',
              sceneNum, attempt, e.message, content.substring(0, 500));
            if (attempt === 2) {
              try { res.write(`data: ${JSON.stringify({ type: 'error', scene: sceneNum, message: `场景${sceneNum}解析失败，已跳过` })}\n\n`); } catch (_) {}
            }
          }
        }

        if (checkAborted()) break;
        if (!sceneResult || !sceneResult.shots || sceneResult.shots.length === 0) continue;

        /* 确保 shot_number 连续 */
        for (let i = 0; i < sceneResult.shots.length; i++) {
          sceneResult.shots[i].shot_number = shotStart + i;
        }

        /* 记录上一场景最后一个镜头（用于下一场景衔接） */
        prevLastShot = sceneResult.shots[sceneResult.shots.length - 1];
        shotStart += sceneResult.shots.length;

        /* 追加到已完成列表 */
        completedScenes.push(sceneResult);

        /* 增量保存到数据库 */
        const currentData = JSON.stringify({
          episode_info: {
            episode_number: episode.episode_number,
            title: episode.title || '',
            total_shots: shotStart - 1,
          },
          characters: structureData.characters || [],
          scenes: completedScenes,
        });
        await ctx.service.api.storyboardGenerate.updateStoryboardStatus(
          storyboardId, 1, currentData
        );

        /* SSE推送本场景结果 */
        try { res.write(`data: ${JSON.stringify({ type: 'scene', scene: sceneNum, totalScenes: structureData.scenes.length, scene_data: sceneResult })}\n\n`); } catch (_) {}

        ctx.logger.info('[StoryboardGenerate] ✅ 场景%d保存成功，累计%d个镜头', sceneNum, shotStart - 1);
      }

      /* 全部完成，更新状态 */
      if (completedScenes.length > 0) {
        const finalData = JSON.stringify({
          episode_info: {
            episode_number: episode.episode_number,
            title: episode.title || '',
            total_shots: shotStart - 1,
          },
          characters: structureData.characters || [],
          scenes: completedScenes,
        });
        await ctx.service.api.storyboardGenerate.updateStoryboardStatus(storyboardId, 2, finalData);
        saved = true;
        ctx.logger.info('[StoryboardGenerate] 全部%d个场景完成，共%d个镜头',
          completedScenes.length, shotStart - 1);
      } else {
        await ctx.service.api.storyboardGenerate.updateStoryboardStatus(storyboardId, 3);
        saved = true;
      }

    } catch (err) {
      /* 主动停止（ABORTED）或其他错误 */
      const isAborted = err.message === 'ABORTED';
      if (!isAborted) {
        ctx.logger.error('[StoryboardGenerate] 生成异常: %s', err.message);
      }
      if (!saved) {
        if (completedScenes.length > 0) {
          const partialData = JSON.stringify({
            episode_info: { episode_number: episode.episode_number, total_shots: 0 },
            characters: structureData?.characters || [],
            scenes: completedScenes,
          });
          await ctx.service.api.storyboardGenerate.updateStoryboardStatus(storyboardId, 3, partialData);
        } else {
          await ctx.service.api.storyboardGenerate.updateStoryboardStatus(storyboardId, 3);
        }
        saved = true;
      }
      if (!isAborted) {
        try { res.write(`data: ${JSON.stringify({ type: 'error', message: '分镜生成失败，请重试' })}\n\n`); } catch (_) {}
      }
    } finally {
      activeGenerations.delete(genKey);
      /* 尝试推送结束标记（客户端可能已断开） */
      try { res.write(`data: [DONE]\n\n`); } catch (_) {}
      res.end();
    }
  }

  /**
   * 停止分镜生成
   * POST /api/script-episode/:id/stop-storyboard
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

    const genKey = `storyboard_${userId}_${episodeId}`;
    const streamState = activeGenerations.get(genKey);

    if (!streamState) {
      ctx.body = ctx.helper.fail('没有正在进行的分镜生成任务');
      return;
    }

    /* 中断AI请求 */
    streamState.abortController.abort();

    activeGenerations.delete(genKey);
    ctx.body = ctx.helper.success({ message: '已停止分镜生成' });
  }

  /**
   * 获取分镜数据
   * GET /api/script-episode/:id/storyboard
   */
  async getStoryboard() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const episodeId = ctx.helper.decodeId(ctx.params.id);

    if (!episodeId) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('无效的剧集ID');
      return;
    }

    const storyboard = await ctx.model.EpisodeStoryboard.findOne({
      where: { episode_id: episodeId, user_id: userId },
      raw: true,
    });

    if (!storyboard) {
      ctx.body = ctx.helper.success(null, '暂无分镜数据');
      return;
    }

    /* 解析JSON数据 */
    let parsedData = null;
    if (storyboard.storyboard_data) {
      try {
        parsedData = JSON.parse(storyboard.storyboard_data);
      } catch (e) {
        /* JSON解析失败，返回原始文本 */
        parsedData = { raw_text: storyboard.storyboard_data };
      }
    }

    ctx.body = ctx.helper.success({
      id: ctx.helper.encodeId(storyboard.id),
      episodeId: ctx.helper.encodeId(storyboard.episode_id),
      style: storyboard.style,
      aspectRatio: storyboard.aspect_ratio,
      status: storyboard.status,
      totalShots: storyboard.total_shots,
      storyboardData: parsedData,
      createdAt: storyboard.created_at,
      updatedAt: storyboard.updated_at,
    });
  }

  /**
   * 保存/编辑分镜数据
   * PUT /api/script-episode/:id/storyboard
   * Body: { storyboardData: object }
   */
  async saveStoryboard() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const episodeId = ctx.helper.decodeId(ctx.params.id);

    if (!episodeId) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('无效的剧集ID');
      return;
    }

    const { storyboardData, style, aspectRatio } = ctx.request.body;
    if (!storyboardData) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('分镜数据不能为空');
      return;
    }

    const storyboard = await ctx.model.EpisodeStoryboard.findOne({
      where: { episode_id: episodeId, user_id: userId },
      raw: true,
    });

    if (!storyboard) {
      ctx.status = 404;
      ctx.body = ctx.helper.fail('分镜记录不存在');
      return;
    }

    const jsonStr = typeof storyboardData === 'string'
      ? storyboardData
      : JSON.stringify(storyboardData);

    await ctx.service.api.storyboardGenerate.updateStoryboardStatus(
      storyboard.id, 2, jsonStr
    );

    // 更新画风和比例字段
    const updateFields = {};
    if (style !== undefined) updateFields.style = style;
    if (aspectRatio !== undefined) updateFields.aspect_ratio = aspectRatio;
    if (Object.keys(updateFields).length > 0) {
      await ctx.model.EpisodeStoryboard.update(updateFields, {
        where: { id: storyboard.id },
      });
    }

    ctx.body = ctx.helper.success({ message: '分镜保存成功' });
  }

  /* ========================================
   * 视频分镜相关接口
   * ======================================== */

  /**
   * 生成视频分镜词（分批调用AI + SSE推送每批结果）
   * POST /api/script-episode/:id/generate-video-storyboard
   * 每批5个镜头，后端自动循环调用AI，每批完成后增量保存+SSE推送
   */
  async generateVideoStoryboard() {
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

    /* 检查台本内容 */
    if (!episode.script_content || !episode.script_content.trim()) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('该集台本内容为空，请先生成台本');
      return;
    }

    /* 检查静态分镜是否已生成 */
    const storyboard = await ctx.model.EpisodeStoryboard.findOne({
      where: { episode_id: episodeId, user_id: userId },
      raw: true,
    });
    if (!storyboard || storyboard.status !== 2 || !storyboard.storyboard_data) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('请先生成静态分镜，再生成视频分镜');
      return;
    }

    /* 解析静态分镜数据 */
    let storyboardData;
    try {
      storyboardData = JSON.parse(storyboard.storyboard_data);
    } catch (e) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('静态分镜数据格式异常，请重新生成静态分镜');
      return;
    }

    /* 提取所有shots（从scenes中扁平化） */
    const allShots = [];
    if (storyboardData.scenes) {
      for (const scene of storyboardData.scenes) {
        if (scene.shots) allShots.push(...scene.shots);
      }
    }
    if (allShots.length === 0) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('静态分镜中没有镜头数据');
      return;
    }

    /* 并发互斥 */
    const genKey = `video_storyboard_${userId}_${episodeId}`;
    if (activeVideoGenerations.has(genKey)) {
      ctx.status = 409;
      ctx.body = ctx.helper.fail('该集视频分镜正在生成中，请勿重复操作');
      return;
    }

    /* 查询剧本主表 */
    const script = await ctx.model.Script.findOne({
      where: { id: episode.script_id, user_id: userId },
      raw: true,
    });
    if (!script) {
      ctx.status = 404;
      ctx.body = ctx.helper.fail('关联剧本不存在');
      return;
    }

    /* 初始化视频分镜生成状态 */
    await ctx.service.api.storyboardGenerate.initVideoStoryboardGeneration(storyboard.id);

    const style = script.style || '日系动漫';
    const aspectRatio = script.aspect_ratio || '16:9';

    /* 分组：每组5个镜头 */
    const BATCH_SIZE = 5;
    const batches = [];
    for (let i = 0; i < allShots.length; i += BATCH_SIZE) {
      batches.push(allShots.slice(i, i + BATCH_SIZE));
    }
    const totalBatches = batches.length;

    ctx.logger.info('[VideoStoryboard] ========== 视频分镜分批生成开始 ==========');
    ctx.logger.info('[VideoStoryboard] 剧集ID: %s, 第%d集, 总镜头: %d, 分%d批, 风格: %s, 比例: %s',
      episodeId, episode.episode_number, allShots.length, totalBatches, style, aspectRatio);

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

    let saved = false;
    const completedShots = []; /* 已完成的所有视频分镜shots */

    /* 用于主动停止（通过 stop 接口调用） */
    const abortController = new AbortController();
    activeVideoGenerations.set(genKey, { abortController });

    /* 检查是否被主动停止 */
    const checkAborted = () => {
      return abortController.signal.aborted;
    };

    try {
      let prevLastShot = null;

      for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
        if (checkAborted()) {
          ctx.logger.info('[VideoStoryboard] ⛔ 循环开头检测到中断，停止后续批次');
          break;
        }

        const batchShots = batches[batchIdx];
        const batchNum = batchIdx + 1;

        /* 推送进度（客户端可能已断开，写入会静默失败） */
        const shotStart = batchShots[0].shot_number;
        const shotEnd = batchShots[batchShots.length - 1].shot_number;
        try {
          res.write(`data: ${JSON.stringify({ type: 'progress', batch: batchNum, totalBatches, shotsRange: `${shotStart}-${shotEnd}` })}\n\n`);
        } catch (_) { /* 写入失败说明连接已断 */ }

        /* 构建分批消息 */
        const messages = await ctx.service.api.storyboardGenerate.buildBatchVideoStoryboardMessages(
          script, episode, batchShots, prevLastShot, style, aspectRatio, batchNum, totalBatches
        );

        ctx.logger.info('[VideoStoryboard] 第%d批开始调用AI（镜头%d-%d）...', batchNum, shotStart, shotEnd);

        /* 解析JSON提取shots（失败自动重试一次） */
        let batchResult = [];
        for (let attempt = 1; attempt <= 2; attempt++) {
          if (checkAborted()) {
            ctx.logger.info('[VideoStoryboard] ⛔ 重试循环中检测到中断，停止当前批次');
            break;
          }

          /* 用流式调用（AbortSignal中断可靠），后端内部消费完整内容 */
          let content = '';
          try {
            const stream = await chatStream(aiConfig, messages, { maxTokens: 8192, signal: abortController.signal });
            for await (const chunk of stream) {
              if (checkAborted()) {
                ctx.logger.info('[VideoStoryboard] ⛔ 流式消费中检测到中断，停止接收');
                break;
              }
              const delta = chunk.choices[0]?.delta?.content || '';
              if (delta) content += delta;
            }
          } catch (streamErr) {
            if (checkAborted()) {
              ctx.logger.info('[VideoStoryboard] ⛔ AI流被中断: %s', streamErr.message);
              break;
            }
            ctx.logger.error('[VideoStoryboard] 第%d批第%d次AI调用异常: %s', batchNum, attempt, streamErr.message);
            if (attempt === 2) {
              try { res.write(`data: ${JSON.stringify({ type: 'error', batch: batchNum, message: `第${batchNum}批生成失败，已跳过` })}\n\n`); } catch (_) {}
            }
            continue;
          }

          if (checkAborted()) break;
          if (!content.trim()) {
            if (attempt === 2) {
              res.write(`data: ${JSON.stringify({ type: 'error', batch: batchNum, message: `第${batchNum}批AI返回空内容，已跳过` })}\n\n`);
            }
            continue;
          }

          try {
            let jsonStr = content.trim();
            /* 清理 markdown 代码块标记 */
            if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
            if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
            if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
            jsonStr = jsonStr.trim();

            /* 处理AI可能在JSON前后加的解释性文字：提取第一个{到最后一个}之间的内容 */
            const firstBrace = jsonStr.indexOf('{');
            const lastBrace = jsonStr.lastIndexOf('}');
            if (firstBrace >= 0 && lastBrace > firstBrace) {
              jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
            }

            const parsed = JSON.parse(jsonStr);
            batchResult = parsed.shots || [];
            ctx.logger.info('[VideoStoryboard] 第%d批解析成功（第%d次），%d个镜头', batchNum, attempt, batchResult.length);
            break; /* 解析成功，跳出重试循环 */
          } catch (e) {
            ctx.logger.error('[VideoStoryboard] 第%d批第%d次解析失败: %s\n原始内容前500字: %s',
              batchNum, attempt, e.message, content.substring(0, 500));
            if (attempt === 2) {
              try { res.write(`data: ${JSON.stringify({ type: 'error', batch: batchNum, message: `第${batchNum}批生成失败，已跳过` })}\n\n`); } catch (_) {}
            }
          }
        }

        if (checkAborted()) {
          ctx.logger.info('[VideoStoryboard] ⛔ 批次完成后检测到中断，停止后续批次');
          break;
        }
        if (batchResult.length === 0) continue;

        /* 追加到已完成列表 */
        completedShots.push(...batchResult);
        prevLastShot = batchResult.length > 0 ? batchResult[batchResult.length - 1] : prevLastShot;

        /* 增量保存到数据库（每批完成都保存，断开后数据不丢） */
        const currentData = JSON.stringify({
          episode_info: {
            episode_number: episode.episode_number,
            title: episode.title || '',
            total_shots: completedShots.length,
          },
          shots: completedShots,
        });
        await ctx.service.api.storyboardGenerate.updateVideoStoryboardStatus(
          storyboard.id, 1, currentData
        );

        ctx.logger.info('[VideoStoryboard] ✅ 第%d批保存成功，累计%d个镜头', batchNum, completedShots.length);

        /* SSE推送本批结果 */
        try { res.write(`data: ${JSON.stringify({ type: 'batch', batch: batchNum, totalBatches, shots: batchResult })}\n\n`); } catch (_) {}
      }

      /* 全部完成，更新状态 */
      if (completedShots.length > 0) {
        const finalData = JSON.stringify({
          episode_info: {
            episode_number: episode.episode_number,
            title: episode.title || '',
            total_shots: completedShots.length,
          },
          shots: completedShots,
        });
        await ctx.service.api.storyboardGenerate.updateVideoStoryboardStatus(
          storyboard.id, 2, finalData
        );
        saved = true;
        ctx.logger.info('[VideoStoryboard] 全部%d批完成，共%d个镜头', totalBatches, completedShots.length);
      } else {
        await ctx.service.api.storyboardGenerate.updateVideoStoryboardStatus(storyboard.id, 3);
        saved = true;
      }

    } catch (err) {
      ctx.logger.error('[VideoStoryboard] 生成异常: %s', err.message);
      if (!saved) {
        if (completedShots.length > 0) {
          const partialData = JSON.stringify({
            episode_info: { episode_number: episode.episode_number, total_shots: completedShots.length },
            shots: completedShots,
          });
          await ctx.service.api.storyboardGenerate.updateVideoStoryboardStatus(storyboard.id, 3, partialData);
        } else {
          await ctx.service.api.storyboardGenerate.updateVideoStoryboardStatus(storyboard.id, 3);
        }
        saved = true;
      }
      try { res.write(`data: ${JSON.stringify({ type: 'error', message: '视频分镜生成失败，请重试' })}\n\n`); } catch (_) {}
    } finally {
      activeVideoGenerations.delete(genKey);
      /* 尝试推送结束标记（客户端可能已断开） */
      try { res.write(`data: [DONE]\n\n`); } catch (_) {}
      res.end();
    }
  }

  /**
   * 停止视频分镜生成
   * POST /api/script-episode/:id/stop-video-storyboard
   */
  async stopVideoGenerate() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const episodeId = ctx.helper.decodeId(ctx.params.id);

    if (!episodeId) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('无效的剧集ID');
      return;
    }

    const genKey = `video_storyboard_${userId}_${episodeId}`;
    const streamState = activeVideoGenerations.get(genKey);

    if (!streamState) {
      ctx.body = ctx.helper.fail('没有正在进行的视频分镜生成任务');
      return;
    }

    /* 中断AI请求 */
    streamState.abortController.abort();

    /* 视频分镜数据已在每批完成后增量保存到数据库，无需再次保存 */
    /* 清理生成状态 */
    activeVideoGenerations.delete(genKey);
    ctx.body = ctx.helper.success({ message: '已停止视频分镜生成' });
  }

  /**
   * 获取视频分镜数据
   * GET /api/script-episode/:id/video-storyboard
   */
  async getVideoStoryboard() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const episodeId = ctx.helper.decodeId(ctx.params.id);

    if (!episodeId) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('无效的剧集ID');
      return;
    }

    const storyboard = await ctx.model.EpisodeStoryboard.findOne({
      where: { episode_id: episodeId, user_id: userId },
      raw: true,
    });

    if (!storyboard) {
      ctx.body = ctx.helper.success(null, '暂无视频分镜数据');
      return;
    }

    /* 解析视频分镜JSON */
    let parsedData = null;
    if (storyboard.video_storyboard_data) {
      try {
        parsedData = JSON.parse(storyboard.video_storyboard_data);
      } catch (e) {
        parsedData = { raw_text: storyboard.video_storyboard_data };
      }
    }

    ctx.body = ctx.helper.success({
      id: ctx.helper.encodeId(storyboard.id),
      episodeId: ctx.helper.encodeId(storyboard.episode_id),
      style: storyboard.style,
      aspectRatio: storyboard.aspect_ratio,
      videoStatus: storyboard.video_status,
      videoTotalShots: storyboard.video_total_shots,
      videoStoryboardData: parsedData,
      createdAt: storyboard.created_at,
      updatedAt: storyboard.updated_at,
    });
  }

  /**
   * 保存/编辑视频分镜数据
   * PUT /api/script-episode/:id/video-storyboard
   * Body: { videoStoryboardData: object }
   */
  async saveVideoStoryboard() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const episodeId = ctx.helper.decodeId(ctx.params.id);

    if (!episodeId) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('无效的剧集ID');
      return;
    }

    const { videoStoryboardData } = ctx.request.body;
    if (!videoStoryboardData) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('视频分镜数据不能为空');
      return;
    }

    const storyboard = await ctx.model.EpisodeStoryboard.findOne({
      where: { episode_id: episodeId, user_id: userId },
      raw: true,
    });

    if (!storyboard) {
      ctx.status = 404;
      ctx.body = ctx.helper.fail('分镜记录不存在');
      return;
    }

    const jsonStr = typeof videoStoryboardData === 'string'
      ? videoStoryboardData
      : JSON.stringify(videoStoryboardData);

    await ctx.service.api.storyboardGenerate.updateVideoStoryboardStatus(
      storyboard.id, 2, jsonStr
    );

    ctx.body = ctx.helper.success({ message: '视频分镜保存成功' });
  }

  /**
   * 批量获取某剧本下所有集的分镜数据（首帧+视频）
   * GET /api/script/:scriptId/storyboards
   * 一次查询替代 N*2 次逐集请求
   */
  async batchGetStoryboards() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const scriptId = ctx.helper.decodeId(ctx.params.scriptId);

    if (!scriptId) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('无效的剧本ID');
      return;
    }

    /* 一次查出该剧本下所有分镜记录 */
    const rows = await ctx.model.EpisodeStoryboard.findAll({
      where: { script_id: scriptId, user_id: userId },
      raw: true,
    });

    /* 按 episode_id 组装结果 */
    const episodes = rows.map(row => {
      let storyboardData = null;
      if (row.storyboard_data) {
        try { storyboardData = JSON.parse(row.storyboard_data); } catch (_) { storyboardData = { raw_text: row.storyboard_data }; }
      }
      let videoStoryboardData = null;
      if (row.video_storyboard_data) {
        try { videoStoryboardData = JSON.parse(row.video_storyboard_data); } catch (_) { videoStoryboardData = { raw_text: row.video_storyboard_data }; }
      }

      return {
        episodeId: ctx.helper.encodeId(row.episode_id),
        status: row.status,
        totalShots: row.total_shots,
        storyboardData,
        videoStatus: row.video_status,
        videoTotalShots: row.video_total_shots,
        videoStoryboardData,
      };
    });

    ctx.body = ctx.helper.success({ episodes });
  }
}

module.exports = StoryboardGenerateController;
