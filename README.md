# Obsidian Git Sync

一个用于 Obsidian 的 Git 同步插件，支持将 Obsidian 笔记库同步到 Gitee 等远程 Git 仓库，实现多端同步。

## 功能特性

- ✅ **双向同步** - Pull + Push 自动同步
- ✅ **冲突处理** - 自动检测冲突，创建备份文件，支持三种解决方式
- ✅ **状态显示** - 状态栏实时显示同步状态
- ✅ **快捷操作** - Ribbon 图标一键同步，支持右键菜单
- ✅ **自动同步** - 支持定时同步、启动同步、保存触发同步
- ✅ **.gitignore 支持** - 自动读取仓库中的 .gitignore 规则
- ✅ **Token 认证** - 支持 HTTPS + Token 认证方式

## 系统要求

- Obsidian v0.15.0 或更高版本
- Gitee/GitHub 账户和远程仓库

## 安装方法

### 方式一：手动安装（推荐）

1. 从 [Releases](../../releases) 页面下载最新版本的 `obsidian-git-sync-x.x.x.zip`
2. 解压下载的压缩包
3. 将解压得到的 `obsidian-git-sync` 文件夹复制到 Obsidian 插件目录：

| 平台 | 插件目录路径 |
|------|--------------|
| **Windows** | `%APPDATA%\Obsidian\plugins\` |
| **macOS** | `~/Library/Application Support/obsidian/plugins/` |
| **Linux** | `~/.config/obsidian/plugins/` |
| **Android** | `/storage/emulated/0/Android/data/md.obsidian/files/plugins/` |
| **iOS** | `iCloud Drive/Obsidian/plugins/` |

4. 重启 Obsidian
5. 进入 **设置 → 第三方插件**，找到 "Git Sync" 并启用

### 方式二：开发者模式

```bash
# 克隆仓库
git clone https://github.com/your-username/obsidian-git-sync.git
cd obsidian-git-sync

# 安装依赖并构建
npm install
npm run build

# 复制到 Obsidian 插件目录
cp -r release/obsidian-git-sync /path/to/your/vault/.obsidian/plugins/
```

## 快速开始

### 1. 获取 Gitee 访问令牌

1. 登录 [Gitee](https://gitee.com)
2. 进入 **设置 → 私人令牌**
3. 点击 **生成新令牌**
4. 勾选 `projects` 权限
5. 复制生成的令牌

### 2. 创建远程仓库

在 Gitee 上创建一个新的公开或私有仓库，例如：
```
https://gitee.com/your-username/your-vault.git
```

### 3. 配置插件

1. 打开 Obsidian 设置 → Git Sync
2. 在 **仓库地址** 中输入 Gitee 仓库 URL
3. 在 **访问令牌** 中粘贴刚才复制的令牌
4. 点击左侧 Ribbon 图标 🔄 开始同步

## 使用说明

### 同步操作

| 操作 | 方式 |
|------|------|
| 手动同步 | 点击左侧 Ribbon 图标 🔄 |
| 命令同步 | `Ctrl/Cmd + P` → 输入 `Git Sync: Sync with remote` |
| 右键菜单 | 右键点击 Ribbon 图标，选择操作 |

### 冲突处理

当本地和远程同时修改同一文件时，插件会：

1. 自动检测冲突
2. 创建远程版本的备份文件（格式：`filename-remote-timestamp.md`）
3. 弹出冲突解决窗口，提供三种选择：
   - **保留本地版本** - 使用您的修改
   - **保留远程版本** - 使用他人的修改
   - **我已手动合并** - 您已手动处理差异

### 自动同步配置

在设置中可以配置：

| 选项 | 说明 |
|------|------|
| 启用自动同步 | 定期自动同步 |
| 同步间隔 | 5分钟 / 10分钟 / 30分钟 / 1小时 |
| 仅在 WiFi 下同步 | 移动端仅在使用 WiFi 时同步 |
| 启动时自动同步 | Obsidian 启动后自动同步 |
| 文件保存时触发 | 保存文件后自动同步 |

### 排除规则

插件会自动读取仓库根目录的 `.gitignore` 文件。如果不存在，使用默认规则：

```gitignore
# Obsidian
.obsidian/
.trash/

# System
.DS_Store
Thumbs.db
*.tmp

# Git
.git/

# Plugin config (sensitive)
.obsidian/plugins/*/data.json
```

## 项目结构

```
obsidian-git-sync/
├── src/
│   ├── index.ts              # 插件入口
│   ├── types.ts              # 类型定义
│   ├── manifest.json         # 插件元数据
│   ├── styles.css            # 样式文件
│   ├── auth/                 # 认证模块
│   │   ├── auth-provider.ts  # 认证接口
│   │   └── token-provider.ts # Token 认证实现
│   ├── git/                  # Git 操作模块
│   │   ├── git-service.ts    # Git 服务接口
│   │   └── isomorphic-git.ts # Isomorphic Git 实现
│   ├── sync/                 # 同步模块
│   │   ├── sync-manager.ts   # 同步管理器
│   │   ├── conflict-handler.ts # 冲突处理
│   │   └── ignore-rules.ts   # 忽略规则
│   ├── ui/                   # UI 组件
│   │   ├── status-bar.ts     # 状态栏
│   │   ├── ribbon-icon.ts    # Ribbon 图标
│   │   ├── conflict-modal.ts # 冲突弹窗
│   │   └── settings-tab.ts   # 设置面板
│   └── utils/                # 工具函数
│       ├── logger.ts         # 日志工具
│       └── file-utils.ts     # 文件工具
├── scripts/                  # 构建脚本
├── dist/                     # 构建输出
├── release/                  # 发布包
├── package.json              # 项目配置
└── tsconfig.json             # TypeScript 配置
```

## 开发

### 环境要求

- Node.js v16+
- npm v8+

### 开发命令

```bash
# 安装依赖
npm install

# 开发模式（监听文件变化）
npm run dev

# 生产构建
npm run build

# 部署到 Obsidian（构建 + 复制到插件目录）
npm run deploy

# 打包发布
npm run package

# 完整发布流程（构建 + 打包）
npm run release

# 运行测试
npm test
```

### 目录结构

```
obsidian-git-sync/
├── src/           # 源代码
├── dist/          # 构建输出（.gitignore）
├── release/       # 发布包（.gitignore）
├── scripts/       # 构建和部署脚本
└── ...
```

### 打包发布

```bash
# 方式一：使用打包脚本（推荐）
npm run package

# 方式二：完整流程（构建 + 打包）
npm run release
```

打包完成后，在 `release/` 目录下会生成 `obsidian-git-sync-x.x.x.zip` 文件，可直接上传到 GitHub/Gitee Releases。

## 常见问题

### Q: 同步失败，提示 "无法连接到远程仓库"

**A:** 检查以下项：
1. 网络连接是否正常
2. 仓库地址是否正确
3. 访问令牌是否有效

### Q: 首次同步很慢

**A:** 首次同步需要初始化 Git 仓库并上传所有文件，根据文件数量和大小可能需要较长时间。

### Q: 冲突备份文件可以删除吗？

**A:** 可以。冲突解决后，备份文件会自动删除。如果手动删除，请确保已处理完冲突。

### Q: 支持私有仓库吗？

**A:** 支持。只要有正确的访问令牌，可以同步私有仓库。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

---

**作者**: User  
**版本**: 1.0.0  
**Obsidian 最低版本**: 0.15.0