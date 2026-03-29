#!/bin/bash

# ============================================
# 知剧AI Electron 打包 - 资源准备脚本
# 执行顺序: build.sh → electron-builder
# ============================================

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[BUILD]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# 项目根目录（electron/ 的上一层）
ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ELECTRON_DIR="$ROOT_DIR/electron"
API_DIR="$ROOT_DIR/storyweaver-api"
WEB_DIR="$ROOT_DIR/storyweaver-web"
RESOURCES_DIR="$ELECTRON_DIR/resources"

log "=== 知剧AI Electron 打包开始 ==="
log "项目根目录: $ROOT_DIR"

# ==========================================
# Step 1: 构建前端静态文件
# ==========================================
log "Step 1/5: 构建前端静态文件..."
cd "$WEB_DIR"

# 使用 .env.localhost 配置文件构建（DEPLOY_MODE=localhost）
npm run generate:local
log "前端构建完成 → $WEB_DIR/.output/public/"

# ==========================================
# Step 2: 准备 resources 目录
# ==========================================
log "Step 2/5: 准备资源目录..."

# 清理旧的 resources
rm -rf "$RESOURCES_DIR"
mkdir -p "$RESOURCES_DIR/server"
mkdir -p "$RESOURCES_DIR/web"

# 复制前端静态文件
cp -r "$WEB_DIR/.output/public/." "$RESOURCES_DIR/web/"
log "前端静态文件已复制"

# ==========================================
# Step 3: 复制后端代码（排除不需要的文件）
# ==========================================
log "Step 3/5: 复制后端代码..."

# 使用 rsync 排除不需要的目录
rsync -a \
  --exclude 'node_modules' \
  --exclude 'data' \
  --exclude 'logs' \
  --exclude 'run' \
  --exclude 'temp' \
  --exclude '.DS_Store' \
  --exclude '*.log' \
  --exclude 'config/config.local.js' \
  --exclude 'config/config.prod.js' \
  --exclude '.env.production' \
  --exclude 'app/cert' \
  "$API_DIR/" "$RESOURCES_DIR/server/"

# 强制写入 localhost 模式的 .env（覆盖可能从源码复制来的 network 值）
cat > "$RESOURCES_DIR/server/.env" << 'EOF'
DEPLOY_MODE=localhost
EOF
log "已写入 .env → DEPLOY_MODE=localhost"

# ==========================================
# Step 4: 安装后端依赖 + 重建 sqlite3 原生模块
# ==========================================
log "Step 4/5: 安装后端生产依赖..."
cd "$RESOURCES_DIR/server"
npm install --production

# sqlite3 是原生模块，必须为 Electron 的 Node.js ABI 重新编译
log "重建 sqlite3 原生模块（适配 Electron）..."
cd "$ELECTRON_DIR"
npx @electron/rebuild -f -w sqlite3 -m "$RESOURCES_DIR/server"

log "后端代码已准备完毕"

# ==========================================
# Step 5: 检查关键文件
# ==========================================
log "Step 5/5: 检查关键文件..."

check_file() {
  if [ ! -f "$1" ]; then
    warn "缺失: $1"
    return 1
  fi
}

check_file "$RESOURCES_DIR/web/index.html" || { warn "前端 index.html 不存在，请检查 nuxt generate 是否成功"; exit 1; }
check_file "$RESOURCES_DIR/server/launcher.js" || { warn "launcher.js 不存在"; exit 1; }
check_file "$RESOURCES_DIR/server/app.js" || { warn "app.js 不存在"; exit 1; }
check_file "$RESOURCES_DIR/server/package.json" || { warn "server package.json 不存在"; exit 1; }

log "=== 资源准备完成！==="
log ""
log "接下来执行 electron-builder 打包:"
log "  Mac:     cd $ELECTRON_DIR && npx electron-builder --mac"
log "  Windows: cd $ELECTRON_DIR && npx electron-builder --win"
log ""
