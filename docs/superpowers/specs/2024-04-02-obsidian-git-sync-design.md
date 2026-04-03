# Obsidian Git Sync 插件设计规范

> 创建日期：2024-04-02
> 版本：1.0.0

---

## 一、概述

### 1.1 项目目标

开发一个 Obsidian 插件，实现 Obsidian 笔记库与 Gitee 远程仓库的双向同步，支持桌面端和移动端跨平台使用。

### 1.2 核心需求

| 需求项 | 描述 |
|--------|------|
| 形式 | Obsidian 插件（跨平台） |
| 远程仓库 | Gitee |
| 同步策略 | 双向同步 |
| 冲突处理 | 创建备份副本，强制用户解决 |
| 界面布局 | Ribbon 图标 + 状态栏 |
| 触发方式 | 混合模式（启动同步 + 定时 + 文件保存 + 手动） |
| 认证方式 | SSH 密钥 + Token 双支持 |
| Git 实现 | 混合方案（桌面系统 Git，移动 Isomorphic Git） |

---

## 二、系统架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Obsidian Git Sync Plugin                  │
├─────────────────────────────────────────────────────────────┤
│  UI Layer        │  Settings        │  Event Handler         │
│  - Ribbon Icon   │  - Auth Config   │  - Auto Sync Timer     │
│  - Status Bar    │  - Ignore Rules  │  - File Watcher        │
│                  │  - Trigger Config│  - Manual Trigger      │
├─────────────────────────────────────────────────────────────┤
│                      Sync Manager                            │
│  - Pull Flow     │  - Push Flow     │  - Conflict Handler    │
├─────────────────────────────────────────────────────────────┤
│                    Git Service (抽象层)                      │
│  - NativeGitImpl (桌面端优先)  │  - IsomorphicGitImpl (移动端) │
├─────────────────────────────────────────────────────────────┤
│                      Auth Provider                           │
│  - SSH Provider  │  - Token Provider                         │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
                   Gitee Remote (HTTPS/SSH)
```

### 2.2 模块职责

| 模块 | 职责 |
|------|------|
| UI Layer | Ribbon 图标状态显示、状态栏信息展示 |
| Settings | 认证配置、触发配置、排除规则管理 |
| Event Handler | 自动同步定时器、文件变更监听、手动触发处理 |
| Sync Manager | 同步流程编排、冲突检测与处理 |
| Git Service | Git 操作抽象层，屏蔽底层实现差异 |
| Auth Provider | SSH 密钥管理、Token 存储与验证 |

---

## 三、核心同步流程

### 3.1 同步流程

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
Step 1: Pull (git fetch + merge)
    │
    ├─ 有冲突 → 冲突处理流程
    │
    ▼
Step 2: Push (检查本地变更 → add → commit → push)
    │
    ▼
更新状态栏 "✅ 已同步"
```

### 3.2 冲突处理流程

**阶段一：检测与备份**

1. 检测到冲突时创建备份文件
2. 保留本地版本
3. 记录到冲突队列 `conflict-queue.json`
4. 通知用户

**阶段二：强制解决**

- ❌ 移除"强制同步"选项
- ✅ 必须选择解决方式：保留本地/保留远程/手动合并
- ✅ 未解决冲突时阻止后续同步

**阶段三：解决后处理**

- 删除备份文件
- 从冲突队列移除
- 允许继续同步

### 3.3 冲突文件命名

```
原文件：   笔记/2024-04-02.md
冲突后：
  笔记/2024-04-02.md              ← 本地版本（保留）
  笔记/2024-04-02-remote-1712053200.md  ← 远程版本备份
```

---

## 四、UI 设计

### 4.1 Ribbon 图标状态

| 状态 | 图标 | 描述 |
|------|------|------|
| 已同步 | 🔄 | 点击触发同步 |
| 同步中 | 🔄 (旋转) | 显示进度 |
| 有冲突 | ⚠️ | 点击处理冲突 |
| 失败 | ❌ | 显示错误信息 |

### 4.2 状态栏

