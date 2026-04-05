#!/usr/bin/env node

/**
 * 开发部署脚本
 * 将构建输出复制到 Obsidian 插件目录
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 颜色定义
const colors = {
  red: '\x1b[0;31m',
  green: '\x1b[0;32m',
  yellow: '\x1b[1;33m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Obsidian 插件目录配置
// 请根据实际情况修改此路径
const PLUGIN_DIR = process.env.OBSIDIAN_PLUGIN_DIR ||
  '/home/fengshuai/文档/Obsidian Vault/.obsidian/plugins/obsidian-git-sync';

function main() {
  const rootDir = path.join(__dirname, '..');
  const distDir = path.join(rootDir, 'dist');

  log('green', '=== 开发部署 ===\n');

  // 构建插件
  log('yellow', '构建插件...');
  execSync('npm run build', { stdio: 'inherit', cwd: rootDir });

  // 检查构建输出
  const mainJs = path.join(distDir, 'main.js');
  if (!fs.existsSync(mainJs)) {
    log('red', '错误: 构建失败，找不到 dist/main.js');
    process.exit(1);
  }

  // 复制到 Obsidian 插件目录
  log('yellow', `复制到: ${PLUGIN_DIR}`);

  const files = [
    { src: 'dist/main.js', dest: 'main.js' },
    { src: 'src/manifest.json', dest: 'manifest.json' },
    { src: 'src/styles.css', dest: 'styles.css' }
  ];

  for (const file of files) {
    const src = path.join(rootDir, file.src);
    const dest = path.join(PLUGIN_DIR, file.dest);
    fs.copyFileSync(src, dest);
    console.log(`  ✓ ${file.dest}`);
  }

  console.log('');
  log('green', '部署完成！请重新加载 Obsidian 插件。');
}

main();