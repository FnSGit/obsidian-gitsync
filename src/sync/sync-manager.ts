import { App } from 'obsidian';
import { GitService } from '../git/git-service';
import { ConflictHandler } from './conflict-handler';
import { IgnoreRules } from './ignore-rules';
import { SyncResult, SyncStatus, GitSyncSettings } from '../types';

export type SyncProgressCallback = (status: SyncStatus, message: string) => void;

/**
 * 同步管理器
 * 负责协调 Git 操作和冲突处理
 */
export class SyncManager {
  private conflictHandler: ConflictHandler;
  private ignoreRules: IgnoreRules;
  private status: SyncStatus = 'idle';

  constructor(
    app: App,
    private gitService: GitService,
    _settings: GitSyncSettings
  ) {
    this.conflictHandler = new ConflictHandler(app);
    this.ignoreRules = new IgnoreRules(app);
  }

  /**
   * 初始化
   */
  async init(): Promise<void> {
    await this.conflictHandler.load();
    await this.ignoreRules.load();
  }

  /**
   * 获取当前状态
   */
  getStatus(): SyncStatus {
    return this.status;
  }

  /**
   * 检查是否可以同步
   */
  async canSync(): Promise<{ canProceed: boolean; reason?: string }> {
    // 检查是否有未解决的冲突
    if (this.conflictHandler.hasPendingConflicts()) {
      return { canProceed: false, reason: '您有未解决的冲突，请先处理' };
    }

    // 检查网络连接
    const connected = await this.gitService.checkConnection();
    if (!connected) {
      return { canProceed: false, reason: '无法连接到远程仓库' };
    }

    return { canProceed: true };
  }

  /**
   * 执行同步
   * 按设计文档流程：Pull → Push
   */
  async sync(onProgress?: SyncProgressCallback): Promise<SyncResult> {
    this.status = 'syncing';
    onProgress?.('syncing', '检查同步条件...');

    try {
      // 检查是否可以同步
      const { canProceed, reason } = await this.canSync();
      if (!canProceed) {
        this.status = 'conflict';
        return {
          success: false,
          status: 'conflict',
          pushed: 0,
          pulled: 0,
          conflicts: [],
          error: reason,
        };
      }

      // Step 1: Pull (git fetch + merge)
      // fetch + merge 允许本地有未暂存变更
      onProgress?.('syncing', '正在拉取远程更新...');
      const pullResult = await this.gitService.pull();

      if (pullResult.hasConflicts) {
        onProgress?.('conflict', '检测到冲突，正在处理...');

        // 处理冲突
        const conflicts = await this.conflictHandler.handleConflicts(
          pullResult.conflictFiles
        );

        this.status = 'conflict';
        return {
          success: false,
          status: 'conflict',
          pushed: 0,
          pulled: 0,
          conflicts,
          error: `发现 ${conflicts.length} 个冲突需要解决`,
        };
      }

      // Step 2: Push (检查本地变更 → add → commit → push)
      onProgress?.('syncing', '检查本地变更...');
      const changes = await this.gitService.getStatus();
      const filteredChanges = this.filterChanges(changes);

      let pushed = 0;
      if (filteredChanges.length > 0) {
        onProgress?.('syncing', `暂存 ${filteredChanges.length} 个文件...`);
        await this.gitService.add();

        onProgress?.('syncing', '提交本地变更...');
        await this.gitService.commit(`sync: ${new Date().toISOString()}`);

        onProgress?.('syncing', '推送到远程...');
        await this.gitService.push();
        pushed = filteredChanges.length;
      }

      this.status = 'success';
      onProgress?.('success', `同步完成 ↑${pushed} ↓${pullResult.conflictFiles.length}`);

      return {
        success: true,
        status: 'success',
        pushed,
        pulled: pullResult.conflictFiles.length,
        conflicts: [],
      };
    } catch (error) {
      this.status = 'error';
      const message = error instanceof Error ? error.message : String(error);

      onProgress?.('error', `同步失败: ${message}`);

      return {
        success: false,
        status: 'error',
        pushed: 0,
        pulled: 0,
        conflicts: [],
        error: message,
      };
    }
  }

  /**
   * 过滤变更（排除 .gitignore 中的文件）
   */
  private filterChanges(changes: { path: string; status: string }[]): { path: string; status: string }[] {
    return changes.filter(change => !this.ignoreRules.shouldIgnore(change.path));
  }

  /**
   * 获取冲突处理器
   */
  getConflictHandler(): ConflictHandler {
    return this.conflictHandler;
  }

  /**
   * 获取待同步数量
   */
  async getPendingCount(): Promise<{ staged: number; unstaged: number }> {
    return await this.gitService.getUncommittedCount();
  }
}