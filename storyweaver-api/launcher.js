'use strict';

/**
 * Egg.js 独立启动器
 * 供 Electron / Docker 使用，通过 child_process.fork 调用
 * 启动完成后向父进程发送 ready 消息
 */
const egg = require('egg');
const path = require('path');

const port = Number(process.env.PORT) || 7006;

egg.startCluster({
  baseDir: __dirname,
  port,
  workers: 1,
}, () => {
  console.log(`[Launcher] Egg.js server started on port ${port}`);
  if (process.send) {
    process.send('server-ready');
  }
});
