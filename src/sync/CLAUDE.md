[根目录](../../CLAUDE.md) > [src](../) > **sync**

---

# Sync 模块

> 同步流程编排、冲突检测与处理、.gitignore 规则解析

---

## 变更记录 (Changelog)

| 时间 | 变更 |
|------|------|
| 2026-04-05 15:30 | 初始化模块文档 |

---

## 模块职责

协调 Git 操作和冲突处理，执行完整的同步流程：

- **SyncManager**：编排 Pull -> Push 同步流程，管理同步状态
- **ConflictHandler**：检测冲突，创建备份副本，管理冲突队列
- **IgnoreRules**：解析 .gitignore 文件，过滤应忽略的文件

---

## 入口与启动

### 初始化流程

```typescript
const syncManager = new SyncManager(app, gitService, settings);
await syncManager.init();  // 加载冲突队列和 .gitignore 规则
```

### 同步流程

```
用户触发同步
    │
    ▼
检查同步条件（未解决冲突？网络连接？）
    │
    ▼
Step 1: Pull (git fetch + merge)
    │
    ├─ 有冲突 → 冲突处理流程
    │
    ▼
Step 2: 检查本地变更（过滤 .gitignore）
    │
    ├─ 有变更 → add → commit → push
    │
    └─ 无变更 → 结束
```

---

## 对外接口

### SyncManager

| 方法 | 描述 | 返回值 |
|------|------|--------|
| `init()` | 初始化（加载配置） | `Promise<void>` |
| `getStatus()` | 获取当前同步状态 | `SyncStatus` |
| `canSync()` | 检查是否可同步 | `Promise<{canProceed, reason}>` |
| `sync(onProgress?)` | 执行完整同步流程 | `Promise<SyncResult>` |
| `getConflictHandler()` | 获取冲突处理器 | `ConflictHandler` |
| `getPendingCount()` | 获取待同步数量 | `Promise<{staged, unstaged}>` |

### ConflictHandler

| 方法 | 描述 | 返回值 |
|------|------|--------|
| `load()` | 加载冲突队列 | `Promise<void>` |
| `save()` | 保存冲突队列 | `Promise<void>` |
| `handleConflicts(files)` | 处理冲突列表 | `Promise<ConflictInfo[]>` |
| `getPendingConflicts()` | 获取待解决冲突 | `ConflictInfo[]` |
| `hasPendingConflicts()` | 是否有待解决冲突 | `boolean` |
| `resolveKeepLocal(id)` | 解决冲突（保留本地） | `Promise<void>` |
| `resolveKeepRemote(id)` | 解决冲突（保留远程） | `Promise<void>` |
| `resolveMerged(id)` | 解决冲突（手动合并） | `Promise<void>` |
| `cleanupResolved()` | 清理已解决记录 | `Promise<void>` |

### IgnoreRules

| 方法 | 描述 | 返回值 |
|------|------|--------|
| `load()` | 加载 .gitignore 文件 | `Promise<boolean>` |
| `shouldIgnore(path)` | 检查是否应忽略 | `boolean` |
| `filter(files)` | 过滤不应忽略的文件 | `string[]` |
| `createDefault()` | 创建默认 .gitignore | `Promise<void>` |

---

## 关键依赖与配置

### 依赖

| 包 | 用途 | 版本 |
|---|------|------|
| `ignore` | .gitignore 规则解析 | ^5.3.0 |
| `obsidian` | Obsidian API | latest |

### 冲突队列存储

```
.obsidian/plugins/obsidian-git-sync/conflict-queue.json
```

### 冲突文件命名规则

```
原文件：    笔记/2024-04-02.md
冲突备份：  笔记/2024-04-02-remote-{timestamp}.md
```

---

## 数据模型

### SyncStatus

```typescript
type SyncStatus = 'idle' | 'syncing' | 'conflict' | 'error' | 'success';
```

### SyncResult

```typescript
interface SyncResult {
  success: boolean;
  status: SyncStatus;
  pushed: number;
  pulled: number;
  conflicts: ConflictInfo[];
  error?: string;
}
```

### ConflictInfo

```typescript
interface ConflictInfo {
  id: string;           // 冲突唯一标识
  file: string;         // 原文件路径
  backupFile: string;   // 远程版本备份路径
  detectedAt: string;   // 检测时间
  status: 'pending' | 'resolved';
  localModified: string;  // 本地修改时间
  remoteModified: string; // 远程修改时间
}
```

### ConflictQueue

```typescript
interface ConflictQueue {
  conflicts: ConflictInfo[];
  lastSync: string | null;
}
```

---

## 测试与质量

### 当前状态

- 无单元测试
- 测试覆盖率：0%

### 测试优先级

1. **P0**：`SyncManager.sync()` - 完整同步流程
2. **P0**：`ConflictHandler.handleConflicts()` - 冲突检测和备份创建
3. **P0**：`ConflictHandler.resolveKeep*()` - 冲突解决操作
4. **P1**：`IgnoreRules.shouldIgnore()` - 规则过滤逻辑
5. **P1**：`SyncManager.canSync()` - 同步条件检查

### 测试建议

```typescript
describe('SyncManager', () => {
  it('should block sync when conflicts pending', async () => {
    // 模拟未解决冲突
    const result = await syncManager.canSync();
    expect(result.canProceed).toBe(false);
  });
  
  it('should execute pull then push', async () => {
    // 验证同步顺序：Pull -> 检查变更 -> Push
  });
});

describe('ConflictHandler', () => {
  it('should create backup with timestamp', async () => {
    // 验证备份文件命名格式
  });
  
  it('should keep local version correctly', async () => {
    // 验证保留本地版本时删除备份
  });
});
```

---

## 常见问题 (FAQ)

### Q: 为什么冲突时强制用户手动解决？

A: 自动合并可能导致数据丢失；创建备份副本确保用户可以查看并选择保留哪个版本。

### Q: 冲突备份文件存储在哪里？

A: 与原文件同级目录，命名格式为 `{basename}-remote-{timestamp}.{ext}`。

### Q: .gitignore 规则如何加载？

A: 桌面端通过 Node.js fs 直接读取（支持隐藏文件）；移动端通过 Obsidian API（不支持隐藏文件索引）；未找到时使用默认规则。

### Q: 默认忽略规则包含哪些？

A: `.obsidian/`、`.trash/`、`.DS_Store`、`Thumbs.db`、`*.tmp`、`.git/`、插件 data.json。

---

## 相关文件清单

| 文件 | 行数 | 描述 |
|------|------|------|
| `sync-manager.ts` | 172 | 同步流程编排 |
| `conflict-handler.ts` | 204 | 冲突检测与处理 |
| `ignore-rules.ts` | 150 | .gitignore 解析 |

---

## API 使用示例

### 执行同步

```typescript
const result = await syncManager.sync((status, message) => {
  statusBar.setStatus(status, message);
});

if (result.success) {
  console.log(`Synced: push ${result.pushed}, pull ${result.pulled}`);
} else if (result.status === 'conflict') {
  // 显示冲突弹窗
}
```

### 解决冲突

```typescript
const handler = syncManager.getConflictHandler();
const conflicts = handler.getPendingConflicts();

for (const conflict of conflicts) {
  // 用户选择后
  await handler.resolveKeepLocal(conflict.id);
}
```

---

*文档生成时间：2026-04-05 15:30:17*