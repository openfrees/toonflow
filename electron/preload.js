'use strict';

const { contextBridge } = require('electron');

/**
 * 预加载脚本 - 安全地向渲染进程暴露有限的 API
 * 目前仅暴露平台信息，后续可按需扩展
 */
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
});
