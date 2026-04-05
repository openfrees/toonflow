'use strict';

const fs = require('fs');
const net = require('net');
const { app, BrowserWindow, dialog, Menu, shell, nativeImage } = require('electron');
const { fork, spawn, execSync } = require('child_process');
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

/* 用户数据目录（日志等写到这里，不放 .app 包内）
 * macOS: ~/Library/Application Support/zhijuai-desktop/
 * Windows: C:\Users\<user>\AppData\Roaming\zhijuai-desktop\ */
const USER_DATA_DIR = app.getPath('userData');
const LOG_DIR = isDev ? null : path.join(USER_DATA_DIR, 'logs');
const PID_FILE = path.join(USER_DATA_DIR, '.server.pid');

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
 * 端口检测与清理（核心增强）
 * ======================================== */

/**
 * 检测端口是否被占用（用 net 模块精准检测，不依赖系统命令）
 */
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      server.close();
      resolve(err.code === 'EADDRINUSE');
    });
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port, '127.0.0.1');
  });
}

/**
 * 延迟指定毫秒
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 按端口杀进程 — 多策略杀进程链，确保端口一定释放
 * macOS: lsof 详细查找 → 杀进程树 → 按进程名匹配兜底
 * Windows: netstat 查找 → taskkill 强制终止
 */
function killPort(port) {
  console.log(`[PortCleanup] 正在清理端口 ${port} 上的残留进程...`);

  if (process.platform === 'win32') {
    killPortWindows(port);
  } else {
    killPortUnix(port);
  }
}

