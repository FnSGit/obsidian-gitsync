import { App, Menu } from 'obsidian';
import { SyncStatus } from '../types';

export type SyncCallback = () => Promise<void>;
export type ShowConflictsCallback = () => void;

export class RibbonIcon {
  private iconEl: HTMLElement;

  constructor(
    private app: App,
    iconEl: HTMLElement,
    private onSync: SyncCallback,
    private onShowConflicts: ShowConflictsCallback
  ) {
    this.iconEl = iconEl;
    this.iconEl.addClass('git-sync-icon');
    this.iconEl.addEventListener('click', (evt) => this.handleClick(evt as MouseEvent));
    this.iconEl.addEventListener('contextmenu', (evt) => this.showMenu(evt as MouseEvent));
  }

  /**
   * 处理点击事件
   */
  private async handleClick(evt: MouseEvent): Promise<void> {
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