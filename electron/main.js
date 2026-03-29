'use strict';

const fs = require('fs');
const { app, BrowserWindow, dialog, Menu, shell, nativeImage } = require('electron');
const { fork, spawn } = require('child_process');
const path = require('path');
const http = require('http');

/* ========================================
 * 配置
 * ======================================== */
const SERVER_PORT = 7006;
const FRONTEND_DEV_PORT = 7005;
const isDev = !app.isPackaged;
const APP_DISPLAY_NAME = '知剧AI';
const APP_ICON_PATH = path.join(__dirname, 'icons', 'icon.png');

app.setName(APP_DISPLAY_NAME);

/* 服务端目录：开发时指向项目目录，打包后指向 resources/server */
const SERVER_DIR = isDev
  ? path.join(__dirname, '..', 'storyweaver-api')
  : path.join(process.resourcesPath, 'server');

/* 前端目录（仅 dev 模式使用） */
const WEB_DIR = path.join(__dirname, '..', 'storyweaver-web');

/*
 * 窗口加载地址：
 * 开发模式 → http://localhost:7005（Nuxt dev server，支持热更新）
 * 打包模式 → http://localhost:7006（Egg.js 托管前端静态文件）
 */
const LOAD_URL = isDev
  ? `http://127.0.0.1:${FRONTEND_DEV_PORT}`
  : `http://127.0.0.1:${SERVER_PORT}`;

let mainWindow = null;
let serverProcess = null;
let frontendProcess = null;
let splashWindow = null;
let splashProgress = 0;
let splashProgressTimer = null;
let splashProgressCap = 0;

function getSplashHtml() {
  return `data:text/html;charset=utf-8,
    <html>
    <body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;
      background:linear-gradient(160deg,%23ff6b35,%23f7418f,%23e83e8c);
      font-family:-apple-system,BlinkMacSystemFont,sans-serif;border-radius:16px;overflow:hidden;">
      <div style="text-align:center;color:white;">
        <div style="font-size:36px;font-weight:800;margin-bottom:12px;">${APP_DISPLAY_NAME}</div>
        <div id="progress-text" style="font-size:14px;opacity:0.85;margin-bottom:16px;">正在准备启动...</div>
        <div style="width:220px;height:6px;background:rgba(255,255,255,0.18);border-radius:999px;margin:0 auto;overflow:hidden;">
          <div id="progress-fill" style="width:0%;height:100%;background:white;border-radius:999px;transition:width .28s ease;"></div>
        </div>
        <div id="progress-percent" style="font-size:13px;opacity:0.72;margin-top:12px;">0%</div>
      </div>
    </body>
    </html>
  `;
}

function setSplashProgressCap(nextCap) {
  splashProgressCap = Math.max(splashProgressCap, Math.min(99, Math.round(nextCap)));
}

function updateSplashProgress(nextProgress, nextText) {
  if (!splashWindow || splashWindow.isDestroyed()) {
    return;
  }

  const progress = Math.max(splashProgress, Math.min(100, Math.round(nextProgress)));
  const text = JSON.stringify(nextText || '正在准备启动...');
  splashProgress = progress;

  splashWindow.webContents.executeJavaScript(`
    (() => {
      const fill = document.getElementById('progress-fill');
      const textNode = document.getElementById('progress-text');
      const percentNode = document.getElementById('progress-percent');
      if (fill) fill.style.width = '${progress}%';
      if (textNode) textNode.textContent = ${text};
      if (percentNode) percentNode.textContent = '${progress}%';
    })();
  `).catch(() => {});
}

function startSplashProgress() {
  clearInterval(splashProgressTimer);
  splashProgressTimer = setInterval(() => {
    if (splashProgress >= splashProgressCap) {
      return;
    }

    const step = splashProgress < 30 ? 3 : splashProgress < 60 ? 2 : 1;
    updateSplashProgress(Math.min(splashProgress + step, splashProgressCap), '正在启动服务...');
  }, 240);
}

