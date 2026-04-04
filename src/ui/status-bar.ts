import { App } from 'obsidian';
import { SyncStatus } from '../types';

export class StatusBar {
  private element: HTMLElement;
  private status: SyncStatus = 'idle';
  private stats = { pushed: 0, pulled: 0 };
  private lastSync: Date | null = null;

  constructor(private app: App, container: HTMLElement) {
    this.element = container.createDiv({ cls: 'git-sync-status' });
    this.render();
  }

  /**
   * 设置状态
   */
  setStatus(status: SyncStatus, message?: string): void {
    this.status = status;
    this.render(message);
  }

  /**
   * 设置统计信息
   */
  setStats(pushed: number, pulled: number): void {
    this.stats = { pushed, pulled };
    this.lastSync = new Date();
    this.render();
  }

  /**
   * 渲染状态栏
   */
  private render(message?: string): void {
    this.element.empty();
    this.element.className = 'git-sync-status';

    const icon = this.element.createSpan();
    const text = this.element.createSpan();

    switch (this.status) {
      case 'idle':
        icon.setText('🔄');
        text.setText(`Git Sync: ${this.formatLastSync()}`);
        this.element.addClass('idle');
        break;

      case 'syncing':
        icon.setText('🔄');
        icon.addClass('git-sync-icon syncing');
        text.setText(`Git Sync: ${message || '同步中...'}`);
        this.element.addClass('syncing');
        break;

      case 'success':
        icon.setText('✅');
        text.setText(`Git Sync: 已同步 | ↑${this.stats.pushed} ↓${this.stats.pulled}`);
        this.element.addClass('success');
        break;

      case 'conflict':
        icon.setText('⚠️');
        text.setText('Git Sync: 有冲突待解决');
        this.element.addClass('conflict');
        break;

      case 'error':
        icon.setText('❌');
        text.setText(`Git Sync: ${message || '同步失败'}`);
        this.element.addClass('error');
        break;
    }

    // 点击触发同步
    this.element.onClickEvent(() => {
      // @ts-ignore
      this.app.commands?.executeCommandById?.('obsidian-git-sync:sync');
    });
  }

  /**
   * 格式化最后同步时间
   */
  private formatLastSync(): string {
    if (!this.lastSync) {
      return '未同步';
    }

    const now = new Date();
    const diff = now.getTime() - this.lastSync.getTime();

    if (diff < 60000) {
      return '刚刚同步';
    } else if (diff < 3600000) {
      return `${Math.floor(diff / 60000)} 分钟前`;
    } else {
      return `${this.lastSync.getHours().toString().padStart(2, '0')}:${this.lastSync.getMinutes().toString().padStart(2, '0')}`;
    }
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.element.remove();
  }
}