function killPortWindows(port) {
  try {
    const out = execSync(
      `netstat -ano | findstr :${port} | findstr LISTENING`,
      { encoding: 'utf8', timeout: 5000 }
    );
    const pids = [...new Set(
      out.split('\n')
        .map(l => l.trim().split(/\s+/).pop())
        .filter(p => /^\d+$/.test(p) && p !== '0')
    )];
    pids.forEach(pid => {
      console.log(`[PortCleanup] Windows 杀进程 PID=${pid}`);
      try { execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore', timeout: 5000 }); } catch {}
    });
  } catch {}
}

function killPortUnix(port) {
  /* 策略1: lsof 精确查找监听该端口的所有进程，逐个杀进程树 */
  try {
    const out = execSync(
      `lsof -nP -iTCP:${port} -sTCP:LISTEN -t 2>/dev/null`,
      { encoding: 'utf8', timeout: 5000 }
    );
    const pids = out.trim().split('\n').filter(p => /^\d+$/.test(p.trim()));
    pids.forEach(pid => {
      pid = pid.trim();
      console.log(`[PortCleanup] lsof 发现 PID=${pid}，杀进程树...`);
      try { execSync(`pkill -9 -P ${pid} 2>/dev/null`, { stdio: 'ignore', timeout: 3000 }); } catch {}
      try { execSync(`kill -9 ${pid} 2>/dev/null`, { stdio: 'ignore', timeout: 3000 }); } catch {}
    });
  } catch {}

  /* 策略2: 用 lsof -ti 的简写方式兜底（和策略1可能有重叠，但无害） */
  try {
    execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null`, { stdio: 'ignore', timeout: 5000 });
  } catch {}

  /* 策略3: 按 cwd 或 cmdline 搜索 node 进程（针对 Egg.js master 进程杀不死的场景）
   * Egg.js master 可能不直接监听端口，但它的子进程监听，杀子进程后 master 会重拉
   * 需要找到 master 一起杀掉 */
  try {
    const serverDir = isDev
      ? path.join(__dirname, '..', 'storyweaver-api')
      : path.join(process.resourcesPath, 'server');
    const out = execSync(
      `ps -eo pid,command | grep -E "node.*launcher\\.js|egg-cluster|eggjs" | grep -v grep`,
      { encoding: 'utf8', timeout: 5000 }
    );
    const lines = out.trim().split('\n').filter(Boolean);
    lines.forEach(line => {
      const match = line.trim().match(/^(\d+)/);
      if (match) {
        const pid = match[1];
        console.log(`[PortCleanup] 按进程名找到疑似残留 PID=${pid}: ${line.trim().substring(0, 80)}`);
        try { execSync(`pkill -9 -P ${pid} 2>/dev/null`, { stdio: 'ignore', timeout: 3000 }); } catch {}
        try { execSync(`kill -9 ${pid} 2>/dev/null`, { stdio: 'ignore', timeout: 3000 }); } catch {}
      }
    });
  } catch {}

  /* 策略4: 如果有 fuser 命令，直接让它杀（某些 Linux 发行版有，macOS 不一定有） */
  try {
    execSync(`fuser -k ${port}/tcp 2>/dev/null`, { stdio: 'ignore', timeout: 5000 });
  } catch {}
}

/**
 * 确保端口可用 — 检测→杀→等待→验证→重试，最多 maxRetries 轮
 * 返回 true 表示端口已释放，false 表示仍被占用
 */
async function ensurePortFree(port, maxRetries = 5) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const inUse = await isPortInUse(port);
    if (!inUse) {
      if (attempt > 0) {
        console.log(`[PortCleanup] 端口 ${port} 已成功释放（第 ${attempt} 轮清理后）`);
      } else {
        console.log(`[PortCleanup] 端口 ${port} 空闲，无需清理`);
      }
      return true;
    }

    if (attempt === maxRetries) {
      console.error(`[PortCleanup] 端口 ${port} 经过 ${maxRetries} 轮清理仍被占用！`);
      return false;
    }

    console.log(`[PortCleanup] 端口 ${port} 被占用，第 ${attempt + 1}/${maxRetries} 轮清理...`);
    killPort(port);

    /* 每轮等待递增：500ms → 800ms → 1200ms → 1800ms → 2500ms，给系统更多释放时间 */
    const waitMs = 500 + attempt * 300 + attempt * attempt * 100;
    await sleep(waitMs);
  }
  return false;
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
        ...(LOG_DIR ? { ZHIJUAI_LOG_DIR: LOG_DIR } : {}),
      },
      silent: true,
    });

    try { fs.writeFileSync(PID_FILE, String(serverProcess.pid)); } catch {}

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
 * 强制杀掉进程树（同步执行，确保杀干净）
 * ======================================== */
function forceKillProcessTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      execSync(`pkill -9 -P ${pid} 2>/dev/null; kill -9 ${pid} 2>/dev/null`, { stdio: 'ignore' });
    }
  } catch {}
}

/* ========================================
 * 清理上次残留的后端进程（异步，确保端口真正释放后再返回）
 * ======================================== */
async function cleanupOrphanedProcesses() {
  /* 第一步：按 PID 文件清理已知残留进程 */
  try {
    if (fs.existsSync(PID_FILE)) {
      const oldPid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
      if (oldPid) {
        console.log(`[Cleanup] 发现残留进程 PID=${oldPid}，正在清理...`);
        forceKillProcessTree(oldPid);
      }
    }
  } catch {}
  try { fs.unlinkSync(PID_FILE); } catch {}

  /* 第二步：确保两个端口都释放（无论开发/打包模式，都清理 7005 和 7006，防止交叉残留） */
  const serverPortFree = await ensurePortFree(SERVER_PORT);
  if (!serverPortFree) {
    throw new Error(`端口 ${SERVER_PORT} 被占用且无法释放，请手动检查或重启电脑后重试`);
  }

  const frontendPortFree = await ensurePortFree(FRONTEND_DEV_PORT);
  if (!frontendPortFree) {
    throw new Error(`端口 ${FRONTEND_DEV_PORT} 被占用且无法释放，请手动检查或重启电脑后重试`);
  }
}

/* ========================================
 * 停止所有子进程（同步强杀，不给残留机会）
 * ======================================== */
function stopAllServices() {
  stopSplashProgress();

  if (serverProcess) {
    console.log(`[Server] 正在停止 PID=${serverProcess.pid}...`);
    forceKillProcessTree(serverProcess.pid);
    serverProcess = null;
  }

  try { fs.unlinkSync(PID_FILE); } catch {}

  if (frontendProcess) {
    console.log(`[Frontend] 正在停止 PID=${frontendProcess.pid}...`);
    forceKillProcessTree(frontendProcess.pid);
    frontendProcess = null;
  }

  killPort(SERVER_PORT);
  if (isDev) killPort(FRONTEND_DEV_PORT);
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
    /* 先清理残留进程，确保端口可用（异步等待，确保杀干净） */
    updateSplashProgress(2, '正在检测端口占用...');
    await cleanupOrphanedProcesses();
    updateSplashProgress(5, '端口已就绪');

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

app.on('will-quit', () => {
  killPort(SERVER_PORT);
  if (isDev) killPort(FRONTEND_DEV_PORT);
});

app.on('activate', () => {
  if (mainWindow === null && serverProcess) {
    createMainWindow();
  }
});