function stopSplashProgress() {
  if (splashProgressTimer) {
    clearInterval(splashProgressTimer);
    splashProgressTimer = null;
  }
}

/* ========================================
 * 启动 Egg.js 后端服务
 * ======================================== */
function startServer() {
  return new Promise((resolve, reject) => {
    const launcherPath = path.join(SERVER_DIR, 'launcher.js');

    serverProcess = fork(launcherPath, [], {
      cwd: SERVER_DIR,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        DEPLOY_MODE: 'localhost',
        PORT: String(SERVER_PORT),
        EGG_SERVER_ENV: 'local',
        EGG_HOME: SERVER_DIR,
      },
      silent: true,
    });

    serverProcess.stdout?.on('data', (data) => {
      console.log(`[Server] ${data.toString().trim()}`);
    });

    serverProcess.stderr?.on('data', (data) => {
      console.error(`[Server Error] ${data.toString().trim()}`);
    });

    serverProcess.on('error', (err) => {
      console.error('[Server] 启动失败:', err);
      reject(err);
    });

    serverProcess.on('exit', (code) => {
      console.log(`[Server] 进程退出, code=${code}`);
      serverProcess = null;
    });

    /* 等待 launcher.js 发送 ready 消息 */
    serverProcess.on('message', (msg) => {
      if (msg === 'server-ready') {
        console.log('[Server] Egg.js 已就绪');
        resolve();
      }
    });

    /* 超时兜底：如果 10 秒内没收到 ready，用 HTTP 轮询检测 */
    const timeout = setTimeout(() => {
      pollServerReady(resolve, reject, 0);
    }, 10000);

    serverProcess.once('message', () => clearTimeout(timeout));
  });
}

/**
 * 轮询检测服务是否就绪
 */
function pollServerReady(resolve, reject, attempt) {
  if (attempt > 40) {
    reject(new Error('服务启动超时'));
    return;
  }

  http.get(`http://127.0.0.1:${SERVER_PORT}/api/health`, (res) => {
    if (res.statusCode === 200) {
      resolve();
    } else {
      setTimeout(() => pollServerReady(resolve, reject, attempt + 1), 500);
    }
  }).on('error', () => {
    setTimeout(() => pollServerReady(resolve, reject, attempt + 1), 500);
  });
}

/* ========================================
 * 启动 Nuxt dev server（仅开发模式）
 * ======================================== */
function startFrontendDev() {
  return new Promise((resolve, reject) => {
    console.log('[Frontend] 正在启动 Nuxt dev server...');

    /* 使用 npx nuxt dev 并指定 .env.localhost，保证 DEPLOY_MODE=localhost */
    frontendProcess = spawn('npx', ['nuxt', 'dev', '--dotenv', '.env.localhost'], {
      cwd: WEB_DIR,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    frontendProcess.stdout?.on('data', (data) => {
      const output = data.toString().trim();
      if (output) console.log(`[Frontend] ${output}`);
    });

    frontendProcess.stderr?.on('data', (data) => {
      const output = data.toString().trim();
      if (output) console.error(`[Frontend Error] ${output}`);
    });

    frontendProcess.on('error', (err) => {
      console.error('[Frontend] 启动失败:', err);
      reject(err);
    });

    frontendProcess.on('exit', (code) => {
      console.log(`[Frontend] 进程退出, code=${code}`);
      frontendProcess = null;
    });

    /* 轮询等待 Nuxt dev server 就绪（最多 120 秒，Nuxt 首次启动可能较慢） */
    pollFrontendReady(resolve, reject, 0);
  });
}

/**
 * 轮询检测 Nuxt dev server 是否就绪
 */
function pollFrontendReady(resolve, reject, attempt) {
  if (attempt > 240) {
    reject(new Error('前端 dev server 启动超时（超过 120 秒）'));
    return;
  }

  http.get(`http://127.0.0.1:${FRONTEND_DEV_PORT}`, (res) => {
    res.resume();
    if (res.statusCode < 500) {
      console.log('[Frontend] Nuxt dev server 已就绪');
      resolve();
    } else {
      setTimeout(() => pollFrontendReady(resolve, reject, attempt + 1), 500);
    }
  }).on('error', () => {
    setTimeout(() => pollFrontendReady(resolve, reject, attempt + 1), 500);
  });
}

/* ========================================
 * 创建启动画面（loading）
 * ======================================== */
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  splashProgress = 0;
  splashProgressCap = 55;
  splashWindow.loadURL(getSplashHtml());
  splashWindow.webContents.once('did-finish-load', () => {
    updateSplashProgress(5, '正在启动后端服务...');
    startSplashProgress();
  });
}

/* ========================================
 * 创建主窗口
 * ======================================== */
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: APP_DISPLAY_NAME,
    icon: APP_ICON_PATH,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.webContents.once('dom-ready', () => {
    setSplashProgressCap(92);
    updateSplashProgress(82, '界面资源加载中...');
  });

  mainWindow.webContents.once('did-finish-load', () => {
    setSplashProgressCap(96);
    updateSplashProgress(92, '界面即将准备完成...');
  });

  mainWindow.loadURL(LOAD_URL);

  mainWindow.once('ready-to-show', () => {
    stopSplashProgress();
    updateSplashProgress(100, '启动完成，正在进入应用...');

    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }
      mainWindow.show();
    }, 180);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  /* 外部链接在系统浏览器中打开 */
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

