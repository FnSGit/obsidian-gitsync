/**
 * 认证提供者抽象接口
 */
export interface AuthProvider {
  /**
   * 认证类型
   */
  type: 'ssh' | 'token';

  /**
   * 验证认证配置
   */
  validate(): Promise<boolean>;

  /**
   * 获取认证信息（用于 Git 操作）
   */
  getCredentials(): Promise<AuthCredentials>;

  /**
   * 清理认证信息
   */
  clear(): void;
}

/**
 * 认证凭据
 */
export interface AuthCredentials {
  type: 'ssh' | 'token';
  token?: string;
  sshKey?: string;
  publicKey?: string;
}