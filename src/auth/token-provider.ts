import { AuthProvider, AuthCredentials } from './auth-provider';
import { logger } from '../utils/logger';

/** 最小 Token 长度 */
const MIN_TOKEN_LENGTH = 20;

/**
 * Token 认证提供者
 * 使用个人访问令牌进行 HTTPS 认证
 */
export class TokenAuthProvider implements AuthProvider {
  readonly type = 'token' as const;
  private token: string;

  constructor(token: string = '') {
    this.token = token;
  }

  /**
   * 设置 Token
   */
  setToken(token: string): void {
    this.token = token;
  }

  /**
   * 获取 Token
   */
  getToken(): string {
    return this.token;
  }

  async validate(): Promise<boolean> {
    if (!this.token || this.token.trim().length === 0) {
      logger.warn('Token is empty');
      return false;
    }

    // 基本格式检查
    if (this.token.length < MIN_TOKEN_LENGTH) {
      logger.warn('Token format invalid');
      return false;
    }

    // TODO: 实际验证可以调用 Gitee API 检查 token 有效性
    return true;
  }

  async getCredentials(): Promise<AuthCredentials> {
    return {
      type: 'token',
      token: this.token,
    };
  }

  clear(): void {
    this.token = '';
  }
}