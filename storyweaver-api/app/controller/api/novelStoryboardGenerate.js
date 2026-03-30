'use strict';

const { Controller } = require('egg');
const { chatStream } = require('../../lib/ai_chat');

const activeGenerations = new Map();
const activeVideoGenerations = new Map();

class NovelStoryboardGenerateController extends Controller {

  async generateStoryboard() {
    const { ctx, app } = this;
    const userId = ctx.state.user.id;
    const episodeId = ctx.helper.decodeId(ctx.params.id);
    const { style: customStyle, aspectRatio: customAspectRatio } = ctx.request.body || {};

    if (!episodeId) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('无效的剧集ID');
      return;
    }

    const { episode, project } = await ctx.service.api.novelStoryboardGenerate.getEpisodeWithProject(episodeId, userId);
    if (!episode) {
      ctx.status = 404;
      ctx.body = ctx.helper.fail('剧集不存在');
      return;
    }
    if (!project) {
      ctx.status = 404;
      ctx.body = ctx.helper.fail('关联项目不存在');
      return;
    }
    if (!episode.script_content || !episode.script_content.trim()) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('该集台本内容为空，请先生成台本');
      return;
    }

    const genKey = `novel_storyboard_${userId}_${episodeId}`;
    if (activeGenerations.has(genKey)) {
      ctx.status = 409;
      ctx.body = ctx.helper.fail('该集分镜正在生成中，请勿重复操作');
      return;
    }

    const style = customStyle || project.art_style || '日系动漫';
    const aspectRatio = customAspectRatio || project.aspect_ratio || '9:16';

    await ctx.service.api.novelStoryboardGenerate.updateStoryboardStatus(episodeId, 1, null, {
      style,
      aspectRatio,
      totalShots: 0,
      resetVideo: true,
    });

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

    let saved = false;
    const completedScenes = [];
    let structureData = null;

    const abortController = new AbortController();
    activeGenerations.set(genKey, { abortController });

    const checkAborted = () => abortController.signal.aborted;

    try {
      try {
        res.write(`data: ${JSON.stringify({ type: 'progress', phase: 'structure', message: '正在规划场景结构...' })}\n\n`);
      } catch (_) {}

      const structureMessages = await ctx.service.api.storyboardGenerate.buildStructureMessages(
        project, episode, style, aspectRatio
      );

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
        throw new Error('ABORTED');
      }

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
        throw new Error('场景结构解析失败');
      }

      if (!structureData.scenes || structureData.scenes.length === 0) {
        throw new Error('场景结构规划结果为空');
      }

      try {
        res.write(`data: ${JSON.stringify({ type: 'structure', data: structureData })}\n\n`);
      } catch (_) {}

      let shotStart = 1;
      let prevLastShot = null;

      for (let sceneIdx = 0; sceneIdx < structureData.scenes.length; sceneIdx++) {
        if (checkAborted()) break;

        const sceneInfo = structureData.scenes[sceneIdx];
        const sceneNum = sceneIdx + 1;

        try {
          res.write(`data: ${JSON.stringify({ type: 'progress', phase: 'scene', scene: sceneNum, totalScenes: structureData.scenes.length, message: `正在生成场景${sceneNum}镜头...` })}\n\n`);
        } catch (_) {}

        const sceneMessages = await ctx.service.api.storyboardGenerate.buildSceneStoryboardMessages(
          project, episode, sceneInfo, structureData, prevLastShot, style, aspectRatio, shotStart
        );

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
            let sceneJson = content.trim();
            if (sceneJson.startsWith('```json')) sceneJson = sceneJson.slice(7);
            if (sceneJson.startsWith('```')) sceneJson = sceneJson.slice(3);
            if (sceneJson.endsWith('```')) sceneJson = sceneJson.slice(0, -3);
            sceneJson = sceneJson.trim();
            const fb = sceneJson.indexOf('{');
            const lb = sceneJson.lastIndexOf('}');
            if (fb >= 0 && lb > fb) sceneJson = sceneJson.substring(fb, lb + 1);
            sceneResult = JSON.parse(sceneJson);
            break;
          } catch (parseErr) {
            if (attempt === 2) {
              try { res.write(`data: ${JSON.stringify({ type: 'error', scene: sceneNum, message: `场景${sceneNum}解析失败，已跳过` })}\n\n`); } catch (_) {}
            }
          }
        }

        if (checkAborted()) break;
        if (!sceneResult || !sceneResult.shots || sceneResult.shots.length === 0) continue;

        for (let i = 0; i < sceneResult.shots.length; i++) {
          sceneResult.shots[i].shot_number = shotStart + i;
        }

        prevLastShot = sceneResult.shots[sceneResult.shots.length - 1];
        shotStart += sceneResult.shots.length;
        completedScenes.push(sceneResult);

        const currentData = JSON.stringify({
          episode_info: {
            episode_number: episode.episode_number,
            title: episode.title || '',
            total_shots: shotStart - 1,
          },
          characters: structureData.characters || [],
          scenes: completedScenes,
        });
        await ctx.service.api.novelStoryboardGenerate.updateStoryboardStatus(episodeId, 1, currentData, {
          style,
          aspectRatio,
        });

        try {
          res.write(`data: ${JSON.stringify({ type: 'scene', scene: sceneNum, totalScenes: structureData.scenes.length, scene_data: sceneResult })}\n\n`);
        } catch (_) {}
      }

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
        await ctx.service.api.novelStoryboardGenerate.updateStoryboardStatus(episodeId, 2, finalData, {
          style,
          aspectRatio,
        });
        saved = true;
      } else {
        await ctx.service.api.novelStoryboardGenerate.updateStoryboardStatus(episodeId, 3, null, {
          style,
          aspectRatio,
        });
        saved = true;
      }
    } catch (err) {
      const isAborted = err.message === 'ABORTED';
      if (!saved) {
        if (completedScenes.length > 0) {
          const partialData = JSON.stringify({
            episode_info: { episode_number: episode.episode_number, total_shots: 0 },
            characters: structureData?.characters || [],
            scenes: completedScenes,
          });
          await ctx.service.api.novelStoryboardGenerate.updateStoryboardStatus(episodeId, 3, partialData, {
            style,
            aspectRatio,
          });
        } else {
          await ctx.service.api.novelStoryboardGenerate.updateStoryboardStatus(episodeId, 3, null, {
            style,
            aspectRatio,
          });
        }
        saved = true;
      }
      if (!isAborted) {
        try { res.write(`data: ${JSON.stringify({ type: 'error', message: '分镜生成失败，请重试' })}\n\n`); } catch (_) {}
      }
    } finally {
      activeGenerations.delete(genKey);
      try { res.write('data: [DONE]\n\n'); } catch (_) {}
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

    const genKey = `novel_storyboard_${userId}_${episodeId}`;
    const streamState = activeGenerations.get(genKey);
    if (!streamState) {
      ctx.body = ctx.helper.fail('没有正在进行的分镜生成任务');
      return;
    }

    streamState.abortController.abort();
    activeGenerations.delete(genKey);
    ctx.body = ctx.helper.success({ message: '已停止分镜生成' });
  }

  async getStoryboard() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const episodeId = ctx.helper.decodeId(ctx.params.id);

    if (!episodeId) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('无效的剧集ID');
      return;
    }

    const { episode, project } = await ctx.service.api.novelStoryboardGenerate.getEpisodeWithProject(episodeId, userId);
    if (!episode) {
      ctx.status = 404;
      ctx.body = ctx.helper.fail('剧集不存在');
      return;
    }

    const state = ctx.service.api.novelStoryboardGenerate._buildStoryboardState(episode, project);
    if (!state.storyboardData && state.status === 0) {
      ctx.body = ctx.helper.success(null, '暂无分镜数据');
      return;
    }

    ctx.body = ctx.helper.success({
      episodeId: ctx.helper.encodeId(episode.id),
      style: state.style,
      aspectRatio: state.aspectRatio,
      status: state.status,
      totalShots: state.totalShots,
      storyboardData: state.storyboardData,
      createdAt: episode.created_at,
      updatedAt: episode.updated_at,
    });
  }

  async saveStoryboard() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const episodeId = ctx.helper.decodeId(ctx.params.id);
    const { storyboardData, style, aspectRatio } = ctx.request.body;

    if (!episodeId) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('无效的剧集ID');
      return;
    }
    if (!storyboardData) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('分镜数据不能为空');
      return;
    }

    const { episode, project } = await ctx.service.api.novelStoryboardGenerate.getEpisodeWithProject(episodeId, userId);
    if (!episode) {
      ctx.status = 404;
      ctx.body = ctx.helper.fail('剧集不存在');
      return;
    }

    const currentState = ctx.service.api.novelStoryboardGenerate._buildStoryboardState(episode, project);
    await ctx.service.api.novelStoryboardGenerate.saveStoryboard(
      episodeId,
      typeof storyboardData === 'string' ? storyboardData : JSON.stringify(storyboardData),
      style || currentState.style,
      aspectRatio || currentState.aspectRatio
    );

    ctx.body = ctx.helper.success({ message: '分镜保存成功' });
  }

  async generateVideoStoryboard() {
    const { ctx, app } = this;
    const userId = ctx.state.user.id;
    const episodeId = ctx.helper.decodeId(ctx.params.id);
    const { style: customStyle, aspectRatio: customAspectRatio } = ctx.request.body || {};

    if (!episodeId) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('无效的剧集ID');
      return;
    }

    const { episode, project } = await ctx.service.api.novelStoryboardGenerate.getEpisodeWithProject(episodeId, userId);
    if (!episode) {
      ctx.status = 404;
      ctx.body = ctx.helper.fail('剧集不存在');
      return;
    }
    if (!project) {
      ctx.status = 404;
      ctx.body = ctx.helper.fail('关联项目不存在');
      return;
    }
    if (!episode.script_content || !episode.script_content.trim()) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('该集台本内容为空，请先生成台本');
      return;
    }

    const state = ctx.service.api.novelStoryboardGenerate._buildStoryboardState(episode, project);
    if (state.status !== 2 || !state.storyboardData) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('请先生成静态分镜，再生成视频分镜');
      return;
    }

    const storyboardData = state.storyboardData;
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

    const genKey = `novel_video_storyboard_${userId}_${episodeId}`;
    if (activeVideoGenerations.has(genKey)) {
      ctx.status = 409;
      ctx.body = ctx.helper.fail('该集视频分镜正在生成中，请勿重复操作');
      return;
    }

    const style = customStyle || state.style || project.art_style || '日系动漫';
    const aspectRatio = customAspectRatio || state.aspectRatio || project.aspect_ratio || '9:16';

    await ctx.service.api.novelStoryboardGenerate.updateVideoStoryboardStatus(episodeId, 1, null, {
      style,
      aspectRatio,
      totalShots: 0,
    });

    const BATCH_SIZE = 5;
    const batches = [];
    for (let i = 0; i < allShots.length; i += BATCH_SIZE) {
      batches.push(allShots.slice(i, i + BATCH_SIZE));
    }
    const totalBatches = batches.length;

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

    let saved = false;
    const completedShots = [];
    const abortController = new AbortController();
    activeVideoGenerations.set(genKey, { abortController });
    const checkAborted = () => abortController.signal.aborted;

    try {
      let prevLastShot = null;

      for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
        if (checkAborted()) break;

        const batchShots = batches[batchIdx];
        const batchNum = batchIdx + 1;
        const shotStart = batchShots[0].shot_number;
        const shotEnd = batchShots[batchShots.length - 1].shot_number;

        try {
          res.write(`data: ${JSON.stringify({ type: 'progress', batch: batchNum, totalBatches, shotsRange: `${shotStart}-${shotEnd}` })}\n\n`);
        } catch (_) {}

        const messages = await ctx.service.api.storyboardGenerate.buildBatchVideoStoryboardMessages(
          project, episode, batchShots, prevLastShot, style, aspectRatio, batchNum, totalBatches
        );

        let batchResult = [];
        for (let attempt = 1; attempt <= 2; attempt++) {
          if (checkAborted()) break;

          let content = '';
          try {
            const stream = await chatStream(aiConfig, messages, { maxTokens: 8192, signal: abortController.signal });
            for await (const chunk of stream) {
              if (checkAborted()) break;
              const delta = chunk.choices[0]?.delta?.content || '';
              if (delta) content += delta;
            }
          } catch (streamErr) {
            if (checkAborted()) break;
            if (attempt === 2) {
              try { res.write(`data: ${JSON.stringify({ type: 'error', batch: batchNum, message: `第${batchNum}批生成失败，已跳过` })}\n\n`); } catch (_) {}
            }
            continue;
          }

          if (checkAborted()) break;
          if (!content.trim()) {
            if (attempt === 2) {
              try { res.write(`data: ${JSON.stringify({ type: 'error', batch: batchNum, message: `第${batchNum}批AI返回空内容，已跳过` })}\n\n`); } catch (_) {}
            }
            continue;
          }

          try {
            let jsonStr = content.trim();
            if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
            if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
            if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
            jsonStr = jsonStr.trim();
            const firstBrace = jsonStr.indexOf('{');
            const lastBrace = jsonStr.lastIndexOf('}');
            if (firstBrace >= 0 && lastBrace > firstBrace) {
              jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
            }
            const parsed = JSON.parse(jsonStr);
            batchResult = parsed.shots || [];
            break;
          } catch (parseErr) {
            if (attempt === 2) {
              try { res.write(`data: ${JSON.stringify({ type: 'error', batch: batchNum, message: `第${batchNum}批生成失败，已跳过` })}\n\n`); } catch (_) {}
            }
          }
        }

        if (checkAborted()) break;
        if (batchResult.length === 0) continue;

        completedShots.push(...batchResult);
        prevLastShot = batchResult[batchResult.length - 1] || prevLastShot;

        const currentData = JSON.stringify({
          episode_info: {
            episode_number: episode.episode_number,
            title: episode.title || '',
            total_shots: completedShots.length,
          },
          shots: completedShots,
        });
        await ctx.service.api.novelStoryboardGenerate.updateVideoStoryboardStatus(episodeId, 1, currentData, {
          style,
          aspectRatio,
        });

        try {
          res.write(`data: ${JSON.stringify({ type: 'batch', batch: batchNum, totalBatches, shots: batchResult })}\n\n`);
        } catch (_) {}
      }

      if (completedShots.length > 0) {
        const finalData = JSON.stringify({
          episode_info: {
            episode_number: episode.episode_number,
            title: episode.title || '',
            total_shots: completedShots.length,
          },
          shots: completedShots,
        });
        await ctx.service.api.novelStoryboardGenerate.updateVideoStoryboardStatus(episodeId, 2, finalData, {
          style,
          aspectRatio,
        });
        saved = true;
      } else {
        await ctx.service.api.novelStoryboardGenerate.updateVideoStoryboardStatus(episodeId, 3, null, {
          style,
          aspectRatio,
        });
        saved = true;
      }
    } catch (err) {
      const isAborted = err.message === 'ABORTED';
      if (!saved) {
        if (completedShots.length > 0) {
          const partialData = JSON.stringify({
            episode_info: { episode_number: episode.episode_number, total_shots: completedShots.length },
            shots: completedShots,
          });
          await ctx.service.api.novelStoryboardGenerate.updateVideoStoryboardStatus(episodeId, 3, partialData, {
            style,
            aspectRatio,
          });
        } else {
          await ctx.service.api.novelStoryboardGenerate.updateVideoStoryboardStatus(episodeId, 3, null, {
            style,
            aspectRatio,
          });
        }
        saved = true;
      }
      if (!isAborted) {
        try { res.write(`data: ${JSON.stringify({ type: 'error', message: '视频分镜生成失败，请重试' })}\n\n`); } catch (_) {}
      }
    } finally {
      activeVideoGenerations.delete(genKey);
      try { res.write('data: [DONE]\n\n'); } catch (_) {}
      res.end();
    }
  }

  async stopVideoGenerate() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const episodeId = ctx.helper.decodeId(ctx.params.id);

    if (!episodeId) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('无效的剧集ID');
      return;
    }

    const genKey = `novel_video_storyboard_${userId}_${episodeId}`;
    const streamState = activeVideoGenerations.get(genKey);
    if (!streamState) {
      ctx.body = ctx.helper.fail('没有正在进行的视频分镜生成任务');
      return;
    }

    streamState.abortController.abort();
    activeVideoGenerations.delete(genKey);
    ctx.body = ctx.helper.success({ message: '已停止视频分镜生成' });
  }

  async getVideoStoryboard() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const episodeId = ctx.helper.decodeId(ctx.params.id);

    if (!episodeId) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('无效的剧集ID');
      return;
    }

    const { episode, project } = await ctx.service.api.novelStoryboardGenerate.getEpisodeWithProject(episodeId, userId);
    if (!episode) {
      ctx.status = 404;
      ctx.body = ctx.helper.fail('剧集不存在');
      return;
    }

    const state = ctx.service.api.novelStoryboardGenerate._buildStoryboardState(episode, project);
    if (!state.videoStoryboardData && state.videoStatus === 0) {
      ctx.body = ctx.helper.success(null, '暂无视频分镜数据');
      return;
    }

    ctx.body = ctx.helper.success({
      episodeId: ctx.helper.encodeId(episode.id),
      style: state.style,
      aspectRatio: state.aspectRatio,
      videoStatus: state.videoStatus,
      videoTotalShots: state.videoTotalShots,
      videoStoryboardData: state.videoStoryboardData,
      createdAt: episode.created_at,
      updatedAt: episode.updated_at,
    });
  }

  async saveVideoStoryboard() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const episodeId = ctx.helper.decodeId(ctx.params.id);
    const { videoStoryboardData, style, aspectRatio } = ctx.request.body;

    if (!episodeId) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('无效的剧集ID');
      return;
    }
    if (!videoStoryboardData) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('视频分镜数据不能为空');
      return;
    }

    const { episode, project } = await ctx.service.api.novelStoryboardGenerate.getEpisodeWithProject(episodeId, userId);
    if (!episode) {
      ctx.status = 404;
      ctx.body = ctx.helper.fail('剧集不存在');
      return;
    }

    const currentState = ctx.service.api.novelStoryboardGenerate._buildStoryboardState(episode, project);
    await ctx.service.api.novelStoryboardGenerate.saveVideoStoryboard(
      episodeId,
      typeof videoStoryboardData === 'string' ? videoStoryboardData : JSON.stringify(videoStoryboardData),
      style || currentState.style,
      aspectRatio || currentState.aspectRatio
    );

    ctx.body = ctx.helper.success({ message: '视频分镜保存成功' });
  }

  async batchGetStoryboards() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const projectId = ctx.helper.decodeId(ctx.params.projectId);

    if (!projectId) {
      ctx.status = 400;
      ctx.body = ctx.helper.fail('无效的项目ID');
      return;
    }

    const episodes = await ctx.service.api.novelStoryboardGenerate.batchGetStoryboards(projectId, userId);
    ctx.body = ctx.helper.success({ episodes });
  }
}

module.exports = NovelStoryboardGenerateController;
