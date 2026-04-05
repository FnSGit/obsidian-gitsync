#!/usr/bin/env node

/**
 * Obsidian Git Sync 插件打包脚本
 * 用于发布到 Obsidian 插件市场
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

function main() {
  log('green', '=== Obsidian Git Sync 打包脚本 ===\n');

  // 读取 manifest.json
  const manifestPath = path.join(__dirname, '..', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const { version, id } = manifest;
  const packageName = `${id}-${version}`;

  // 检查是否有未提交的更改
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8' });
    if (status.trim()) {
      log('yellow', '警告: 存在未提交的更改');
      console.log(status);
      log('yellow', '继续打包...\n');
    }
  } catch (e) {
    // Git 不可用，继续
  }

  // 清理旧的构建文件
  log('yellow', '清理旧的构建文件...');
  const mainJsPath = path.join(__dirname, '..', 'main.js');
  if (fs.existsSync(mainJsPath)) {
    fs.unlinkSync(mainJsPath);
  }

  // 执行构建
  log('yellow', '构建插件...');
  execSync('npm run build', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

  // 检查必需文件
  log('yellow', '检查必需文件...');
  const requiredFiles = ['main.js', 'manifest.json', 'styles.css'];
  const missingFiles = [];

  for (const file of requiredFiles) {
    const filePath = path.join(__dirname, '..', file);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(file);
    }
  }

  if (missingFiles.length > 0) {
    log('red', `错误: 缺少必需文件:`);
    missingFiles.forEach(f => console.log(`  - ${f}`));
    process.exit(1);
  }

  // 创建 release 目录
  log('yellow', '创建发布目录...');
  const releaseDir = path.join(__dirname, '..', 'release');
  if (fs.existsSync(releaseDir)) {
    fs.rmSync(releaseDir, { recursive: true });
  }
  fs.mkdirSync(releaseDir, { recursive: true });

  // 复制文件到 release 目录
  for (const file of requiredFiles) {
    const src = path.join(__dirname, '..', file);
    const dest = path.join(releaseDir, file);
    fs.copyFileSync(src, dest);
  }

  // 创建 zip 包
  log('yellow', '创建发布包...');
  const zipFile = path.join(releaseDir, `${packageName}.zip`);

  // 使用系统 zip 命令或 archiver
  try {
    execSync(`cd "${releaseDir}" && zip -r "${packageName}.zip" ${requiredFiles.join(' ')}`, { stdio: 'inherit' });
  } catch (e) {
    // zip 命令不可用，尝试使用 Node.js 的 archiver
    log('yellow', 'zip 命令不可用，请手动压缩文件');
    log('green', `\n=== 打包完成 ===`);
    console.log(`版本: ${version}`);
    console.log(`目录: release/`);
    console.log(`\n包含文件:`);
    requiredFiles.forEach(f => console.log(`  - ${f}`));
    return;
  }

  // 显示结果
  console.log('');
  log('green', '=== 打包完成 ===');
  console.log(`版本: ${version}`);
  console.log(`文件: release/${packageName}.zip`);
  console.log('');
  console.log('包含文件:');
  requiredFiles.forEach(f => console.log(`  - ${f}`));
  console.log('');
  log('yellow', '下一步:');
  console.log('  1. 在 GitHub/Gitee 创建新的 Release');
  console.log('  2. 上传 release/' + packageName + '.zip');
  console.log('  3. 发布 Release');
}

main();