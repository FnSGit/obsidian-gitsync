import { App, Modal, Setting, TextAreaComponent } from 'obsidian';
import { ConflictInfo } from '../types';
import { ConflictHandler } from '../sync/conflict-handler';

export class ConflictModal extends Modal {
  private conflicts: ConflictInfo[];
  private currentIndex = 0;
  private onResolved: () => void;

  constructor(
    app: App,
    private conflictHandler: ConflictHandler,
    onResolved: () => void
  ) {
    super(app);
    this.conflicts = conflictHandler.getPendingConflicts();
    this.onResolved = onResolved;
  }

  onOpen() {
    this.display();
  }

  onClose() {
    this.contentEl.empty();
  }

  private display() {
    this.contentEl.empty();

    if (this.conflicts.length === 0) {
      this.contentEl.createEl('h2', { text: '没有待解决的冲突' });
      return;
    }

    const conflict = this.conflicts[this.currentIndex];

    // 标题
    this.contentEl.createEl('h2', {
      text: `解决冲突 (${this.currentIndex + 1}/${this.conflicts.length})`
    });

    // 警告提示
    this.contentEl.createDiv({ cls: 'mod-warning' }, (div) => {
      div.setText('检测到同步冲突，您需要选择保留哪个版本才能继续同步。');
    });

    // 文件名
    this.contentEl.createDiv({ cls: 'git-sync-conflict-modal' }, (container) => {
      container.createDiv({ cls: 'file-name' }, (div) => {
        div.createEl('strong', { text: '文件: ' });
        div.createEl('span', { text: conflict.file });
      });

      // 对比视图
      container.createDiv({ cls: 'diff-container' }, (diffContainer) => {
        // 本地版本
        diffContainer.createDiv({ cls: 'diff-panel' }, (panel) => {
          panel.createDiv({ cls: 'diff-header', text: '本地版本 (您修改的)' });
          panel.createDiv({ cls: 'diff-content' }, async (content) => {
            const file = this.app.vault.getAbstractFileByPath(conflict.file);
            if (file) {
              const localContent = await this.app.vault.read(file as any);
              content.createEl('pre', { text: localContent.substring(0, 1000) });
              if (localContent.length > 1000) {
                content.createEl('em', { text: '... (内容过长，已截断)' });
              }
            }
          });
        });

        // 远程版本
        diffContainer.createDiv({ cls: 'diff-panel' }, (panel) => {
          panel.createDiv({ cls: 'diff-header', text: '远程版本 (他人修改的)' });
          panel.createDiv({ cls: 'diff-content' }, async (content) => {
            const backupFile = this.app.vault.getAbstractFileByPath(conflict.backupFile);
            if (backupFile) {
              const remoteContent = await this.app.vault.read(backupFile as any);
              content.createEl('pre', { text: remoteContent.substring(0, 1000) });
              if (remoteContent.length > 1000) {
                content.createEl('em', { text: '... (内容过长，已截断)' });
              }
            }
          });
        });
      });

      // 操作按钮
      container.createDiv({ cls: 'actions' }, (actions) => {
        new Setting(actions)
          .addButton(btn => btn
            .setButtonText('保留本地版本')
            .onClick(async () => {
              await this.conflictHandler.resolveKeepLocal(conflict.id);
              this.nextConflict();
            }))
          .addButton(btn => btn
            .setButtonText('保留远程版本')
            .setWarning()
            .onClick(async () => {
              await this.conflictHandler.resolveKeepRemote(conflict.id);
              this.nextConflict();
            }))
          .addButton(btn => btn
            .setButtonText('我已手动合并')
            .setCta()
            .onClick(async () => {
              await this.conflictHandler.resolveMerged(conflict.id);
              this.nextConflict();
            }));
      });
    });

    // 时间信息
    this.contentEl.createDiv({ cls: 'setting-item-description' }, (div) => {
      div.createEl('div', {
        text: `本地修改时间: ${new Date(conflict.localModified).toLocaleString()}`
      });
      div.createEl('div', {
        text: `远程修改时间: ${new Date(conflict.remoteModified).toLocaleString()}`
      });
    });
  }

  private async nextConflict() {
    this.currentIndex++;

    if (this.currentIndex >= this.conflicts.length) {
      this.close();
      this.onResolved();
    } else {
      this.display();
    }
  }
}