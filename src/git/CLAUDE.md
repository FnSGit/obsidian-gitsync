[根目录](../../CLAUDE.md) > [src](../) > **git**

---

# Git 模块

> Git 操作抽象层，屏蔽底层实现差异（系统 Git vs isomorphic-git）

---

## 变更记录 (Changelog)

| 时间 | 变更 |
|------|------|
| 2026-04-05 15:30 | 初始化模块文档 |

---

## 模块职责

提供统一的 Git 操作接口，屏蔽桌面端（系统 Git）和移动端（isomorphic-git）的实现差异：

- 检测并选择最佳 Git 实现
- 提供仓库初始化、克隆、状态查询、提交、推送、拉取等操作
- 支持冲突检测和远程内容获取

---

## 入口与启动

### Git 实现选择逻辑

```typescript
// 桌面端优先尝试系统 Git（支持 SSH）
if (Platform.isDesktopApp && await isNativeGitAvailable()) {
  return new NativeGitService(app);
}
// 移动端或回退到 isomorphic-git（需要 Token）
return new IsomorphicGitService(app);
```

### 初始化流程

1. 检测系统 Git 可用性：`isNativeGitAvailable()`
2. 创建对应 Git 服务实例
3. 检查仓库状态：`isRepoInitialized()`
4. 如需初始化：`initRepo()`

---

## 对外接口

### GitService 接口

| 方法 | 描述 | 返回值 |
|------|------|--------|
| `isRepoInitialized()` | 检查仓库是否已初始化 | `Promise<boolean>` |
| `initRepo()` | 初始化 Git 仓库 | `Promise<void>` |
| `clone(url, dir)` | 克隆远程仓库 | `Promise<void>` |
| `getRemoteUrl()` | 获取远程仓库 URL | `Promise<string | null>` |
| `setRemoteUrl(url)` | 设置远程仓库 URL | `Promise<void>` |
| `getCurrentBranch()` | 获取当前分支名 | `Promise<string>` |
| `getStatus()` | 获取文件变更状态 | `Promise<FileChange[]>` |
| `getUncommittedCount()` | 获取未提交变更数量 | `Promise<{staged, unstaged}>` |
| `add(files?)` | 添加文件到暂存区 | `Promise<void>` |
| `commit(message)` | 提交变更 | `Promise<void>` |
| `pull()` | 拉取远程变更 | `Promise<{hasConflicts, conflictFiles}>` |
| `push()` | 推送到远程 | `Promise<void>` |
| `getFileContent(path, ref?)` | 获取指定文件内容 | `Promise<string>` |
| `checkConnection()` | 检查网络连接 | `Promise<boolean>` |
| `setToken?(token)` | 设置认证 Token | `void` |
| `dispose()` | 清理资源 | `void` |

---

## 关键依赖与配置

### 依赖

| 包 | 用途 | 版本 |
|---|------|------|
| `isomorphic-git` | 纯 JS Git 实现 | ^1.25.0 |
| `obsidian` | Obsidian API | latest |

### NativeGitService 特性

- 使用系统 `git` 命令
- 支持 SSH 认证（自动使用系统 SSH 配置）
- 需要桌面端 Electron 环境（`window.require`）

### IsomorphicGitService 特性

- 纯 JavaScript 实现，无需系统 Git
- 需要 Token 认证（不支持 SSH）
- SSH URL 自动转换为 HTTPS URL

---

## 数据模型

### FileChange

```typescript
interface FileChange {
  path: string;
  status: FileStatus;  // 'added' | 'modified' | 'deleted' | 'renamed' | 'conflicted'
}
```

### PullResult

```typescript
interface PullResult {
  hasConflicts: boolean;
  conflictFiles: string[];
}
```

---

## 测试与质量

### 当前状态

- 无单元测试
- 测试覆盖率：0%

### 测试优先级

1. **P0**：`getStatus()` - 文件状态检测
2. **P0**：`pull()` - 拉取和冲突检测
3. **P0**：`push()` - 推送操作
4. **P1**：`initRepo()` / `clone()` - 仓库初始化
5. **P1**：`checkConnection()` - 连接检测

### 测试建议

```typescript
// 测试 getStatus 状态映射
describe('GitService.getStatus', () => {
  it('should map isomorphic-git status matrix correctly', async () => {
    // 验证状态码映射：head/workdir/stage -> FileStatus
  });
  
  it('should skip .obsidian directory', async () => {
    // 验证过滤 .obsidian 目录
  });
});

// 测试 pull 冲突检测
describe('GitService.pull', () => {
  it('should detect conflicts correctly', async () => {
    // 模拟冲突场景
  });
});
```

---

## 常见问题 (FAQ)

### Q: 为什么桌面端优先使用系统 Git？

A: 系统 Git 支持 SSH 认证，无需额外配置 Token；isomorphic-git 仅支持 HTTPS + Token 认证。

### Q: isomorphic-git 为什么不支持 SSH？

A: SSH 协议需要复杂的加密实现，isomorphic-git 设计为纯 JavaScript，未实现 SSH 客户端。

### Q: SSH URL 如何处理？

A: IsomorphicGitService 会自动将 SSH URL (`git@gitee.com:user/repo.git`) 转换为 HTTPS URL。

### Q: 冲突文件状态如何检测？

A: isomorphic-git 状态矩阵中 `head=1, workdir=3, stage=3` 表示冲突；NativeGitService 检测 `UU/AA/DD` 状态码。

---

## 相关文件清单

| 文件 | 行数 | 描述 |
|------|------|------|
| `git-service.ts` | 91 | Git 抽象接口定义 |
| `native-git.ts` | 249 | 系统 Git 实现 |
| `isomorphic-git.ts` | 420 | 纯 JS Git 实现 |

---

## API 使用示例

### 初始化仓库

```typescript
const gitService = await getGitService(app);

if (!await gitService.isRepoInitialized()) {
  await gitService.initRepo();
}

await gitService.setRemoteUrl('https://gitee.com/user/vault.git');
```

### 执行同步

```typescript
// 拉取远程变更
const pullResult = await gitService.pull();

if (pullResult.hasConflicts) {
  // 处理冲突...
}

// 检查本地变更
const changes = await gitService.getStatus();

if (changes.length > 0) {
  await gitService.add();
  await gitService.commit('sync: ' + new Date().toISOString());
  await gitService.push();
}
```

---

*文档生成时间：2026-04-05 15:30:17*