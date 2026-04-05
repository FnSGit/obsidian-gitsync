import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import { App, TFile, TFolder, normalizePath } from 'obsidian';
import { GitService } from './git-service';
import { FileChange, FileStatus } from '../types';
import { logger } from '../utils/logger';

/**
 * 简单的路径处理函数（替代 Node.js path 模块）
 */
function getRelativePath(basePath: string, fullPath: string): string {
  if (!basePath) return fullPath;
  const normalizedBase = basePath.replace(/\\/g, '/');
  const normalizedFull = fullPath.replace(/\\/g, '/');
  if (normalizedFull.startsWith(normalizedBase)) {
    let relative = normalizedFull.slice(normalizedBase.length);
    if (relative.startsWith('/')) {
      relative = relative.slice(1);
    }
    return relative;
  }
  return fullPath;
}

/**
 * Isomorphic Git 实现
 * 纯 JavaScript Git 实现，用于移动端或无系统 Git 的环境
 */
export class IsomorphicGitService implements GitService {
  private dir: string;
  private fs: FileSystemAdapter;
  private token: string | null = null;

  constructor(private app: App) {
    this.dir = this.getVaultPath();
    this.fs = this.createFileSystemAdapter();
  }

  private getVaultPath(): string {
    const adapter = this.app.vault.adapter as unknown as { basePath?: string };
    return adapter.basePath || '';
  }

  private createFileSystemAdapter(): FileSystemAdapter {
    const app = this.app;
    const dir = this.dir;

    return {
      promises: {
        readFile: async (filePath: string) => {
          const relativePath = getRelativePath(dir, filePath);
          const normalized = normalizePath(relativePath);
          const file = app.vault.getAbstractFileByPath(normalized);

          if (file instanceof TFile) {
            const content = await app.vault.readBinary(file);
            return Buffer.from(content);
          }

          throw new Error(`File not found: ${filePath}`);
        },

        writeFile: async (filePath: string, data: Buffer | string) => {
          const relativePath = getRelativePath(dir, filePath);
          const normalized = normalizePath(relativePath);

          const content = typeof data === 'string' ? data : data.toString('utf-8');
          const file = app.vault.getAbstractFileByPath(normalized);

          if (file instanceof TFile) {
            await app.vault.modify(file, content);
          } else {
            await app.vault.create(normalized, content);
          }
        },

        mkdir: async (dirPath: string) => {
          const relativePath = getRelativePath(dir, dirPath);
          const normalized = normalizePath(relativePath);
          const folder = app.vault.getAbstractFileByPath(normalized);

          if (!folder) {
            await app.vault.createFolder(normalized);
          }
        },

        readdir: async (dirPath: string) => {
          const relativePath = getRelativePath(dir, dirPath);
          const normalized = normalizePath(relativePath || '/');
          const folder = app.vault.getAbstractFileByPath(normalized);

          if (folder instanceof TFolder) {
            return folder.children.map(c => c.name);
          }

          return [];
        },

        stat: async (filePath: string) => {
          const relativePath = getRelativePath(dir, filePath);
          const normalized = normalizePath(relativePath);
          const file = app.vault.getAbstractFileByPath(normalized);

          if (file) {
            return {
              isFile: () => file instanceof TFile,
              isDirectory: () => file instanceof TFolder,
            };
          }

          throw new Error(`Not found: ${filePath}`);
        },

        lstat: async (filePath: string) => {
          const relativePath = getRelativePath(dir, filePath);
          const normalized = normalizePath(relativePath);
          const file = app.vault.getAbstractFileByPath(normalized);

          if (file) {
            return {
              isFile: () => file instanceof TFile,
              isDirectory: () => file instanceof TFolder,
            };
          }

          throw new Error(`Not found: ${filePath}`);
        },

        unlink: async (filePath: string) => {
          const relativePath = getRelativePath(dir, filePath);
          const normalized = normalizePath(relativePath);
          const file = app.vault.getAbstractFileByPath(normalized);

          if (file instanceof TFile) {
            await app.vault.delete(file);
          }
        },

        rmdir: async (dirPath: string) => {
          const relativePath = getRelativePath(dir, dirPath);
          const normalized = normalizePath(relativePath);
          const folder = app.vault.getAbstractFileByPath(normalized);

          if (folder instanceof TFolder) {
            await app.vault.delete(folder, true);
          }
        },
      },
    } as FileSystemAdapter;
  }

  /**
   * 设置认证 Token
   */
  setToken(token: string): void {
    this.token = token;
  }

  private getAuth(): { username: string; password: string } | undefined {
    if (this.token) {
      return { username: 'oauth2', password: this.token };
    }
    return undefined;
  }

  async isRepoInitialized(): Promise<boolean> {
    try {
      await git.resolveRef({ fs: this.fs, dir: this.dir, ref: 'HEAD' });
      return true;
    } catch {
      return false;
    }
  }

  async initRepo(): Promise<void> {
    logger.info('Initializing git repository...');
    await git.init({ fs: this.fs, dir: this.dir });
  }

