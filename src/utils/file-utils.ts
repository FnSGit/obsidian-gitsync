import { App, normalizePath, TFile, TFolder } from 'obsidian';

export class FileUtils {
  constructor(private app: App) {}

  /**
   * 获取文件内容
   */
  async readFile(path: string): Promise<string> {
    const normalizedPath = normalizePath(path);
    const file = this.app.vault.getAbstractFileByPath(normalizedPath);

    if (file instanceof TFile) {
      return await this.app.vault.read(file);
    }

    throw new Error(`File not found: ${normalizedPath}`);
  }

  /**
   * 写入文件内容
   */
  async writeFile(path: string, content: string): Promise<void> {
    const normalizedPath = normalizePath(path);
    const file = this.app.vault.getAbstractFileByPath(normalizedPath);

    if (file instanceof TFile) {
      await this.app.vault.modify(file, content);
    } else {
      await this.app.vault.create(normalizedPath, content);
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(path: string): Promise<void> {
    const normalizedPath = normalizePath(path);
    const file = this.app.vault.getAbstractFileByPath(normalizedPath);

    if (file instanceof TFile) {
      await this.app.vault.delete(file);
    }
  }

  /**
   * 检查文件是否存在
   */
  fileExists(path: string): boolean {
    const normalizedPath = normalizePath(path);
    const file = this.app.vault.getAbstractFileByPath(normalizedPath);
    return file instanceof TFile;
  }

  /**
   * 创建目录（如果不存在）
   */
  async ensureDir(path: string): Promise<void> {
    const normalizedPath = normalizePath(path);
    const folder = this.app.vault.getAbstractFileByPath(normalizedPath);

    if (!folder) {
      await this.app.vault.createFolder(normalizedPath);
    }
  }

  /**
   * 列出目录下的所有文件
   */
  listFiles(dirPath: string): string[] {
    const normalizedPath = normalizePath(dirPath);
    const folder = this.app.vault.getAbstractFileByPath(normalizedPath);

    if (!(folder instanceof TFolder)) {
      return [];
    }

    const files: string[] = [];

    const collectFiles = (folder: TFolder) => {
      for (const child of folder.children) {
        if (child instanceof TFile) {
          files.push(child.path);
        } else if (child instanceof TFolder) {
          collectFiles(child);
        }
      }
    };

    collectFiles(folder);
    return files;
  }

  /**
   * 获取仓库根目录路径
   */
  getVaultRoot(): string {
    const adapter = this.app.vault.adapter as unknown as { basePath?: string };
    return adapter.basePath || '';
  }
}