import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import GitSyncPlugin from '../index';
import { logger } from '../utils/logger';

export class GitSyncSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: GitSyncPlugin
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // 标题
    containerEl.createEl('h2', { text: 'Git Sync 设置' });

    // === 远程仓库配置 ===
    containerEl.createEl('h3', { text: '📡 远程仓库配置' });

    new Setting(containerEl)
      .setName('仓库地址')
      .setDesc('支持 HTTPS 和 SSH 格式')
      .addText(text => text
        .setPlaceholder('https://gitee.com/user/vault.git')
        .setValue(this.plugin.settings.remoteUrl)
        .onChange(async (value) => {
          this.plugin.settings.remoteUrl = value;
          await this.plugin.saveSettings();
        }));

    // === 认证方式 ===
    containerEl.createEl('h3', { text: '🔐 认证方式' });

    new Setting(containerEl)
      .setName('认证类型')
      .setDesc('选择认证方式')
      .addDropdown(dropdown => dropdown
        .addOption('token', '访问令牌 (HTTPS)')
        .addOption('ssh', 'SSH 密钥')
        .setValue(this.plugin.settings.authType)
        .onChange(async (value: 'token' | 'ssh') => {
          this.plugin.settings.authType = value;
          await this.plugin.saveSettings();
          this.display(); // 刷新界面
        }));

    if (this.plugin.settings.authType === 'token') {
      new Setting(containerEl)
        .setName('访问令牌')
        .setDesc('Gitee 个人访问令牌 (在设置 → 私人令牌 中生成)')
        .addText(text => {
          text.setPlaceholder('输入令牌')
            .setValue(this.plugin.settings.token)
            .onChange(async (value) => {
              this.plugin.settings.token = value;
              await this.plugin.saveSettings();
            });
          text.inputEl.type = 'password';
          text.inputEl.style.width = '300px';
        });
    } else {
      // SSH 配置
      new Setting(containerEl)
        .setName('SSH 私钥')
        .setDesc('粘贴或导入您的 SSH 私钥')
        .addTextArea(text => {
          text.setPlaceholder('-----BEGIN OPENSSH PRIVATE KEY-----...')
            .setValue(this.plugin.settings.sshPrivateKey)
            .onChange(async (value) => {
              this.plugin.settings.sshPrivateKey = value;
              await this.plugin.saveSettings();
            });
          text.inputEl.rows = 6;
          text.inputEl.style.width = '100%';
          text.inputEl.style.fontFamily = 'monospace';
        });

      new Setting(containerEl)
        .setName('SSH 公钥')
        .setDesc('将此公钥添加到 Gitee 的 SSH 公钥设置中')
        .addTextArea(text => {
          text.setValue(this.plugin.settings.sshPublicKey)
            .setDisabled(true);
          text.inputEl.rows = 3;
          text.inputEl.style.width = '100%';
          text.inputEl.style.fontFamily = 'monospace';
        })
        .addButton(btn => btn
          .setButtonText('生成新密钥')
          .onClick(async () => {
            new Notice('SSH 密钥生成功能将在后续版本中实现');
          }));

      new Setting(containerEl)
        .setName('从文件导入')
        .setDesc('导入现有的 SSH 私钥文件')
        .addButton(btn => btn
          .setButtonText('选择文件')
          .onClick(() => {
            // 文件选择需要额外实现
            new Notice('请手动复制私钥内容');
          }));
    }

    // === 自动同步 ===
    containerEl.createEl('h3', { text: '⏰ 自动同步' });

    new Setting(containerEl)
      .setName('启用自动同步')
      .setDesc('定期自动同步到远程仓库')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoSync.enabled)
        .onChange(async (value) => {
          this.plugin.settings.autoSync.enabled = value;
          await this.plugin.saveSettings();
          this.display();
        }));

    if (this.plugin.settings.autoSync.enabled) {
      new Setting(containerEl)
        .setName('同步间隔')
        .setDesc('自动同步的时间间隔')
        .addDropdown(dropdown => dropdown
          .addOption('5', '每 5 分钟')
          .addOption('10', '每 10 分钟')
          .addOption('30', '每 30 分钟')
          .addOption('60', '每小时')
          .setValue(String(this.plugin.settings.autoSync.interval))
          .onChange(async (value) => {
            this.plugin.settings.autoSync.interval = parseInt(value);
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('仅在 WiFi 下自动同步')
        .setDesc('移动端仅在使用 WiFi 时自动同步')
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.autoSync.wifiOnly)
          .onChange(async (value) => {
            this.plugin.settings.autoSync.wifiOnly = value;
            await this.plugin.saveSettings();
          }));
    }

    new Setting(containerEl)
      .setName('启动时自动同步')
      .setDesc('Obsidian 启动时自动执行同步')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoSync.onStartup)
        .onChange(async (value) => {
          this.plugin.settings.autoSync.onStartup = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('文件保存时触发同步')
      .setDesc('保存文件后自动触发同步')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoSync.onFileSave)
        .onChange(async (value) => {
          this.plugin.settings.autoSync.onFileSave = value;
          await this.plugin.saveSettings();
        }));

    // === 排除规则 ===
    containerEl.createEl('h3', { text: '📝 排除规则' });

    const gitignoreExists = this.app.vault.getAbstractFileByPath('.gitignore') !== null;

    new Setting(containerEl)
      .setName('使用 .gitignore 文件')
      .setDesc(gitignoreExists
        ? '已检测到仓库中的 .gitignore 文件'
        : '未检测到 .gitignore 文件，将使用默认规则')
      .addButton(btn => {
        if (gitignoreExists) {
          btn.setButtonText('打开 .gitignore');
        } else {
          btn.setButtonText('创建默认 .gitignore');
        }
        btn.onClick(async () => {
          // 打开或创建文件
          const file = this.app.vault.getAbstractFileByPath('.gitignore');
          if (file) {
            // 在编辑器中打开
            const leaf = this.app.workspace.getLeaf();
            await leaf.openFile(file as any);
          } else {
            // 创建默认文件
            const defaultContent = `# Obsidian
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
`;
            await this.app.vault.create('.gitignore', defaultContent);
            new Notice('已创建 .gitignore 文件');
            this.display();
          }
        });
      });

    // === 状态信息 ===
    containerEl.createEl('h3', { text: '📊 状态信息' });

    const lastSync = this.plugin.settings.lastSync;
    const lastSyncText = lastSync
      ? new Date(lastSync).toLocaleString()
      : '从未同步';

    new Setting(containerEl)
      .setName('最后同步时间')
      .setDesc(lastSyncText);

    if (this.plugin.settings.lastSyncStats) {
      new Setting(containerEl)
        .setName('最后同步统计')
        .setDesc(`↑ ${this.plugin.settings.lastSyncStats.pushed} 文件 | ↓ ${this.plugin.settings.lastSyncStats.pulled} 文件`);
    }

    // === 危险操作 ===
    containerEl.createEl('h3', { text: '⚠️ 危险操作' });

    new Setting(containerEl)
      .setName('重置设置')
      .setDesc('清除所有配置信息')
      .addButton(btn => btn
        .setButtonText('重置')
        .setWarning()
        .onClick(async () => {
          if (confirm('确定要重置所有设置吗？此操作不可撤销。')) {
            // 保留远程 URL，清除敏感信息
            this.plugin.settings.token = '';
            this.plugin.settings.sshPrivateKey = '';
            this.plugin.settings.sshPublicKey = '';
            await this.plugin.saveSettings();
            new Notice('设置已重置');
            this.display();
          }
        }));
  }
}