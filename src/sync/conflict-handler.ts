import { App, TFile, normalizePath } from 'obsidian';
import { ConflictInfo, ConflictQueue } from '../types';
import { logger } from '../utils/logger';

const CONFLICT_QUEUE_FILE = '.obsidian/plugins/obsidian-git-sync/conflict-queue.json';

/**
 * 冲突处理器
 */
export class ConflictHandler {
  private queue: ConflictQueue = { conflicts: [], lastSync: null };

  constructor(private app: App) {}

  /**
   * 加载冲突队列
   */
  async load(): Promise<void> {
    try {
      const content = await this.app.vault.adapter.read(CONFLICT_QUEUE_FILE);
      this.queue = JSON.parse(content);
    } catch {
      this.queue = { conflicts: [], lastSync: null };
    }
  }

  /**
   * 保存冲突队列
   */
  async save(): Promise<void> {
    const content = JSON.stringify(this.queue, null, 2);
    await this.app.vault.adapter.write(CONFLICT_QUEUE_FILE, content);
  }

  /**
   * 检测冲突并创建备份
   */
  async handleConflicts(conflictFiles: string[]): Promise<ConflictInfo[]> {
    const conflicts: ConflictInfo[] = [];

    for (const file of conflictFiles) {
      const info = await this.createConflictBackup(file);
      if (info) {
        conflicts.push(info);
        this.queue.conflicts.push(info);
      }
    }

    if (conflicts.length > 0) {
      await this.save();
    }

    return conflicts;
  }

  /**
   * 创建冲突备份文件
   */
  private async createConflictBackup(filePath: string): Promise<ConflictInfo | null> {
    try {
      const normalized = normalizePath(filePath);
      const file = this.app.vault.getAbstractFileByPath(normalized);

      if (!(file instanceof TFile)) {
        return null;
      }

      // 读取远程版本内容（从 Git）
      const remoteContent = await this.getRemoteContent(filePath);

      // 创建备份文件名
      const timestamp = Date.now();
      const ext = file.extension;
      const baseName = file.basename;
      const parent = file.parent?.path || '';
      const backupName = `${baseName}-remote-${timestamp}.${ext}`;
      const backupPath = parent ? `${parent}/${backupName}` : backupName;

      // 写入备份文件
      await this.app.vault.create(backupPath, remoteContent);

      const info: ConflictInfo = {
        id: `conflict-${timestamp}`,
        file: normalized,
        backupFile: backupPath,
        detectedAt: new Date().toISOString(),
        status: 'pending',
        localModified: new Date(file.stat.mtime).toISOString(),
        remoteModified: new Date().toISOString(),
      };

      logger.info(`Created conflict backup: ${backupPath}`);
      return info;
    } catch (error) {
      logger.error(`Failed to create conflict backup: ${filePath}`, error);
      return null;
    }
  }

  /**
   * 获取远程内容（需要 Git 服务注入）
   */
  private getRemoteContentFn?: (path: string) => Promise<string>;

  setRemoteContentGetter(fn: (path: string) => Promise<string>): void {
    this.getRemoteContentFn = fn;
  }

  private async getRemoteContent(path: string): Promise<string> {
    if (this.getRemoteContentFn) {
      return this.getRemoteContentFn(path);
    }
    return `# Remote content placeholder for ${path}`;
  }

  /**
   * 获取待解决的冲突
   */
  getPendingConflicts(): ConflictInfo[] {
    return this.queue.conflicts.filter(c => c.status === 'pending');
  }

  /**
   * 检查是否有待解决的冲突
   */
  hasPendingConflicts(): boolean {
    return this.getPendingConflicts().length > 0;
  }

  /**
   * 解决冲突 - 保留本地版本
   */
  async resolveKeepLocal(conflictId: string): Promise<void> {
    const conflict = this.queue.conflicts.find(c => c.id === conflictId);
    if (!conflict) return;

    await this.deleteBackupFile(conflict.backupFile);
    conflict.status = 'resolved';
    await this.save();
    logger.info(`Conflict resolved (keep local): ${conflict.file}`);
  }

  /**
   * 解决冲突 - 保留远程版本
   */
  async resolveKeepRemote(conflictId: string): Promise<void> {
    const conflict = this.queue.conflicts.find(c => c.id === conflictId);
    if (!conflict) return;

    const backupFile = this.app.vault.getAbstractFileByPath(conflict.backupFile);
    const localFile = this.app.vault.getAbstractFileByPath(conflict.file);

    if (backupFile instanceof TFile && localFile instanceof TFile) {
      const remoteContent = await this.app.vault.read(backupFile);
      await this.app.vault.modify(localFile, remoteContent);
    }

    await this.deleteBackupFile(conflict.backupFile);
    conflict.status = 'resolved';
    await this.save();
    logger.info(`Conflict resolved (keep remote): ${conflict.file}`);
  }

  /**
   * 解决冲突 - 手动合并后标记完成
   */
  async resolveMerged(conflictId: string): Promise<void> {
    const conflict = this.queue.conflicts.find(c => c.id === conflictId);
    if (!conflict) return;

    await this.deleteBackupFile(conflict.backupFile);
    conflict.status = 'resolved';
    await this.save();
    logger.info(`Conflict resolved (merged): ${conflict.file}`);
  }

  /**
   * 删除备份文件
   */
  private async deleteBackupFile(path: string): Promise<void> {
    try {
      const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
      if (file instanceof TFile) {
        await this.app.vault.delete(file);
      }
    } catch (error) {
      logger.warn(`Failed to delete backup: ${path}`);
    }
  }

  /**
   * 清理已解决的冲突记录
   */
  async cleanupResolved(): Promise<void> {
    const before = this.queue.conflicts.length;
    this.queue.conflicts = this.queue.conflicts.filter(c => c.status === 'pending');
    const after = this.queue.conflicts.length;

    if (before !== after) {
      await this.save();
      logger.info(`Cleaned up ${before - after} resolved conflicts`);
    }
  }
}