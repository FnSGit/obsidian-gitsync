// 插件设置
export interface GitSyncSettings {
  remoteUrl: string;
  authType: 'ssh' | 'token';

  // SSH 认证
  sshPrivateKey: string;
  sshPublicKey: string;

  // Token 认证
  token: string;

  // 自动同步配置
  autoSync: {
    enabled: boolean;
    interval: number; // 分钟
    wifiOnly: boolean;
    onStartup: boolean;
    onFileSave: boolean;
  };

  // 同步状态
  lastSync: string | null;
  lastSyncStats: SyncStats | null;
}

export interface SyncStats {
  pushed: number;
  pulled: number;
  timestamp: string;
}

// 冲突信息
export interface ConflictInfo {
  id: string;
  file: string;
  backupFile: string;
  detectedAt: string;
  status: 'pending' | 'resolved';
  localModified: string;
  remoteModified: string;
}

// 冲突队列
export interface ConflictQueue {
  conflicts: ConflictInfo[];
  lastSync: string | null;
}

// 同步状态
export type SyncStatus =
  | 'idle'
  | 'syncing'
  | 'conflict'
  | 'error'
  | 'success';

// 同步结果
export interface SyncResult {
  success: boolean;
  status: SyncStatus;
  pushed: number;
  pulled: number;
  conflicts: ConflictInfo[];
  error?: string;
}

// Git 文件状态
export type FileStatus =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'conflicted';

// Git 文件变更
export interface FileChange {
  path: string;
  status: FileStatus;
}

// 默认设置
export const DEFAULT_SETTINGS: GitSyncSettings = {
  remoteUrl: '',
  authType: 'token',
  sshPrivateKey: '',
  sshPublicKey: '',
  token: '',
  autoSync: {
    enabled: false,
    interval: 10,
    wifiOnly: true,
    onStartup: false,
    onFileSave: false,
  },
  lastSync: null,
  lastSyncStats: null,
};