/* ========================================
 * 设置菜单
 * ======================================== */
function setupMenu() {
  const template = [
    {
      label: APP_DISPLAY_NAME,
      submenu: [
        { label: '关于', role: 'about' },
        { type: 'separator' },
        { label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '刷新' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { role: 'resetZoom', label: '重置缩放' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ========================================
 * 停止所有子进程
 * ======================================== */
function stopAllServices() {
  stopSplashProgress();

  if (serverProcess) {
    console.log('[Server] 正在停止...');
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }

  if (frontendProcess) {
    console.log('[Frontend] 正在停止...');
    /* spawn 创建的进程树需要用 SIGTERM 杀掉整个进程组 */
    try {
      process.kill(-frontendProcess.pid, 'SIGTERM');
    } catch {
      frontendProcess.kill('SIGTERM');
    }
    frontendProcess = null;
  }
}

/* ========================================
 * 应用生命周期
 * ======================================== */
app.on('ready', async () => {
  if (process.platform === 'darwin' && app.dock && fs.existsSync(APP_ICON_PATH)) {
    app.dock.setIcon(nativeImage.createFromPath(APP_ICON_PATH));
  }
  setupMenu();
  createSplashWindow();

  try {
    if (isDev) {
      /* 开发模式：同时启动后端 + 前端 dev server */
      updateSplashProgress(5, '正在启动后端服务...');
      const serverReady = startServer().then(() => {
        updateSplashProgress(35, '后端服务已就绪');
        console.log('[启动] 后端就绪 ✓');
      });

      updateSplashProgress(8, '正在启动前端 dev server...');
      setSplashProgressCap(70);
      const frontendReady = startFrontendDev().then(() => {
        updateSplashProgress(65, '前端 dev server 已就绪');
        console.log('[启动] 前端就绪 ✓');
      });

      /* 并行等待，两个都就绪后再创建窗口 */
      await Promise.all([serverReady, frontendReady]);
    } else {
      /* 打包模式：只启动后端（前端是 Egg.js 托管的静态文件） */
      await startServer();
    }

    setSplashProgressCap(85);
    updateSplashProgress(72, '服务已就绪，正在加载界面...');
    createMainWindow();
  } catch (err) {
    console.error('[启动失败]', err);
    stopAllServices();
    dialog.showErrorBox('启动失败', `服务启动失败:\n${err.message}\n\n请检查端口 ${SERVER_PORT}、${FRONTEND_DEV_PORT} 是否被占用。`);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  stopAllServices();
  app.quit();
});

app.on('before-quit', () => {
  stopAllServices();
});

app.on('activate', () => {
  if (mainWindow === null && serverProcess) {
    createMainWindow();
  }
});
