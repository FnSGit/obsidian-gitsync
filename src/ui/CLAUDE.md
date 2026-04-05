[根目录](../../CLAUDE.md) > [src](../) > **ui**

---

# UI 模块

> Obsidian UI 组件：Ribbon 图标、状态栏、冲突弹窗、设置面板

---

## 变更记录 (Changelog)

| 时间 | 变更 |
|------|------|
| 2026-04-05 15:30 | 初始化模块文档 |

---

## 模块职责

提供 Obsidian 用户界面组件：

- **RibbonIcon**：侧边栏图标，显示同步状态，触发同步操作
- **StatusBar**：底部状态栏，显示同步进度和统计
- **ConflictModal**：冲突解决弹窗，对比本地/远程版本
- **GitSyncSettingTab**：设置面板，配置认证和自动同步

---

## 入口与启动

### UI 初始化顺序

```typescript
// 1. 状态栏（确保用户能看到状态）
statusBar = new StatusBar(app, addStatusBarItem());

// 2. Ribbon 图标（触发同步）
ribbonEl = addRibbonIcon('git-branch', 'Git Sync', handleSync);
ribbonIcon = new RibbonIcon(app, ribbonEl, handleSync, showConflicts);

// 3. 设置面板
addSettingTab(new GitSyncSettingTab(app, plugin));

// 4. 注册命令
addCommand({ id: 'sync', name: 'Sync with remote', callback: handleSync });
addCommand({ id: 'show-conflicts', name: 'Show pending conflicts', callback: showConflicts });
```

---

## 对外接口

### StatusBar

| 方法 | 描述 | 参数 |
|------|------|------|
| `setStatus(status, message?)` | 设置状态和消息 | `SyncStatus`, `string?` |
| `setStats(pushed, pulled)` | 设置同步统计 | `number`, `number` |
| `destroy()` | 销毁组件 | - |

### RibbonIcon

| 方法 | 描述 | 参数 |
|------|------|------|
| `setStatus(status)` | 更新图标状态 | `SyncStatus` |
| `destroy()` | 销毁组件 | - |

**右键菜单操作**：
- 立即同步
- 查看冲突
- 打开设置

### ConflictModal

继承 `Modal`，显示冲突对比和解决选项：
- 本地版本 vs 远程版本对比
- 三个解决选项：保留本地/保留远程/手动合并

### GitSyncSettingTab

继承 `PluginSettingTab`，配置分组：
- 远程仓库配置
- 认证方式（Token/SSH）
- 自动同步选项
- 排除规则（.gitignore）
- 状态信息
- 危险操作（重置）

---

## 关键依赖与配置

### 样式文件

```
styles.css - UI 样式定义
```

### 状态显示

| 状态 | 图标 | 状态栏文本 | CSS 类 |
|------|------|-----------|--------|
| idle | | Git Sync: 未同步/刚刚同步 | `.idle` |
| syncing | (旋转) | Git Sync: 同步中... | `.syncing` |
| success | | Git Sync: 已同步 | `.success` |
| conflict | | Git Sync: 有冲突待解决 | `.conflict` |
| error | | Git Sync: 同步失败 | `.error` |

---

## 数据模型

### SyncCallback / ShowConflictsCallback

```typescript
type SyncCallback = () => Promise<void>;
type ShowConflictsCallback = () => void;
```

---

## 测试与质量

### 当前状态

- 无单元测试
- UI 组件难以直接测试，建议通过 E2E 测试覆盖

### 测试优先级

1. **P1**：E2E 测试 - 同步流程 UI 交互
2. **P2**：设置面板配置保存验证

---

## 常见问题 (FAQ)

### Q: 状态栏点击触发什么？

A: 点击状态栏触发 `obsidian-git-sync:sync` 命令，执行同步。

### Q: Ribbon 图标右键菜单包含什么？

A: 立即同步、查看冲突、打开设置三个选项。

### Q: 冲突弹窗如何对比版本？

A: 左右两栏显示本地和远程版本内容（截断到 1000 字符），用户选择后执行对应解决操作。

### Q: .gitignore 如何在设置中管理？

A: 检测是否存在，提供"打开"或"创建默认"按钮操作。

---

## 相关文件清单

| 文件 | 行数 | 描述 |
|------|------|------|
| `ribbon-icon.ts` | 105 | Ribbon 图标组件 |
| `status-bar.ts` | 108 | 状态栏组件 |
| `conflict-modal.ts` | 135 | 冲突解决弹窗 |
| `settings-tab.ts` | 253 | 设置面板 |

---

## UI 组件使用示例

### 更新同步状态

```typescript
// 同步开始
statusBar.setStatus('syncing', '正在拉取远程更新...');
ribbonIcon.setStatus('syncing');

// 同步成功
statusBar.setStatus('success');
statusBar.setStats(pushed, pulled);
ribbonIcon.setStatus('success');

// 同步冲突
statusBar.setStatus('conflict');
ribbonIcon.setStatus('conflict');
```

### 显示冲突弹窗

```typescript
new ConflictModal(app, conflictHandler, () => {
  // 冲突解决后回调
  statusBar.setStatus('idle');
  new Notice('冲突已解决，可以继续同步');
}).open();
```

---

## 样式定义

```css
/* 状态栏样式 */
.git-sync-status { display: flex; gap: 4px; font-size: 12px; }
.git-sync-status.syncing { color: var(--text-muted); }
.git-sync-status.success { color: var(--text-success); }

/* 冲突弹窗对比视图 */
.git-sync-conflict-modal .diff-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

/* Ribbon 图标动画 */
.git-sync-icon.syncing {
  animation: spin 1s linear infinite;
}
```

---

*文档生成时间：2026-04-05 15:30:17*