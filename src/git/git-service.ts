import { FileChange, SyncResult } from '../types';

/**
 * Git 操作抽象接口
 * 屏蔽底层实现差异（Isomorphic Git vs 系统 Git）
 */
export interface GitService {
  /**
   * 检查是否已初始化 Git 仓库
   */
  isRepoInitialized(): Promise<boolean>;

  /**
   * 初始化 Git 仓库
   */
  initRepo(): Promise<void>;

  /**
   * 克隆远程仓库
   */
  clone(url: string, dir: string): Promise<void>;

  /**
   * 获取远程仓库 URL
   */
  getRemoteUrl(): Promise<string | null>;

  /**
   * 设置远程仓库 URL
   */
  setRemoteUrl(url: string): Promise<void>;

  /**
   * 获取当前分支
   */
  getCurrentBranch(): Promise<string>;

  /**
   * 获取文件状态
   */
  getStatus(): Promise<FileChange[]>;

  /**
   * 获取未提交的变更数量
   */
  getUncommittedCount(): Promise<{ staged: number; unstaged: number }>;

  /**
   * 添加文件到暂存区
   */
  add(files?: string[]): Promise<void>;

  /**
   * 提交变更
   */
  commit(message: string): Promise<void>;

  /**
   * 拉取远程变更
   * @returns 是否有冲突
   */
  pull(): Promise<{ hasConflicts: boolean; conflictFiles: string[] }>;

  /**
   * 推送到远程
   */
  push(): Promise<void>;

  /**
   * 获取指定文件的内容
   */
  getFileContent(path: string, ref?: string): Promise<string>;

  /**
   * 检查网络连接
   */
  checkConnection(): Promise<boolean>;

  /**
   * 清理资源
   */
  dispose(): void;
}

/**
 * Git 服务工厂
 */
export type GitServiceFactory = () => Promise<GitService>;