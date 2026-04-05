[根目录](../../CLAUDE.md) > [src](../) > **auth**

---

# Auth 模块

> 认证提供者抽象和实现，支持 Token 和 SSH 认证

---

## 变更记录 (Changelog)

| 时间 | 变更 |
|------|------|
| 2026-04-05 15:30 | 初始化模块文档 |

---

## 模块职责

提供认证管理抽象，支持多种认证方式：

- **AuthProvider**：认证接口抽象
- **TokenAuthProvider**：HTTPS Token 认证（移动端/无系统 Git）

---

## 入口与启动

### 认证类型选择

```typescript
// 根据设置选择认证类型
if (settings.authType === 'token') {
  authProvider = new TokenAuthProvider(settings.token);
} else {
  // SSH 认证（待实现）
  // authProvider = new SSHAuthProvider(settings.sshPrivateKey);
}
```

### Token 认证流程

1. 用户在 Gitee/GitHub 创建个人访问令牌
2. 在插件设置中配置 Token
3. Token 传递给 Git 服务用于 HTTPS 认证

---

## 对外接口

### AuthProvider 接口

| 方法 | 描述 | 返回值 |
|------|------|--------|
| `validate()` | 验证认证配置有效性 | `Promise<boolean>` |
| `getCredentials()` | 获取认证信息 | `Promise<AuthCredentials>` |
| `clear()` | 清理认证信息 | `void` |

### TokenAuthProvider

| 方法 | 描述 | 返回值 |
|------|------|--------|
| `setToken(token)` | 设置 Token | `void` |
| `getToken()` | 获取 Token | `string` |

---

## 关键依赖与配置

### 认证信息存储

认证配置存储在插件设置 `data.json`（Obsidian 自动管理）：

```typescript
interface GitSyncSettings {
  authType: 'ssh' | 'token';
  token: string;
  sshPrivateKey: string;
  sshPublicKey: string;
}
```

### Token 格式要求

- 最小长度：20 字符
- Gitee Token：通常 40 字符
- GitHub Token：通常 40+ 字符

---

## 数据模型

### AuthCredentials

```typescript
interface AuthCredentials {
  type: 'ssh' | 'token';
  token?: string;
  sshKey?: string;
  publicKey?: string;
}
```

---

## 测试与质量

### 当前状态

- 无单元测试
- SSH Provider 未实现

### 测试优先级

1. **P0**：`TokenAuthProvider.validate()` - Token 格式验证
2. **P1**：认证有效性 API 检查（调用 Gitee API）

### 缺口

- **SSH Provider 未实现**：`src/auth/ssh-provider.ts` 缺失
- 桌面端 SSH 认证目前由 NativeGitService 自动处理（使用系统 SSH 配置）

---

## 常见问题 (FAQ)

### Q: 为什么移动端不支持 SSH？

A: isomorphic-git 不支持 SSH 协议，仅支持 HTTPS + Token 认证。

### Q: 桌面端如何使用 SSH？

A: NativeGitService 使用系统 Git，自动读取系统 SSH 配置（~/.ssh/），无需插件额外管理。

### Q: Token 存储安全吗？

A: Token 存储在 `data.json`，Obsidian 会加密存储敏感数据。建议使用 Obsidian 的 safeStorage API。

---

## 相关文件清单

| 文件 | 行数 | 描述 |
|------|------|------|
| `auth-provider.ts` | 34 | 认证接口定义 |
| `token-provider.ts` | 59 | Token 认证实现 |

---

## API 使用示例

### 验证 Token

```typescript
const authProvider = new TokenAuthProvider(settings.token);

if (!await authProvider.validate()) {
  new Notice('Token 格式无效');
  return;
}

const credentials = await authProvider.getCredentials();
gitService.setToken(credentials.token);
```

---

## 待实现功能

### SSH Provider

```typescript
// 计划实现的 SSH 认证提供者
export class SSHAuthProvider implements AuthProvider {
  readonly type = 'ssh';
  private privateKey: string;
  private publicKey: string;
  
  async validate(): Promise<boolean> {
    // 验证密钥格式
  }
  
  async getCredentials(): Promise<AuthCredentials> {
    return { type: 'ssh', sshKey: this.privateKey };
  }
}
```

---

*文档生成时间：2026-04-05 15:30:17*