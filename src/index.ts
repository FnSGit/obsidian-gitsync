import { Plugin, Notice, PluginSettingTab, Setting } from 'obsidian';
import { GitSyncSettings, DEFAULT_SETTINGS } from './types';
import { IsomorphicGitService } from './git/isomorphic-git';
import { TokenAuthProvider } from './auth/token-provider';
import { logger } from './utils/logger';

export default class GitSyncPlugin extends Plugin {
  settings: GitSyncSettings;
  gitService: IsomorphicGitService;
  authProvider: TokenAuthProvider;

  async onload() {
    await this.loadSettings();

    // 初始化服务
    this.gitService = new IsomorphicGitService(this.app);
    this.authProvider = new TokenAuthProvider(this.settings.token);

    // 检查是否需要初始化仓库
    if (!await this.gitService.isRepoInitialized()) {
      logger.info('Git repository not initialized');
    }

    // 注册 Ribbon 图标
    this.addRibbonIcon('git-branch', 'Git Sync', async () => {
      await this.handleSync();
    });

    // 注册命令
    this.addCommand({
      id: 'sync',
      name: 'Sync with remote',
      callback: async () => {
        await this.handleSync();
      },
    });

    // 添加设置面板
    this.addSettingTab(new GitSyncSettingTab(this));

    logger.info('Git Sync plugin loaded');
  }

  onunload() {
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

    new Notice('开始同步...');

    // TODO: 实现完整的同步逻辑
    try {
      // 设置认证
      this.gitService.setToken(this.settings.token);

      // 检查仓库
      if (!await this.gitService.isRepoInitialized()) {
        await this.gitService.initRepo();
      }

      // 设置远程地址
      await this.gitService.setRemoteUrl(this.settings.remoteUrl);

      new Notice('Git 仓库初始化成功');
    } catch (error) {
      logger.error('Sync failed:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      new Notice(`同步失败: ${message}`);
    }
  }
}

/**
 * 设置面板（简化版，后续完善）
 */
class GitSyncSettingTab extends PluginSettingTab {
  constructor(private plugin: GitSyncPlugin) {
    super(plugin.app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Git Sync 设置' });

    // 远程仓库地址
    new Setting(containerEl)
      .setName('远程仓库地址')
      .setDesc('Gitee 仓库 URL (HTTPS)')
      .addText(text => text
        .setPlaceholder('https://gitee.com/user/vault.git')
        .setValue(this.plugin.settings.remoteUrl)
        .onChange(async (value) => {
          this.plugin.settings.remoteUrl = value;
          await this.plugin.saveSettings();
        }));

    // 访问令牌
    new Setting(containerEl)
      .setName('访问令牌')
      .setDesc('Gitee 个人访问令牌')
      .addText(text => {
        text.setPlaceholder('输入令牌')
          .setValue(this.plugin.settings.token)
          .onChange(async (value) => {
            this.plugin.settings.token = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.type = 'password';
      });
  }
}