import { exec } from 'child_process';
import { promisify } from 'util';
import { App } from 'obsidian';
import { GitService } from './git-service';
import { FileChange, FileStatus } from '../types';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

/**
 * 原生 Git 服务（使用系统 Git）
 * 支持完整的 SSH 认证，适用于桌面端
 */
export class NativeGitService implements GitService {
  private repoPath: string;

  constructor(private app: App) {
    this.repoPath = this.getVaultPath();
  }

  private getVaultPath(): string {
    const adapter = this.app.vault.adapter as unknown as { basePath?: string };
    return adapter.basePath || '';
  }

  private async execGit(args: string): Promise<string> {
    const { stdout, stderr } = await execAsync(`git ${args}`, {
      cwd: this.repoPath,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
    });
    if (stderr && !stderr.includes('warning:')) {
      logger.warn('Git stderr:', stderr);
    }
    return stdout.trim();
  }

  async isRepoInitialized(): Promise<boolean> {
    try {
      await this.execGit('rev-parse --git-dir');
      return true;
    } catch {
      return false;
    }
  }

  async initRepo(): Promise<void> {
    logger.info('Initializing git repository...');
    await this.execGit('init');
  }

  async clone(url: string, _dir: string): Promise<void> {
    logger.info(`Cloning repository: ${url}`);
    await this.execGit(`clone "${url}" .`);
  }

  async getRemoteUrl(): Promise<string | null> {
    try {
      return await this.execGit('remote get-url origin');
    } catch {
      return null;
    }
  }

  async setRemoteUrl(url: string): Promise<void> {
    try {
      await this.execGit(`remote set-url origin "${url}"`);
    } catch {
      await this.execGit(`remote add origin "${url}"`);
    }
  }

  async getCurrentBranch(): Promise<string> {
    try {
      return await this.execGit('rev-parse --abbrev-ref HEAD');
    } catch {
      return 'main';
    }
  }

  async getStatus(): Promise<FileChange[]> {
    const output = await this.execGit('status --porcelain');
    const lines = output.split('\n').filter(Boolean);

    const changes: FileChange[] = [];
    for (const line of lines) {
      const status = line.substring(0, 2).trim();
      const filepath = line.substring(3);

      // 跳过 .obsidian 目录
      if (filepath.startsWith('.obsidian/')) continue;

      let fileStatus: FileStatus;
      switch (status) {
        case 'A':
        case '??':
          fileStatus = 'added';
          break;
        case 'M':
        case 'MM':
        case 'AM':
          fileStatus = 'modified';
          break;
        case 'D':
          fileStatus = 'deleted';
          break;
        case 'R':
          fileStatus = 'renamed';
          break;
        case 'UU':
        case 'AA':
        case 'DD':
          fileStatus = 'conflicted';
          break;
        default:
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
    const fileArg = files ? files.map(f => `"${f}"`).join(' ') : '.';
    await this.execGit(`add ${fileArg}`);
  }

  async commit(message: string): Promise<void> {
    const sha = await this.execGit(`commit -m "${message}" --author="Obsidian Git Sync <git-sync@obsidian.local>"`);
    logger.info(`Committed: ${sha}`);
  }

  async pull(): Promise<{ hasConflicts: boolean; conflictFiles: string[] }> {
    logger.info('Pulling from remote...');

    try {
      await this.execGit('pull --rebase origin HEAD');
      return { hasConflicts: false, conflictFiles: [] };
    } catch (error) {
      // 检查是否有冲突
      const status = await this.getStatus();
      const conflictFiles = status
        .filter(c => c.status === 'conflicted')
        .map(c => c.path);

      if (conflictFiles.length > 0) {
        logger.warn(`Found ${conflictFiles.length} conflicts`);
        return { hasConflicts: true, conflictFiles };
      }

      throw error;
    }
  }

  async push(): Promise<void> {
    logger.info('Pushing to remote...');
    await this.execGit('push origin HEAD');
  }

  async getFileContent(path: string, ref?: string): Promise<string> {
    const refArg = ref || 'HEAD';
    return await this.execGit(`show "${refArg}:${path}"`);
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.execGit('ls-remote origin HEAD');
      return true;
    } catch {
      return false;
    }
  }

  dispose(): void {
    // 清理资源
  }
}