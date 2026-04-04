import ignore from 'ignore';
import { App, TFile, normalizePath } from 'obsidian';
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
      const file = this.app.vault.getAbstractFileByPath(this.gitignorePath);

      if (file instanceof TFile) {
        const content = await this.app.vault.read(file);
        this.ignore = ignore().add(content);
        logger.info('Loaded .gitignore from repository');
        return true;
      }

      // 没有找到 .gitignore，使用默认规则
      this.loadDefault();
      logger.info('Using default ignore rules');
      return false;
    } catch (error) {
      this.loadDefault();
      logger.warn('Failed to load .gitignore, using defaults');
      return false;
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