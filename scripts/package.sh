#!/bin/bash

# Obsidian Git Sync 插件打包脚本
# 用于发布到 Obsidian 插件市场

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 获取版本号
VERSION=$(node -p "require('./manifest.json').version")
PLUGIN_ID=$(node -p "require('./manifest.json').id")
PACKAGE_NAME="${PLUGIN_ID}-${VERSION}"

echo -e "${GREEN}=== Obsidian Git Sync 打包脚本 ===${NC}"
echo ""

# 检查是否有未提交的更改
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}警告: 存在未提交的更改${NC}"
    git status --short
    echo ""
    read -p "是否继续打包? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}打包已取消${NC}"
        exit 1
    fi
fi

# 清理旧的构建文件
echo -e "${YELLOW}清理旧的构建文件...${NC}"
rm -f main.js

# 执行构建
echo -e "${YELLOW}构建插件...${NC}"
npm run build

# 检查必需文件
echo -e "${YELLOW}检查必需文件...${NC}"
REQUIRED_FILES=("main.js" "manifest.json" "styles.css")
MISSING_FILES=()

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        MISSING_FILES+=("$file")
    fi
done

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo -e "${RED}错误: 缺少必需文件:${NC}"
    printf '  - %s\n' "${MISSING_FILES[@]}"
    exit 1
fi

# 创建 release 目录
echo -e "${YELLOW}创建发布目录...${NC}"
rm -rf release
mkdir -p release

# 复制文件到 release 目录
cp main.js release/
cp manifest.json release/
cp styles.css release/

# 创建 zip 包
echo -e "${YELLOW}创建发布包...${NC}"
cd release
zip -r "${PACKAGE_NAME}.zip" main.js manifest.json styles.css
cd ..

# 显示结果
echo ""
echo -e "${GREEN}=== 打包完成 ===${NC}"
echo -e "版本: ${VERSION}"
echo -e "文件: release/${PACKAGE_NAME}.zip"
echo ""
echo -e "包含文件:"
echo -e "  - main.js"
echo -e "  - manifest.json"
echo -e "  - styles.css"
echo ""
echo -e "${YELLOW}下一步:${NC}"
echo -e "  1. 在 GitHub/Gitee 创建新的 Release"
echo -e "  2. 上传 release/${PACKAGE_NAME}.zip"
echo -e "  3. 发布 Release"