```
✅ Git Sync: 已同步 | ↑3 ↓2 | 10:32
🔄 Git Sync: 同步中... | Pulling
⚠️ Git Sync: 1 个冲突待解决
❌ Git Sync: 认证失败，请检查配置
```

### 4.3 设置界面

**远程仓库配置**
- 仓库地址输入（支持 SSH 和 HTTPS URL）

**认证方式**
- SSH 密钥 / 访问令牌切换
- 生成新密钥 / 导入现有密钥

**自动同步**
- 启动时自动同步：是/否
- 定时自动同步：是/否，间隔选择
- 文件保存时触发同步：是/否
- 仅 WiFi 下自动同步：是/否

**排除规则**
- 使用仓库 `.gitignore` 文件
- 未检测到时使用默认规则
- 提供创建默认 `.gitignore` 按钮

---

## 五、技术实现

### 5.1 技术栈

| 类别 | 技术 |
|------|------|
| 语言 | TypeScript |
| 打包 | esbuild |
| Git 实现 | isomorphic-git (移动端) + 系统 Git (桌面端) |
| SSH 客户端 | node-ssh |
| 忽略规则 | ignore + ignore-walk |
| 测试 | jest |

### 5.2 项目结构

```
obsidian-git-sync/
├── src/
│   ├── index.ts                 # 插件入口
│   ├── types.ts                 # 类型定义
│   ├── git/                     # Git 操作模块
│   ├── sync/                    # 同步逻辑模块
│   ├── auth/                    # 认证模块
│   ├── ui/                      # UI 模块
│   └── utils/                   # 工具函数
├── manifest.json
├── styles.css
├── package.json
├── tsconfig.json
└── esbuild.config.mjs
```

### 5.3 Git 实现选择逻辑

```typescript
async function getGitService(): Promise<GitService> {
  // 桌面端优先尝试系统 Git
  if (isDesktop && await isNativeGitAvailable()) {
    return new NativeGitService();
  }
  // 移动端或回退到 Isomorphic Git
  return new IsomorphicGitService();
}
```

---

## 六、数据存储与安全

### 6.1 存储位置

```
.vault/.obsidian/plugins/obsidian-git-sync/
├── data.json              # 插件设置（加密存储敏感信息）
├── conflict-queue.json    # 冲突队列
└── main.js                # 插件代码
```

### 6.2 安全策略

| 策略 | 实现 |
|------|------|
| 敏感数据加密 | SSH 私钥、Token 使用 Obsidian safeStorage API 加密 |
| 配置文件排除 | data.json 默认加入 .gitignore |
| 输入验证 | URL、密钥格式验证 |
| 自动清理 | 已解决冲突的备份文件、过期记录 |

### 6.3 默认 .gitignore

```gitignore
# Obsidian
.obsidian/
.trash/

# System
.DS_Store
Thumbs.db
*.tmp

# Plugin config (sensitive)
.obsidian/plugins/*/data.json
```

---

## 七、开发计划

### 7.1 阶段划分

| 阶段 | 内容 | 优先级 |
|------|------|--------|
| Phase 1 | 基础框架 + Isomorphic Git + Token 认证 | P0 |
| Phase 2 | 同步流程 + 冲突处理 | P0 |
| Phase 3 | UI 界面 + 设置 | P0 |
| Phase 4 | 系统 Git + SSH 认证 | P1 |
| Phase 5 | 自动同步 + 文件监听 | P1 |
| Phase 6 | 测试 + 文档 | P1 |

### 7.2 MVP 功能

- 手动同步（Ribbon 图标触发）
- Isomorphic Git 实现
- Token 认证
- 基础冲突处理
- 状态栏显示

---

## 八、参考资源

- [Obsidian 插件开发文档](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [Obsidian API 参考](https://docs.obsidian.md/Reference/TypeScript+API/index)
- [isomorphic-git 文档](https://isomorphic-git.org/docs/en/quickstart.html)
- [Gitee API 文档](https://gitee.com/api/v5/swagger)

---

*文档版本：1.0.0*
*创建时间：2024-04-02*