  async clone(url: string, _dir: string): Promise<void> {
    logger.info(`Cloning repository: ${url}`);
    await git.clone({
      fs: this.fs,
      http,
      dir: this.dir,
      url,
      singleBranch: true,
      depth: 1,
      onAuth: () => this.getAuth(),
    });
  }

  async getRemoteUrl(): Promise<string | null> {
    try {
      const remotes = await git.listRemotes({ fs: this.fs, dir: this.dir });
      const origin = remotes.find(r => r.remote === 'origin');
      return origin?.url || null;
    } catch {
      return null;
    }
  }

  async setRemoteUrl(url: string): Promise<void> {
    await git.addRemote({
      fs: this.fs,
      dir: this.dir,
      remote: 'origin',
      url,
      force: true,
    });
  }

  async getCurrentBranch(): Promise<string> {
    return await git.currentBranch({
      fs: this.fs,
      dir: this.dir,
      fullname: false,
    }) || 'main';
  }

  async getStatus(): Promise<FileChange[]> {
    const status = await git.statusMatrix({
      fs: this.fs,
      dir: this.dir,
    });

    const changes: FileChange[] = [];

    for (const [filepath, head, workdir, stage] of status) {
      // 跳过 .obsidian 目录
      if (filepath.startsWith('.obsidian/')) continue;

      let fileStatus: FileStatus;

      // 使用数字比较，因为 isomorphic-git 的状态码是数字
      const headStatus = head as number;
      const workdirStatus = workdir as number;
      const stageStatus = stage as number;

      if (headStatus === 0 && workdirStatus === 2 && stageStatus === 2) {
        fileStatus = 'added';
      } else if (headStatus === 1 && workdirStatus === 0 && stageStatus === 0) {
        fileStatus = 'deleted';
      } else if (headStatus === 1 && workdirStatus === 2 && stageStatus === 2) {
        fileStatus = 'modified';
      } else if (headStatus === 1 && workdirStatus === 3 && stageStatus === 3) {
        fileStatus = 'conflicted';
      } else {
        continue;
      }

      changes.push({ path: filepath, status: fileStatus });
    }

    return changes;
  }

  async getUncommittedCount(): Promise<{ staged: number; unstaged: number }> {
    const changes = await this.getStatus();
    return {
      staged: changes.filter(c => c.status !== 'conflicted').length,
      unstaged: changes.filter(c => c.status === 'modified' || c.status === 'added').length,
    };
  }

  async add(files?: string[]): Promise<void> {
    await git.add({
      fs: this.fs,
      dir: this.dir,
      filepath: files ? files[0] : '.',
    });
  }

  async commit(message: string): Promise<void> {
    const sha = await git.commit({
      fs: this.fs,
      dir: this.dir,
      message,
      author: {
        name: 'Obsidian Git Sync',
        email: 'git-sync@obsidian.local',
      },
    });
    logger.info(`Committed: ${sha}`);
  }

  async pull(): Promise<{ hasConflicts: boolean; conflictFiles: string[] }> {
    logger.info('Pulling from remote...');

    try {
      const result = await git.pull({
        fs: this.fs,
        http,
        dir: this.dir,
        singleBranch: true,
        onAuth: () => this.getAuth(),
      });

      // 检查是否有冲突
      const status = await this.getStatus();
      const conflictFiles = status
        .filter(c => c.status === 'conflicted')
        .map(c => c.path);

      return {
        hasConflicts: conflictFiles.length > 0,
        conflictFiles,
      };
    } catch (error) {
      logger.error('Pull failed:', error);
      throw error;
    }
  }

  async push(): Promise<void> {
    logger.info('Pushing to remote...');

    try {
      await git.push({
        fs: this.fs,
        http,
        dir: this.dir,
        onAuth: () => this.getAuth(),
      });
    } catch (error) {
      logger.error('Push failed:', error);
      throw error;
    }
  }

  async getFileContent(path: string, ref?: string): Promise<string> {
    const content = await git.readBlob({
      fs: this.fs,
      dir: this.dir,
      oid: ref || 'HEAD',
      filepath: path,
    });

    return Buffer.from(content.blob).toString('utf-8');
  }

  async checkConnection(): Promise<boolean> {
    try {
      // 尝试获取远程信息
      await git.getRemoteInfo({
        http,
        url: await this.getRemoteUrl() || '',
        onAuth: () => this.getAuth(),
      });
      return true;
    } catch {
      return false;
    }
  }

  dispose(): void {
    // 清理资源
  }
}

interface FileSystemAdapter {
  promises: {
    readFile(path: string): Promise<Buffer>;
    writeFile(path: string, data: Buffer | string): Promise<void>;
    mkdir(path: string): Promise<void>;
    readdir(path: string): Promise<string[]>;
    stat(path: string): Promise<{ isFile(): boolean; isDirectory(): boolean }>;
    lstat(path: string): Promise<{ isFile(): boolean; isDirectory(): boolean }>;
    unlink(path: string): Promise<void>;
    rmdir(path: string): Promise<void>;
  };
}