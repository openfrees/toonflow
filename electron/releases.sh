#!/bin/bash

# 知剧AI - GitHub Releases 快速发布脚本
# 用法: cd electron && bash releases.sh

set -e

DIST_DIR="./dist"
REPO="openfrees/toonflow"

# ========== 交互收集信息 ==========

read -p "📦 请输入版本号（如 v1.0.0）: " VERSION

# 去掉前缀 v 拿纯数字版本号，用于拼文件名
NUM_VERSION="${VERSION#v}"

read -p "📝 请输入标题（直接回车默认: 知剧AI ${VERSION}）: " TITLE
TITLE="${TITLE:-知剧AI ${VERSION}}"
echo "📄 请输入更新内容（支持多行，输入完按回车后再按 Ctrl+D 结束）:"
NOTES=$(cat)

# ========== 检查文件是否存在 ==========

FILE_MAC_ARM64="${DIST_DIR}/知剧AI-${NUM_VERSION}-arm64.dmg"
FILE_MAC_X64="${DIST_DIR}/知剧AI-${NUM_VERSION}.dmg"
FILE_WIN_X64="${DIST_DIR}/知剧AI Setup ${NUM_VERSION}.exe"

echo ""
echo "🔍 检查打包文件..."

MISSING=0
for f in "$FILE_MAC_ARM64" "$FILE_MAC_X64" "$FILE_WIN_X64"; do
  if [ -f "$f" ]; then
    echo "  ✅ $(basename "$f")"
  else
    echo "  ❌ 未找到: $f"
    MISSING=1
  fi
done

if [ "$MISSING" -eq 1 ]; then
  read -p "⚠️  有文件缺失，是否仍然继续发布存在的文件？(y/n): " CONFIRM
  if [ "$CONFIRM" != "y" ]; then
    echo "已取消。"
    exit 1
  fi
fi

# 收集实际存在的文件
FILES=()
for f in "$FILE_MAC_ARM64" "$FILE_MAC_X64" "$FILE_WIN_X64"; do
  if [ -f "$f" ]; then
    FILES+=("$f")
  fi
done

if [ ${#FILES[@]} -eq 0 ]; then
  echo "❌ 没有任何可上传的文件，退出。"
  exit 1
fi

# ========== 确认信息 ==========

echo ""
echo "=============================="
echo "  版本号: $VERSION"
echo "  标题:   $TITLE"
echo "  文件数: ${#FILES[@]}"
echo "  仓库:   $REPO"
echo "------------------------------"
echo "  更新内容:"
echo "$NOTES" | sed 's/^/    /'
echo "=============================="
echo ""

read -p "🚀 确认发布到 GitHub Releases？(y/n): " GO
if [ "$GO" != "y" ]; then
  echo "已取消。"
  exit 0
fi

# ========== 打 tag 并推送 ==========

echo ""
echo "🏷️  创建 tag: $VERSION ..."

if git rev-parse "$VERSION" >/dev/null 2>&1; then
  echo "  ⏭️  tag $VERSION 已存在，跳过创建"
else
  git tag -a "$VERSION" -m "$TITLE"
  echo "  ✅ tag 已创建"
fi

echo "📤 推送 tag 到 GitHub..."
git push github "$VERSION"

# ========== 创建 Release 并上传文件 ==========

echo "📦 创建 Release 并上传文件..."
gh release create "$VERSION" \
  "${FILES[@]}" \
  --repo "$REPO" \
  --title "$TITLE" \
  --notes "$NOTES"

echo ""
echo "🎉 发布成功！"
echo "👉 https://github.com/$REPO/releases/tag/$VERSION"
