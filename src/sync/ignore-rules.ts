import ignore from 'ignore';
import { App, TFile, normalizePath, Platform } from 'obsidian';
import { logger } from '../utils/logger';

/**
 * .gitignore 规则解析器
 */
export class IgnoreRules {
  private ignore: ReturnType<typeof ignore>;
  private gitignorePath = '.gitignore';

  constructor(private app: App) {
    this.ignore = ignore();
  }

  /**
   * 加载仓库的 .gitignore 文件
   */
  async load(): Promise<boolean> {
    try {
      let content: string | null = null;

      // 桌面端：直接通过文件系统读取（支持隐藏文件）
      if (Platform.isDesktopApp) {
        content = await this.loadFromFileSystem();
        if (content) {
          logger.info('Loaded .gitignore via file system (desktop)');
        }
      }

      // 备用方式：通过 Obsidian API（不索引隐藏文件）
      if (!content) {
        const file = this.app.vault.getAbstractFileByPath(this.gitignorePath);
        if (file instanceof TFile) {
          content = await this.app.vault.read(file);
          logger.info('Loaded .gitignore via Obsidian API');
        }
      }

      if (content) {
        this.ignore = ignore().add(content);
        logger.info('.gitignore rules loaded successfully');
        return true;
      }

      // 没有找到 .gitignore，使用默认规则
      this.loadDefault();
      logger.info('No .gitignore found, using default ignore rules');
      return false;
    } catch (error) {
      this.loadDefault();
      logger.warn('Failed to load .gitignore, using defaults:', error);
      return false;
    }
  }

  /**
   * 通过 Node.js 文件系统读取 .gitignore（桌面端）
   */
  private async loadFromFileSystem(): Promise<string | null> {
    try {
      // @ts-ignore
      if (typeof window !== 'undefined' && window.require) {
        // @ts-ignore
        const fs = window.require('fs');
        // @ts-ignore
        const path = window.require('path');

        const adapter = this.app.vault.adapter as unknown as { basePath?: string };
        const vaultPath = adapter.basePath;

        if (!vaultPath) return null;

        const gitignorePath = path.join(vaultPath, this.gitignorePath);

        if (fs.existsSync(gitignorePath)) {
          return fs.readFileSync(gitignorePath, 'utf-8');
        }
      }
      return null;
    } catch (error) {
      logger.warn('Failed to read .gitignore via file system:', error);
      return null;
    }
  }

  /**
   * 加载默认忽略规则
   */
  loadDefault(): void {
    this.ignore = ignore().add([
      // Obsidian
      '.obsidian/',
      '.trash/',

      // System
      '.DS_Store',
      'Thumbs.db',
      '*.tmp',

      // Git
      '.git/',

      // Plugin sensitive data
      '.obsidian/plugins/*/data.json',
    ]);
  }

  /**
   * 检查文件是否应该被忽略
   */
  shouldIgnore(path: string): boolean {
    const normalized = normalizePath(path);
    return this.ignore.ignores(normalized);
  }

  /**
   * 过滤出不应忽略的文件
   */
  filter(files: string[]): string[] {
    return files.filter(f => !this.shouldIgnore(f));
  }

  /**
   * 创建默认 .gitignore 文件
   */
  async createDefault(): Promise<void> {
    const content = `# Obsidian
.obsidian/
.trash/

# System
.DS_Store
Thumbs.db
*.tmp

# Git
.git/

# Plugin config (sensitive)
.obsidian/plugins/*/data.json
`;

    const file = this.app.vault.getAbstractFileByPath(this.gitignorePath);
    if (!file) {
      await this.app.vault.create(this.gitignorePath, content);
      logger.info('Created default .gitignore');
    }
  }
}