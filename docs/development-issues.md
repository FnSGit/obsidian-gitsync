# 开发问题记录

> 记录 Obsidian Git Sync 插件开发过程中遇到的问题和解决方案

---

## 一、认证问题

### 1.1 桌面端 SSH 无需 Token

**问题描述**：

原代码检查 `Platform.isDesktopApp` 来决定是否需要 Token，但桌面端如果没有安装 Git，也需要 Token 认证。

**解决方案**：

检查 `useNativeGit` 标志而非 `Platform.isDesktopApp`：

```typescript
// src/index.ts
if (!this.useNativeGit) {
  // 需要 Token 认证
  if (!this.settings.token) {
    const platform = Platform.isDesktopApp ? '桌面端未检测到 Git' : '移动端';
    new Notice(`${platform}需要配置访问令牌`);
    return;
  }
  this.gitService.setToken?.(this.settings.token);
}
```

**认证决策流程**：

```
桌面端有 Git → NativeGitService → SSH 认证（无需 Token）
桌面端无 Git → IsomorphicGitService → 需要 Token
移动端       → IsomorphicGitService → 需要 Token
```

---

## 二、Node.js 模块问题

### 2.1 child_process 静态导入失败

**问题描述**：

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
```

静态导入在 Obsidian 环境中失败，导致整个插件无法加载，UI 不显示。

**错误信息**：插件加载时静默失败，无任何 UI 元素。

**解决方案**：

使用 `window.require` 动态导入：

```typescript
// src/git/native-git.ts
let execAsync: (command: string, options?: { cwd?: string; env?: Record<string, string> }) => Promise<{ stdout: string; stderr: string }>;

async function initNodeModules(): Promise<boolean> {
  try {
    // 在 Obsidian Electron 环境中使用 window.require
    if (typeof window !== 'undefined' && window.require) {
      const childProcess = window.require('child_process');
      const util = window.require('util');
      execAsync = util.promisify(childProcess.exec);
      return true;
    }
    return false;
  } catch (error) {
    logger.warn('Failed to load Node.js modules:', error);
    return false;
  }
}
```

**原因**：Obsidian 插件环境对 Node.js 模块有特殊处理，静态导入会在模块加载阶段失败。

---

## 三、隐藏文件问题

### 3.1 .gitignore 无法通过 Obsidian API 读取

**问题描述**：

```typescript
const file = this.app.vault.getAbstractFileByPath('.gitignore');
// file 始终为 null
```

控制台显示：`No .gitignore found, using default ignore rules`

**原因**：Obsidian 默认不索引以 `.` 开头的隐藏文件。

**解决方案**：

桌面端使用 Node.js `fs` 模块直接读取：

```typescript
// src/sync/ignore-rules.ts
private async loadFromFileSystem(): Promise<string | null> {
  try {
    if (typeof window !== 'undefined' && window.require) {
      const fs = window.require('fs');
      const path = window.require('path');

      const adapter = this.app.vault.adapter as unknown as { basePath?: string };
      const vaultPath = adapter.basePath;

      if (!vaultPath) return null;

      const gitignorePath = path.join(vaultPath, '.gitignore');

      if (fs.existsSync(gitignorePath)) {
        return fs.readFileSync(gitignorePath, 'utf-8');
      }
    }
    return null;
  } catch (error) {
    logger.warn('Failed to read .gitignore via file system:', error);
    return null;
  }
}
```

---

## 四、Git 操作问题

### 4.1 pull --rebase 要求工作区干净

**问题描述**：

```bash
错误：不能变基拉取，您有未暂存变更
```

**原因**：`git pull --rebase` 要求工作区必须干净，否则会失败。

**解决方案**：

使用 `fetch + merge` 替代 `pull --rebase`：

```typescript
// src/git/native-git.ts
async pull(): Promise<{ hasConflicts: boolean; conflictFiles: string[] }> {
  const branch = await this.getCurrentBranch();
  
  // fetch + merge 允许本地有未暂存变更
  await this.execGit('fetch origin');
  await this.execGit(`merge origin/${branch}`);
  
  // ... 冲突检测
}
```

**对比**：

| 操作 | 要求工作区干净 | 允许未暂存变更 |
|------|---------------|---------------|
| `pull --rebase` | ✅ 是 | ❌ 否 |
| `fetch + merge` | ❌ 否 | ✅ 是 |

### 4.2 merge origin/HEAD 失败

**问题描述**：

```bash
错误：不是可以合并的东西
```

**原因**：`origin/HEAD` 符号引用可能未设置。

**解决方案**：

使用当前分支对应的远程分支：

```typescript
const branch = await this.getCurrentBranch(); // 例如 'main'
await this.execGit(`merge origin/${branch}`); // 'origin/main'
```

---

## 五、UI 问题

### 5.1 addClass 不支持空格分隔的多类名

**问题描述**：

```javascript
Uncaught InvalidCharacterError: Failed to execute 'add' on 'DOMTokenList': 
The token provided ('git-sync-icon syncing') contains HTML space characters, 
which are not valid in tokens.
```

**错误代码**：

```typescript
icon.addClass('git-sync-icon syncing'); // 错误！
```

**解决方案**：

使用 `addClasses` 或多次调用 `addClass`：

```typescript
// 方式1：使用 addClasses
icon.addClasses(['git-sync-icon', 'syncing']);

// 方式2：多次调用
icon.addClass('git-sync-icon');
icon.addClass('syncing');
```

**原因**：Obsidian 的 `addClass` 方法直接调用 DOM 的 `classList.add()`，该 API 不接受空格分隔的字符串。

---

## 六、日志问题

### 6.1 Git stderr 误报为警告

**问题描述**：

每次成功推送都显示警告：

```
[Git Sync] Git stderr: remote: Powered by GITEE.COM
remote: Set trace flag 7946e7b5
To gitee.com:FngSGitee/obsidian-sync.git
   6edf17d..4c2fe4b  HEAD -> main
```

**原因**：Git 将进度信息输出到 stderr，成功操作也会有 stderr 输出。

**解决方案**：

只对包含 `error` 或 `fatal` 的 stderr 记录警告：

```typescript
// src/git/native-git.ts
private async execGit(args: string): Promise<string> {
  const { stdout, stderr } = await execAsync(`git ${args}`, options);

  // 只对真正的错误记录警告
  if (stderr && (stderr.toLowerCase().includes('error') || stderr.toLowerCase().includes('fatal'))) {
    logger.warn('Git stderr:', stderr);
  }

  return stdout.trim();
}
```

---

## 七、同步流程总结

### 7.1 最终流程（符合设计文档）

```
用户触发同步
    │
    ▼
检查网络状态 ──否──▶ 提示错误，终止
    │是
    ▼
检查认证配置 ──无──▶ 提示配置，终止
    │有
    ▼
更新状态栏 "🔄 同步中..."
    │
    ▼
Step 1: Pull (fetch + merge)  ← 先拉取
    │
    ├─ 有冲突 → 冲突处理流程
    │
    ▼
Step 2: Push (检查变更 → add → commit → push)  ← 再推送
    │
    ▼
更新状态栏 "✅ 已同步"
```

### 7.2 关键点

1. **Pull 使用 fetch + merge**：允许本地有未暂存变更
2. **显式指定远程分支**：避免 `origin/HEAD` 未设置的问题
3. **动态导入 Node.js 模块**：避免插件加载失败
4. **直接读取隐藏文件**：绕过 Obsidian 的隐藏文件限制

---

*文档更新时间：2026-04-05*