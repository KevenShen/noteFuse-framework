/**
 * L5 管理监控层 - 用户权限 Mixin
 *
 * 功能：
 * - setPermissions：设置用户权限
 * - clearPermissions：清除用户权限
 * - listPermissions：列出所有权限
 * - getUserPermissions：获取用户权限
 * - checkPermission：检查用户权限
 * - createUser：创建用户
 * - deleteUser：删除用户
 * - listUsers：列出所有用户
 */

import type { Constructor } from './mixin.types';
import { MockRabbitMQBase } from './MockRabbitMQBase';

/**
 * 用户权限配置
 */
interface UserPermissions {
  /** 用户名 */
  username: string;
  /** 虚拟主机 */
  vhost: string;
  /** 配置权限（正则表达式，匹配交换机/队列名称） */
  configure: string;
  /** 写权限（正则表达式，匹配交换机/队列名称） */
  write: string;
  /** 读权限（正则表达式，匹配交换机/队列名称） */
  read: string;
  /** 设置时间 */
  setAt: number;
}

/**
 * 用户信息
 */
interface UserInfo {
  /** 用户名 */
  username: string;
  /** 密码（哈希） */
  passwordHash: string;
  /** 用户标签 */
  tags: string[];
  /** 创建时间 */
  createdAt: number;
  /** 是否启用 */
  enabled: boolean;
}

/**
 * 权限检查结果
 */
interface PermissionCheckResult {
  /** 是否允许 */
  allowed: boolean;
  /** 拒绝原因 */
  reason?: string;
}

/**
 * 用户权限 Mixin
 *
 * 【说明】
 * RabbitMQ 的权限系统基于虚拟主机，每个用户在每个 vhost 上有独立的权限。
 * 权限使用正则表达式匹配资源名称：
 * - configure：可创建/删除的资源
 * - write：可发布消息的资源
 * - read：可消费消息的资源
 *
 * @param Base 基类
 * @returns 扩展后的类
 */
