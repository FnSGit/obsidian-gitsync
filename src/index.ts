import { Plugin, Notice, TFile } from 'obsidian';
import { GitSyncSettings, DEFAULT_SETTINGS } from './types';
import { IsomorphicGitService } from './git/isomorphic-git';
import { TokenAuthProvider } from './auth/token-provider';
import { SyncManager } from './sync/sync-manager';
import { StatusBar } from './ui/status-bar';
import { RibbonIcon } from './ui/ribbon-icon';
import { ConflictModal } from './ui/conflict-modal';
import { GitSyncSettingTab } from './ui/settings-tab';
import { logger } from './utils/logger';

export default class GitSyncPlugin extends Plugin {
  settings: GitSyncSettings;
  gitService: IsomorphicGitService;
  authProvider: TokenAuthProvider;
  syncManager: SyncManager;
  statusBar: StatusBar;
  ribbonIcon: RibbonIcon;
  syncIntervalId: number | null = null;

  async onload() {
    try {
      await this.loadSettings();

      // 初始化服务
      this.gitService = new IsomorphicGitService(this.app);
      this.authProvider = new TokenAuthProvider(this.settings.token);
      this.syncManager = new SyncManager(this.app, this.gitService, this.settings);

      await this.syncManager.init();

      // 添加状态栏
      this.statusBar = new StatusBar(
        this.app,
        this.addStatusBarItem()
      );

      // 添加 Ribbon 图标
      const ribbonEl = this.addRibbonIcon('git-branch', 'Git Sync', () => this.handleSync());
      this.ribbonIcon = new RibbonIcon(
        this.app,
        ribbonEl,
        () => this.handleSync(),
        () => this.showConflicts()
      );

      // 注册命令
      this.addCommand({
        id: 'sync',
        name: 'Sync with remote',
        callback: async () => {
          await this.handleSync();
        },
      });

      this.addCommand({
        id: 'show-conflicts',
        name: 'Show pending conflicts',
        callback: () => {
          this.showConflicts();
        },
      });

      // 添加设置面板
      this.addSettingTab(new GitSyncSettingTab(this.app, this));

      // 设置文件保存监听
      if (this.settings.autoSync.onFileSave) {
        this.registerEvent(
          this.app.vault.on('modify', (file) => {
            if (file instanceof TFile) {
              this.scheduleAutoSync(5000); // 5秒后同步
            }
          })
        );
      }

      // 启动时自动同步
      if (this.settings.autoSync.onStartup) {
        setTimeout(() => {
          this.handleSync();
        }, 5000);
      }

      // 启动定时自动同步
      if (this.settings.autoSync.enabled) {
        this.startAutoSync();
      }

      logger.info('Git Sync plugin loaded');
      new Notice('Git Sync 插件已加载');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to load plugin:', error);
      new Notice(`Git Sync 加载失败: ${message}`);
    }
  }

  onunload() {
    this.stopAutoSync();
    this.statusBar?.destroy();
    this.ribbonIcon?.destroy();
    logger.info('Git Sync plugin unloaded');
  }

  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private async handleSync() {
    if (!this.settings.remoteUrl) {
      new Notice('请先配置远程仓库地址');
      return;
    }

    if (!this.settings.token) {
      new Notice('请先配置访问令牌');
      return;
    }

    // 设置认证
    this.gitService.setToken(this.settings.token);

    // 检查仓库
    if (!await this.gitService.isRepoInitialized()) {
      new Notice('正在初始化 Git 仓库...');
      await this.gitService.initRepo();
    }

    // 设置远程地址
    await this.gitService.setRemoteUrl(this.settings.remoteUrl);

    // 执行同步
    const result = await this.syncManager.sync((status, message) => {
      this.statusBar.setStatus(status, message);
      this.ribbonIcon.setStatus(status);
    });

    if (result.success) {
      this.settings.lastSync = new Date().toISOString();
      this.settings.lastSyncStats = {
        pushed: result.pushed,
        pulled: result.pulled,
        timestamp: this.settings.lastSync,
      };
      await this.saveSettings();

      new Notice(`同步成功 ↑${result.pushed} ↓${result.pulled}`);
    } else if (result.status === 'conflict') {
      new Notice(`发现 ${result.conflicts.length} 个冲突需要解决`);
      this.showConflicts();
    } else {
      new Notice(`同步失败: ${result.error}`);
    }
  }

  private showConflicts() {
    const handler = this.syncManager.getConflictHandler();
    const conflicts = handler.getPendingConflicts();

    if (conflicts.length === 0) {
      new Notice('没有待解决的冲突');
      return;
    }

    new ConflictModal(this.app, handler, () => {
      // 冲突解决后的回调
      this.statusBar.setStatus('idle');
      this.ribbonIcon.setStatus('idle');
      new Notice('冲突已解决，可以继续同步');
    }).open();
  }

  private startAutoSync() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
    }

    const intervalMs = this.settings.autoSync.interval * 60 * 1000;

    this.syncIntervalId = window.setInterval(() => {
      // TODO: 检查 WiFi 状态
      this.handleSync();
    }, intervalMs);
  }

  private stopAutoSync() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  private pendingSyncTimeout: number | null = null;

  private scheduleAutoSync(delayMs: number) {
    if (this.pendingSyncTimeout) {
      clearTimeout(this.pendingSyncTimeout);
    }

    this.pendingSyncTimeout = window.setTimeout(() => {
      this.handleSync();
      this.pendingSyncTimeout = null;
    }, delayMs);
  }
}