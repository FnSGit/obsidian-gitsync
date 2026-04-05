[根目录](../../CLAUDE.md) > [src](../) > **utils**

---

# Utils 模块

> 工具函数：日志工具、文件操作工具

---

## 变更记录 (Changelog)

| 时间 | 变更 |
|------|------|
| 2026-04-05 15:30 | 初始化模块文档 |

---

## 模块职责

提供通用工具函数：

- **Logger**：统一日志输出，支持多级别（DEBUG/INFO/WARN/ERROR）
- **FileUtils**：Obsidian Vault 文件操作封装

---

## 入口与启动

### Logger 使用

```typescript
import { logger, LogLevel } from './utils/logger';

// 设置日志级别
logger.setLevel(LogLevel.DEBUG);

// 输出日志
logger.info('Git Sync plugin loaded');
logger.error('Sync failed:', error);
```

### FileUtils 使用

```typescript
const fileUtils = new FileUtils(app);

// 读写文件
const content = await fileUtils.readFile('notes/test.md');
await fileUtils.writeFile('notes/test.md', newContent);

// 检查文件存在
if (fileUtils.fileExists('.gitignore')) {
  // ...
}
```

---

## 对外接口

### Logger

| 方法 | 描述 | 前缀 |
|------|------|------|
| `setLevel(level)` | 设置日志级别 | - |
| `debug(message, ...args)` | DEBUG 级别日志 | `[Git Sync]` |
| `info(message, ...args)` | INFO 级别日志 | `[Git Sync]` |
| `warn(message, ...args)` | WARN 级别日志 | `[Git Sync]` |
| `error(message, ...args)` | ERROR 级别日志 | `[Git Sync]` |

### LogLevel

```typescript
enum LogLevel {
  DEBUG = 0,  // 最详细
  INFO = 1,   // 默认
  WARN = 2,   // 警告
  ERROR = 3,  // 仅错误
}
```

### FileUtils

| 方法 | 描述 | 返回值 |
|------|------|--------|
| `readFile(path)` | 读取文件内容 | `Promise<string>` |
| `writeFile(path, content)` | 写入/创建文件 | `Promise<void>` |
| `deleteFile(path)` | 删除文件 | `Promise<void>` |
| `fileExists(path)` | 检查文件存在 | `boolean` |
| `ensureDir(path)` | 创建目录（如不存在） | `Promise<void>` |
| `listFiles(dirPath)` | 递归列出目录文件 | `string[]` |
| `getVaultRoot()` | 获取仓库根路径 | `string` |

---

## 关键依赖与配置

### 日志级别配置

默认级别：`INFO`

建议开发时使用 `DEBUG`，生产使用 `INFO` 或 `WARN`。

---

## 测试与质量

### 当前状态

- 无单元测试

### 测试优先级

1. **P2**：Logger 各级别输出测试
2. **P2**：FileUtils 文件操作测试（需要模拟 Obsidian Vault）

---

## 常见问题 (FAQ)

### Q: 为什么使用自定义 Logger 而非 console？

A: 提供统一前缀和级别控制，便于在生产环境过滤日志。

### Q: FileUtils 与 Obsidian Vault API 的关系？

A: FileUtils 封装 Obsidian Vault API，提供更简洁的接口和错误处理。

---

## 相关文件清单

| 文件 | 行数 | 描述 |
|------|------|------|
| `logger.ts` | 40 | 日志工具 |
| `file-utils.ts` | 101 | 文件操作工具 |

---

## API 使用示例

### 日志输出

```typescript
logger.debug('Git status:', changes);
logger.info('Pull completed, pulled:', pullResult.conflictFiles.length);
logger.warn('Token format invalid');
logger.error('Push failed:', error);
```

### 文件操作

```typescript
// 递归列出所有文件
const files = fileUtils.listFiles('/');
console.log(`Vault has ${files.length} files`);

// 获取仓库根路径
const vaultPath = fileUtils.getVaultRoot();
// 桌面端：返回绝对路径
// 移动端：可能返回空字符串
```

---

*文档生成时间：2026-04-05 15:30:17*