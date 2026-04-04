import { App, Menu } from 'obsidian';
import { SyncStatus } from '../types';

export type SyncCallback = () => Promise<void>;
export type ShowConflictsCallback = () => void;

export class RibbonIcon {
  private iconEl: HTMLElement;

  constructor(
    private app: App,
    private onSync: SyncCallback,
    private onShowConflicts: ShowConflictsCallback
  ) {
    this.iconEl = this.app.workspace.addRibbonIcon(
      'git-branch',
      'Git Sync',
      (evt) => this.handleClick(evt)
    );
  }

  /**
   * 处理点击事件
   */
  private async handleClick(evt: MouseEvent): Promise<void> {
    // 右键显示菜单
    if (evt.button === 2) {
      this.showMenu(evt);
      return;
    }

    // 左键触发同步
    await this.onSync();
  }

  /**
   * 显示右键菜单
   */
  private showMenu(evt: MouseEvent): void {
    const menu = new Menu();

    menu.addItem((item) =>
      item
        .setTitle('立即同步')
        .setIcon('sync')
        .onClick(async () => {
          await this.onSync();
        })
    );

    menu.addItem((item) =>
      item
        .setTitle('查看冲突')
        .setIcon('alert-triangle')
        .onClick(() => {
          this.onShowConflicts();
        })
    );

    menu.addSeparator();

    menu.addItem((item) =>
      item
        .setTitle('打开设置')
        .setIcon('settings')
        .onClick(() => {
          // @ts-ignore
          this.app.setting.open();
          // @ts-ignore
          this.app.setting.openTabById('obsidian-git-sync');
        })
    );

    menu.showAtMouseEvent(evt);
  }

  /**
   * 更新图标状态
   */
  setStatus(status: SyncStatus): void {
    this.iconEl.removeClass('git-sync-icon');
    this.iconEl.removeClass('syncing');
    this.iconEl.removeClass('success');
    this.iconEl.removeClass('error');
    this.iconEl.removeClass('conflict');

    this.iconEl.addClass('git-sync-icon');

    switch (status) {
      case 'syncing':
        this.iconEl.addClass('syncing');
        break;
      case 'success':
        this.iconEl.addClass('success');
        break;
      case 'error':
        this.iconEl.addClass('error');
        break;
      case 'conflict':
        this.iconEl.addClass('conflict');
        break;
    }
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.iconEl.remove();
  }
}