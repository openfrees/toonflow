'use strict';

/**
 * 路由配置
 *
 * 路由前缀约定：
 *   ${adminPrefix}/*  → 管理后台接口（controller/admin），前缀由配置决定
 *   /api/*             → C端前端接口（controller/api）
 *
 * @param {import('egg').Application} app - Egg应用实例
 */
module.exports = app => {
  const { router, controller, middleware } = app;

  /* 管理后台路径前缀（从配置读取，生产环境为随机路径） */
  const P = app.config.adminPrefix || '/admin';

  /* 鉴权中间件 */
  const adminAuth = middleware.adminAuth();

  /* ========================================
   * 管理后台页面（模板渲染）
   * EggJS 渲染入口 HTML，前端 SPA 由 Vue Router 接管
   * ======================================== */
  router.get(P, controller.page.admin.index);

  /* ========================================
   * 管理后台接口
   * ======================================== */

  /* --- 认证（无需鉴权） --- */
  router.post(P + '/auth/login', controller.admin.auth.login);

  /* --- 认证（需鉴权） --- */
  router.get(P + '/auth/userinfo', adminAuth, controller.admin.auth.userInfo);
  router.post(P + '/auth/change-password', adminAuth, controller.admin.auth.changePassword);
  router.post(P + '/auth/logout', adminAuth, controller.admin.auth.logout);

  /* --- 仪表盘 --- */
  router.get(P + '/dashboard/stats', adminAuth, controller.admin.dashboard.stats);

  /* --- 短剧管理 --- */
  router.get(P + '/drama', adminAuth, controller.admin.drama.index);
  router.get(P + '/drama/:id', adminAuth, controller.admin.drama.show);
  router.post(P + '/drama', adminAuth, controller.admin.drama.create);
  router.put(P + '/drama/:id', adminAuth, controller.admin.drama.update);
  router.delete(P + '/drama/:id', adminAuth, controller.admin.drama.destroy);
  router.post(P + '/drama/batch-status', adminAuth, controller.admin.drama.batchStatus);

  /* --- 分集管理 --- */
  router.get(P + '/episode', adminAuth, controller.admin.episode.index);
  router.post(P + '/episode', adminAuth, controller.admin.episode.create);
  router.put(P + '/episode/:id', adminAuth, controller.admin.episode.update);
  router.delete(P + '/episode/:id', adminAuth, controller.admin.episode.destroy);

  /* --- 题材类型管理 --- */
  router.get(P + '/genre', adminAuth, controller.admin.genre.index);
  router.post(P + '/genre', adminAuth, controller.admin.genre.create);
  router.put(P + '/genre/:id', adminAuth, controller.admin.genre.update);
  router.delete(P + '/genre/:id', adminAuth, controller.admin.genre.destroy);

  /* --- 反馈管理 --- */
  router.get(P + '/feedback/stats', adminAuth, controller.admin.feedback.stats);
  router.get(P + '/feedback', adminAuth, controller.admin.feedback.index);
  router.get(P + '/feedback/:id', adminAuth, controller.admin.feedback.show);
  router.post(P + '/feedback/:id/reply', adminAuth, controller.admin.feedback.reply);
  router.put(P + '/feedback/:id/status', adminAuth, controller.admin.feedback.updateStatus);

  /* --- 兑换码管理 --- */
  router.post(P + '/redeem/generate', adminAuth, controller.admin.redeem.generate);
  router.get(P + '/redeem/log', adminAuth, controller.admin.redeem.logList);
  router.get(P + '/redeem', adminAuth, controller.admin.redeem.index);
  router.put(P + '/redeem/:id/status', adminAuth, controller.admin.redeem.updateStatus);
  router.delete(P + '/redeem/:id', adminAuth, controller.admin.redeem.destroy);

  /* --- VIP/充值配置管理 --- */
  router.get(P + '/vip/tiers', adminAuth, controller.admin.vip.getTiers);
  router.post(P + '/vip/tiers', adminAuth, controller.admin.vip.createTier);
  router.put(P + '/vip/tiers/:id', adminAuth, controller.admin.vip.updateTier);
  router.delete(P + '/vip/tiers/:id', adminAuth, controller.admin.vip.deleteTier);

  router.get(P + '/vip/plans', adminAuth, controller.admin.vip.getPlans);
  router.post(P + '/vip/plans', adminAuth, controller.admin.vip.createPlan);
  router.put(P + '/vip/plans/:id', adminAuth, controller.admin.vip.updatePlan);
  router.delete(P + '/vip/plans/:id', adminAuth, controller.admin.vip.deletePlan);

  router.get(P + '/vip/prices', adminAuth, controller.admin.vip.getPrices);
  router.post(P + '/vip/prices', adminAuth, controller.admin.vip.setPrice);

  /* --- 订单管理 --- */
  router.get(P + '/order/stats', adminAuth, controller.admin.order.stats);
  router.get(P + '/order', adminAuth, controller.admin.order.index);

  /* --- 用户管理 --- */
  router.get(P + '/user/stats', adminAuth, controller.admin.user.stats);
  router.get(P + '/user/search', adminAuth, controller.admin.user.search);
  router.get(P + '/user', adminAuth, controller.admin.user.index);
  router.put(P + '/user/:id/status', adminAuth, controller.admin.user.updateStatus);
  // 这个是测试接口，删除会员所有信息
  router.delete(P + '/user/:id', adminAuth, controller.admin.user.destroy);

  /* --- 调试接口（需管理员鉴权） --- */
  router.post(P + '/debug/run-vip-expire-check', adminAuth, controller.admin.debug.runVipExpireCheck);

  /* --- 系统配置 --- */
  router.get(P + '/system/config', adminAuth, controller.admin.system.getAll);
  router.post(P + '/system/config', adminAuth, controller.admin.system.save);

  /* ========================================
   * C端接口（/api/）
   * ======================================== */

  /* C端鉴权中间件 */
  const userAuth = middleware.userAuth();

  /* 兑换码限流：每用户每分钟最多5次 */
  const redeemRateLimit = middleware.rateLimit({ max: 5, window: 60, prefix: 'redeem_limit' });

  /* --- 健康检查 --- */
  router.get('/api/health', async ctx => {
    ctx.body = ctx.helper.success({ status: 'ok', timestamp: new Date() }, '知剧AI API is running');
  });

  /* --- 部署模式查询（前端用于切换 UI） --- */
  router.get('/api/auth/deploy-mode', controller.api.auth.deployMode);

  /* --- C端认证（无需鉴权） --- */
  router.post('/api/auth/login', controller.api.auth.login);
  router.post('/api/auth/login-by-phone', controller.api.auth.loginByPhone);
  router.post('/api/auth/send-code', controller.api.auth.sendCode);
  router.get('/api/auth/captcha', controller.api.auth.getCaptcha);

  /* --- 题材类型（无需鉴权，公开数据） --- */
  router.get('/api/genre/list', controller.api.genre.list);
  router.get('/api/system/public-config', controller.api.system.publicConfig);

  /* --- C端认证（需鉴权） --- */
  router.get('/api/auth/userinfo', userAuth, controller.api.auth.userInfo);
  router.post('/api/auth/set-password', userAuth, controller.api.auth.setPassword);
  router.post('/api/auth/change-password', userAuth, controller.api.auth.changePassword);
  router.post('/api/auth/logout', userAuth, controller.api.auth.logout);

  /* --- 用户资料（需鉴权） --- */
  router.put('/api/user/profile', userAuth, controller.api.user.updateProfile);
  router.post('/api/user/avatar', userAuth, controller.api.user.uploadAvatar);
  router.get('/api/user/vip-info', userAuth, controller.api.user.vipInfo);

  /* --- 兑换码（需鉴权 + 限流） --- */
  router.post('/api/redeem/use', userAuth, redeemRateLimit, controller.api.redeem.use);

  /* --- 文件上传（无需鉴权，支持未登录用户） --- */
  router.post('/api/upload/image', controller.api.upload.uploadImage);

  /* --- 用户反馈（无需鉴权，支持未登录用户） --- */
  router.post('/api/feedback/submit', controller.api.feedback.submit);

  /* --- 剧本管理（需鉴权） --- */
  router.post('/api/script', userAuth, controller.api.script.create);
  router.get('/api/script', userAuth, controller.api.script.list);
  /* 具体路由必须放在参数路由前面 */
  router.get('/api/script/:id/export-word', controller.api.scriptExport.exportWord);
  router.get('/api/script/:id', userAuth, controller.api.script.detail);
  router.put('/api/script/:id', userAuth, controller.api.script.update);
  router.post('/api/script/:id/rewrite', userAuth, controller.api.script.rewrite);
  router.delete('/api/script/:id', userAuth, controller.api.script.destroy);

  /* --- 剧本导出 Word（流式，需鉴权） --- */
  router.post('/api/script-export/:taskId/cancel', controller.api.scriptExport.cancelExport);
  /* 下载导出的文件（临时，简单实现） */
  router.get('/api/script-export/download/:taskId', controller.api.scriptExport.download);

  /* --- 剧本分集（需鉴权） --- */
  router.post('/api/script-episode/batch-save', userAuth, controller.api.scriptEpisode.batchSave);

  /* --- 台本生成（需鉴权） --- */
  router.post('/api/script-episode/:id/generate-script', userAuth, controller.api.scriptGenerate.generateEpisodeScript);
  router.post('/api/script-episode/:id/stop-generate', userAuth, controller.api.scriptGenerate.stopGenerate);
  router.put('/api/script-episode/:id/script', userAuth, controller.api.scriptGenerate.saveEpisodeScript);

  /* --- 分镜头生成（需鉴权） --- */
  router.get('/api/script/:scriptId/storyboards', userAuth, controller.api.storyboardGenerate.batchGetStoryboards);
  router.post('/api/script-episode/:id/generate-storyboard', userAuth, controller.api.storyboardGenerate.generateStoryboard);
  router.post('/api/script-episode/:id/stop-storyboard', userAuth, controller.api.storyboardGenerate.stopGenerate);
  router.get('/api/script-episode/:id/storyboard', userAuth, controller.api.storyboardGenerate.getStoryboard);
  router.put('/api/script-episode/:id/storyboard', userAuth, controller.api.storyboardGenerate.saveStoryboard);

  /* --- 视频分镜生成（需鉴权） --- */
  router.post('/api/script-episode/:id/generate-video-storyboard', userAuth, controller.api.storyboardGenerate.generateVideoStoryboard);
  router.post('/api/script-episode/:id/stop-video-storyboard', userAuth, controller.api.storyboardGenerate.stopVideoGenerate);
  router.get('/api/script-episode/:id/video-storyboard', userAuth, controller.api.storyboardGenerate.getVideoStoryboard);
  router.put('/api/script-episode/:id/video-storyboard', userAuth, controller.api.storyboardGenerate.saveVideoStoryboard);

  /* --- AI对话（需鉴权） --- */
  router.post('/api/ai-chat/stream', userAuth, controller.api.aiChat.stream);
  router.post('/api/ai-chat/stop', userAuth, controller.api.aiChat.stop);
  router.get('/api/ai-chat/records', userAuth, controller.api.aiChat.records);

  /* --- 小说项目（需鉴权） --- */
  router.post('/api/novel-project', userAuth, controller.api.novelProject.create);
  router.get('/api/novel-project', userAuth, controller.api.novelProject.list);
  router.get('/api/novel-project/:id', userAuth, controller.api.novelProject.detail);
  router.put('/api/novel-project/:id', userAuth, controller.api.novelProject.update);
  router.post('/api/novel-project/:id/episodes/batch-save', userAuth, controller.api.novelProject.batchSaveEpisodes);
  router.get('/api/novel-project/:id/assets', userAuth, controller.api.novelProject.assets);
  router.put('/api/novel-project/:id/assets', userAuth, controller.api.novelProject.saveAssets);
  router.post('/api/novel-project/:id/assets/sync-characters', userAuth, controller.api.novelProject.syncCharacters);
  router.delete('/api/novel-project/:id/assets/character/:characterId', userAuth, controller.api.novelProject.deleteCharacter);
  router.delete('/api/novel-project/:id', userAuth, controller.api.novelProject.destroy);

  /* --- 小说单集剧本生成（需鉴权） --- */
  router.post('/api/novel-episode/:id/generate-script', userAuth, controller.api.novelScriptGenerate.generateEpisodeScript);
  router.post('/api/novel-episode/:id/stop-generate', userAuth, controller.api.novelScriptGenerate.stopGenerate);
  router.put('/api/novel-episode/:id/script', userAuth, controller.api.novelScriptGenerate.saveEpisodeScript);

  /* --- 小说分镜头生成（需鉴权） --- */
  router.get('/api/novel-project/:projectId/storyboards', userAuth, controller.api.novelStoryboardGenerate.batchGetStoryboards);
  router.post('/api/novel-episode/:id/generate-storyboard', userAuth, controller.api.novelStoryboardGenerate.generateStoryboard);
  router.post('/api/novel-episode/:id/stop-storyboard', userAuth, controller.api.novelStoryboardGenerate.stopGenerate);
  router.get('/api/novel-episode/:id/storyboard', userAuth, controller.api.novelStoryboardGenerate.getStoryboard);
  router.put('/api/novel-episode/:id/storyboard', userAuth, controller.api.novelStoryboardGenerate.saveStoryboard);

  /* --- 小说视频分镜生成（需鉴权） --- */
  router.post('/api/novel-episode/:id/generate-video-storyboard', userAuth, controller.api.novelStoryboardGenerate.generateVideoStoryboard);
  router.post('/api/novel-episode/:id/stop-video-storyboard', userAuth, controller.api.novelStoryboardGenerate.stopVideoGenerate);
  router.get('/api/novel-episode/:id/video-storyboard', userAuth, controller.api.novelStoryboardGenerate.getVideoStoryboard);
  router.put('/api/novel-episode/:id/video-storyboard', userAuth, controller.api.novelStoryboardGenerate.saveVideoStoryboard);

  /* --- 小说角色资产（需鉴权） --- */
  router.put('/api/novel-asset/:id', userAuth, controller.api.novelAsset.update);
  router.post('/api/novel-asset/:id/upload-avatar', userAuth, controller.api.novelAsset.uploadAvatar);
  router.post('/api/novel-asset/:id/generate-avatar', userAuth, controller.api.novelAsset.generateAvatar);
  router.post('/api/novel-asset/:id/generate-prompt', userAuth, controller.api.novelAsset.generatePrompt);
  router.post('/api/novel-asset/:id/upload-scene-image', userAuth, controller.api.novelAsset.uploadSceneImage);
  router.post('/api/novel-asset/:id/generate-scene-image', userAuth, controller.api.novelAsset.generateSceneImage);
  router.post('/api/novel-asset/:id/generate-scene-prompt', userAuth, controller.api.novelAsset.generateScenePrompt);

  /* --- 小说Agent对话（需鉴权） --- */
  router.post('/api/novel-agent/chat', userAuth, controller.api.novelAgent.chat);
  router.post('/api/novel-agent/stop', userAuth, controller.api.novelAgent.stop);
  router.get('/api/novel-agent/history', userAuth, controller.api.novelAgent.history);
  router.delete('/api/novel-agent/history', userAuth, controller.api.novelAgent.clearHistory);

  /* --- 剧本角色（需鉴权） --- */
  router.get('/api/script/:scriptId/characters', userAuth, controller.api.scriptCharacter.list);
  router.post('/api/script/:scriptId/characters', userAuth, controller.api.scriptCharacter.batchSave);
  router.post('/api/script/:scriptId/characters/parse', userAuth, controller.api.scriptCharacter.parseFromText);
  router.post('/api/script/:scriptId/characters/parse-preview', userAuth, controller.api.scriptCharacter.parsePreview);
  router.get('/api/script/:scriptId/scenes', userAuth, controller.api.scriptScene.list);
  router.put('/api/script/:scriptId/scenes', userAuth, controller.api.scriptScene.save);
  router.get('/api/script/:scriptId/scenes/extract-precheck', userAuth, controller.api.scriptScene.extractPrecheck);
  router.post('/api/script/:scriptId/scenes/extract', userAuth, controller.api.scriptScene.extract);
  router.put('/api/script-scene/:id/prompt', userAuth, controller.api.scriptScene.updatePrompt);
  router.post('/api/script-scene/:id/upload-image', userAuth, controller.api.scriptScene.uploadImage);
  router.post('/api/script-scene/:id/generate-prompt', userAuth, controller.api.scriptScene.generatePrompt);
  router.post('/api/script-scene/:id/generate-image', userAuth, controller.api.scriptScene.generateImage);
  router.put('/api/script-character/:id', userAuth, controller.api.scriptCharacter.update);
  router.delete('/api/script-character/:id', userAuth, controller.api.scriptCharacter.destroy);
  router.post('/api/script-character/:id/upload-avatar', userAuth, controller.api.scriptCharacter.uploadAvatar);
  router.post('/api/script-character/:id/generate-avatar', userAuth, controller.api.scriptCharacter.generateAvatar);
  router.post('/api/script-character/:id/generate-prompt', userAuth, controller.api.scriptCharacter.generatePrompt);

  /* --- 封面图生成（需鉴权） --- */
  router.post('/api/cover/generate-prompt', userAuth, controller.api.cover.generatePrompt);
  router.post('/api/cover/generate-image', userAuth, controller.api.cover.generateImage);

  /* --- 用户模型配置（需鉴权） --- */
  router.get('/api/model-config/models', userAuth, controller.api.modelConfig.listModels);
  router.get('/api/model-config/models/:id', userAuth, controller.api.modelConfig.getModel);
  router.post('/api/model-config/models', userAuth, controller.api.modelConfig.createModel);
  router.put('/api/model-config/models/:id', userAuth, controller.api.modelConfig.updateModel);
  router.delete('/api/model-config/models/:id', userAuth, controller.api.modelConfig.deleteModel);
  router.get('/api/model-config/scenes', userAuth, controller.api.modelConfig.listScenes);
  router.post('/api/model-config/scenes/bind', userAuth, controller.api.modelConfig.bindScene);
  router.post('/api/model-config/scenes/unbind', userAuth, controller.api.modelConfig.unbindScene);
  router.get('/api/model-config/status', userAuth, controller.api.modelConfig.getStatus);
  router.post('/api/model-config/test', userAuth, controller.api.modelConfig.testConnection);

  /* --- 充值配置获取（无需鉴权即可查看） --- */
  router.get('/api/vip/config', controller.api.vip.getConfig);

  /* --- 支付（创建和查询需鉴权，回调无需鉴权） --- */
  router.post('/api/payment/create', userAuth, controller.api.payment.create);
  router.get('/api/payment/query', userAuth, controller.api.payment.query);
  router.get('/api/payment/orders', userAuth, controller.api.payment.orders);
  router.post('/api/payment/notify', controller.api.payment.notify);

  /* ========================================
   * SPA Fallback（仅 localhost 模式）
   * Electron/Docker 中前端是 Nuxt 生成的静态文件（SPA）
   * 非 API、非管理后台的 GET 请求统一返回 index.html
   * 必须放在所有路由的最后面
   * ======================================== */
  if (app.config.deployMode === 'localhost') {
    const fs = require('fs');
    const nodePath = require('path');
    router.get('*', async ctx => {
      const indexPath = nodePath.join(app.baseDir, 'web', 'index.html');
      if (fs.existsSync(indexPath)) {
        ctx.type = 'text/html';
        ctx.body = fs.createReadStream(indexPath);
      }
    });
  }

};
