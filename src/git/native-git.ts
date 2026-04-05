import { App } from 'obsidian';
import { GitService } from './git-service';
import { FileChange, FileStatus } from '../types';
import { logger } from '../utils/logger';

// Node.js 模块需要通过动态导入，因为在 Obsidian 环境中不能直接静态导入
let execAsync: (command: string, options?: { cwd?: string; env?: Record<string, string> }) => Promise<{ stdout: string; stderr: string }>;
let nodeInitialized = false;

async function initNodeModules(): Promise<boolean> {
  if (nodeInitialized) return execAsync !== undefined;
  nodeInitialized = true;

  try {
    // 在 Obsidian Electron 环境中使用 window.require
    // @ts-ignore
    if (typeof window !== 'undefined' && window.require) {
      // @ts-ignore
      const childProcess = window.require('child_process');
      // @ts-ignore
      const util = window.require('util');
      execAsync = util.promisify(childProcess.exec);
      return true;
    }
    return false;
  } catch (error) {
    logger.warn('Failed to load Node.js modules:', error);
    return false;
  }
}

/**
 * 检测系统是否安装了 Git
 */
export async function isNativeGitAvailable(): Promise<boolean> {
  const initialized = await initNodeModules();
  if (!initialized) return false;

  try {
    await execAsync('git --version');
    return true;
  } catch {
    return false;
  }
}

/**
 * 原生 Git 服务（使用系统 Git）
 * 支持完整的 SSH 认证，适用于桌面端
 */
export class NativeGitService implements GitService {
  private repoPath: string;
  private initialized = false;

  constructor(private app: App) {
    this.repoPath = this.getVaultPath();
  }

  private getVaultPath(): string {
    const adapter = this.app.vault.adapter as unknown as { basePath?: string };
    return adapter.basePath || '';
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      const success = await initNodeModules();
      if (!success) {
        throw new Error('无法加载 Node.js 模块，请确保在桌面端运行');
      }
      this.initialized = true;
    }
  }

  private async execGit(args: string): Promise<string> {
    await this.ensureInitialized();

    // @ts-ignore - process.env 在 Electron 环境可用
    const env = typeof process !== 'undefined' ? process.env : {};

    const { stdout, stderr } = await execAsync(`git ${args}`, {
      cwd: this.repoPath,
      env: { ...env, GIT_TERMINAL_PROMPT: '0' }
    });

    // stderr 在 Git 中常用于输出进度信息，不一定是错误
    // 只有包含 error/fatal 时才记录为警告
    if (stderr && (stderr.toLowerCase().includes('error') || stderr.toLowerCase().includes('fatal'))) {
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
      // 获取当前分支
      const branch = await this.getCurrentBranch();
      const remoteBranch = `origin/${branch}`;

      // 按设计文档使用 fetch + merge，比 rebase 更宽容（允许未暂存变更）
      await this.execGit('fetch origin');
      await this.execGit(`merge ${remoteBranch}`);
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