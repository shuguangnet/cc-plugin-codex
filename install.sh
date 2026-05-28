#!/usr/bin/env bash
# cc-plugin-codex 安装脚本
set -euo pipefail

PLUGIN_DIR="${HOME}/.codex/plugins/cc"
REPO_URL="https://github.com/shuguangnet/cc-plugin-codex.git"

echo "🔧 安装 cc-plugin-codex..."

# 检查前置条件
check_command() {
  if ! command -v "$1" &>/dev/null; then
    echo "❌ 未找到 $1。请先安装。"
    return 1
  fi
  echo "✅ $1 已安装"
}

echo ""
echo "检查前置条件..."
check_command node
check_command git

# 检查 Node.js 版本
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Node.js 版本过低。需要 ≥ 18，当前: $(node -v)"
  exit 1
fi
echo "✅ Node.js 版本: $(node -v)"

# 克隆或更新插件
if [ -d "$PLUGIN_DIR" ]; then
  echo ""
  echo "📁 插件目录已存在，更新中..."
  cd "$PLUGIN_DIR"
  git pull origin main
else
  echo ""
  echo "📥 克隆插件..."
  mkdir -p "$(dirname "$PLUGIN_DIR")"
  git clone "$REPO_URL" "$PLUGIN_DIR"
fi

echo ""
echo "✅ cc-plugin-codex 安装完成！"
echo ""
echo "使用方法："
echo "  /cc:setup    - 检查环境"
echo "  /cc:task     - 委托任务"
echo "  /cc:review   - 代码审查"
echo "  /cc:doctor   - 诊断信息"
echo ""
echo "📖 更多信息: https://github.com/shuguangnet/cc-plugin-codex"