export function WithPermission<T extends Constructor>(Base: T) {
  return class PermissionMixin extends (Base as unknown as typeof MockRabbitMQBase) {
    // ==================== 权限存储 ====================

    /**
     * 用户权限：`${username}@${vhost}` → UserPermissions
     */
    protected permissions: Map<string, UserPermissions> = new Map();

    /**
     * 用户信息：username → UserInfo
     */
    protected users: Map<string, UserInfo> = new Map();

    // ==================== 构造函数初始化 ====================

    /**
     * 初始化默认用户（在构造函数后调用）
     */
    protected initDefaultUser(): void {
      if (!this.users.has('guest')) {
        this.users.set('guest', {
          username: 'guest',
          passwordHash: this.simpleHash('guest'),
          tags: ['administrator'],
          createdAt: Date.now(),
          enabled: true,
        });

        // guest 用户在默认 vhost 上有全部权限
        this.permissions.set('guest@/', {
          username: 'guest',
          vhost: '/',
          configure: '.*',
          write: '.*',
          read: '.*',
          setAt: Date.now(),
        });
      }
    }

    /**
     * 简单哈希（模拟密码哈希，实际应使用 bcrypt 等）
     */
    protected simpleHash(password: string): string {
      let hash = 0;
      for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
      }
      return `hash_${Math.abs(hash)}`;
    }

    // ==================== 用户管理 ====================

    /**
     * 创建用户
     *
     * @param username 用户名
     * @param password 密码
     * @param tags 用户标签（可选，如 administrator、management、policymaker）
     * @returns 是否成功创建
     */
    createUser(username: string, password: string, tags: string[] = []): boolean {
      if (this.users.has(username)) {
        console.warn(`[MockRabbitMQ] 用户已存在: ${username}`);
        return false;
      }

      this.users.set(username, {
        username,
        passwordHash: this.simpleHash(password),
        tags,
        createdAt: Date.now(),
        enabled: true,
      });

      console.log(`[MockRabbitMQ] 用户已创建: ${username}, tags=${tags.join(',')}`);
      return true;
    }

    /**
     * 删除用户
     *
     * @param username 用户名
     * @returns 是否成功删除
     */
    deleteUser(username: string): boolean {
      if (username === 'guest') {
        throw new Error('不能删除默认用户 guest');
      }

      if (!this.users.has(username)) {
        console.warn(`[MockRabbitMQ] 用户不存在: ${username}`);
        return false;
      }

      this.users.delete(username);

      // 删除该用户的所有权限
      for (const key of this.permissions.keys()) {
        if (key.startsWith(`${username}@`)) {
          this.permissions.delete(key);
        }
      }

      console.log(`[MockRabbitMQ] 用户已删除: ${username}`);
      return true;
    }

    /**
     * 列出所有用户
     *
     * @returns 用户信息列表
     */
    listUsers(): UserInfo[] {
      return Array.from(this.users.values());
    }

    /**
     * 获取用户信息
     *
     * @param username 用户名
     * @returns 用户信息（不存在返回 null）
     */
    getUser(username: string): UserInfo | null {
      return this.users.get(username) || null;
    }

    /**
     * 验证用户密码
     *
     * @param username 用户名
     * @param password 密码
     * @returns 是否验证通过
     */
    authenticateUser(username: string, password: string): boolean {
      const user = this.users.get(username);
      if (!user || !user.enabled) return false;
      return user.passwordHash === this.simpleHash(password);
    }

    /**
     * 修改用户密码
     *
     * @param username 用户名
     * @param newPassword 新密码
     */
    changePassword(username: string, newPassword: string): void {
      const user = this.users.get(username);
      if (!user) {
        throw new Error(`用户 '${username}' 不存在`);
      }
      user.passwordHash = this.simpleHash(newPassword);
      console.log(`[MockRabbitMQ] 用户密码已修改: ${username}`);
    }

    /**
     * 设置用户标签
     *
     * @param username 用户名
     * @param tags 用户标签
     */
    setUserTags(username: string, tags: string[]): void {
      const user = this.users.get(username);
      if (!user) {
        throw new Error(`用户 '${username}' 不存在`);
      }
      user.tags = tags;
      console.log(`[MockRabbitMQ] 用户标签已设置: ${username}, tags=${tags.join(',')}`);
    }

    // ==================== 权限管理 ====================

    /**
     * 设置用户权限
     *
     * @param username 用户名
     * @param vhost 虚拟主机
     * @param configure 配置权限（正则表达式）
     * @param write 写权限（正则表达式）
     * @param read 读权限（正则表达式）
     */
    setPermissions(
      username: string,
      vhost: string,
      configure: string = '.*',
      write: string = '.*',
      read: string = '.*',
    ): void {
      if (!this.users.has(username)) {
        throw new Error(`用户 '${username}' 不存在`);
      }

      const key = `${username}@${vhost}`;
      this.permissions.set(key, {
        username,
        vhost,
        configure,
        write,
        read,
        setAt: Date.now(),
      });

      console.log(
        `[MockRabbitMQ] 权限已设置: ${username}@${vhost}, ` +
        `configure=${configure}, write=${write}, read=${read}`,
      );
    }

    /**
     * 清除用户权限
     *
     * @param username 用户名
     * @param vhost 虚拟主机
     */
    clearPermissions(username: string, vhost: string): void {
      const key = `${username}@${vhost}`;
      if (this.permissions.delete(key)) {
        console.log(`[MockRabbitMQ] 权限已清除: ${username}@${vhost}`);
      }
    }

    /**
     * 列出所有权限
     *
     * @returns 权限列表
     */
    listPermissions(): UserPermissions[] {
      return Array.from(this.permissions.values());
    }

    /**
     * 获取用户权限
     *
     * @param username 用户名
     * @param vhost 虚拟主机
     * @returns 权限配置（不存在返回 null）
     */
    getUserPermissions(username: string, vhost: string): UserPermissions | null {
      return this.permissions.get(`${username}@${vhost}`) || null;
    }

    // ==================== 权限检查 ====================

    /**
     * 检查用户是否有配置权限（创建/删除资源）
     *
     * @param username 用户名
     * @param vhost 虚拟主机
     * @param resourceName 资源名称（交换机或队列名）
     * @returns 检查结果
     */
    checkConfigurePermission(
      username: string,
      vhost: string,
      resourceName: string,
    ): PermissionCheckResult {
      return this.checkPermission(username, vhost, 'configure', resourceName);
    }

    /**
     * 检查用户是否有写权限（发布消息）
     */
    checkWritePermission(
      username: string,
      vhost: string,
      resourceName: string,
    ): PermissionCheckResult {
      return this.checkPermission(username, vhost, 'write', resourceName);
    }

    /**
     * 检查用户是否有读权限（消费消息）
     */
    checkReadPermission(
      username: string,
      vhost: string,
      resourceName: string,
    ): PermissionCheckResult {
      return this.checkPermission(username, vhost, 'read', resourceName);
    }

    /**
     * 通用权限检查（内部方法）
     */
    protected checkPermission(
      username: string,
      vhost: string,
      permissionType: 'configure' | 'write' | 'read',
      resourceName: string,
    ): PermissionCheckResult {
      const permissions = this.permissions.get(`${username}@${vhost}`);
      if (!permissions) {
        return {
          allowed: false,
          reason: `用户 ${username} 在虚拟主机 ${vhost} 上没有权限`,
        };
      }

      const pattern = permissions[permissionType];
      if (pattern === '.*' || pattern === '') {
        return { allowed: true };
      }

      try {
        const regex = new RegExp(pattern);
        if (regex.test(resourceName)) {
          return { allowed: true };
        }
        return {
          allowed: false,
          reason: `资源 ${resourceName} 不匹配 ${permissionType} 权限模式 ${pattern}`,
        };
      } catch (error) {
        return {
          allowed: false,
          reason: `权限模式无效: ${pattern}`,
        };
      }
    }

    // ==================== 权限统计 ====================

    /**
     * 获取权限统计
     */
    getPermissionStats(): {
      totalUsers: number;
      totalPermissions: number;
      enabledUsers: number;
      disabledUsers: number;
      adminUsers: number;
    } {
      const users = Array.from(this.users.values());
      return {
        totalUsers: users.length,
        totalPermissions: this.permissions.size,
        enabledUsers: users.filter((u) => u.enabled).length,
        disabledUsers: users.filter((u) => !u.enabled).length,
        adminUsers: users.filter((u) => u.tags.includes('administrator')).length,
      };
    }
  };
}
