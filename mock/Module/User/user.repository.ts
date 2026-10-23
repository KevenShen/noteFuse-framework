// mock/Module/User/user.repository.ts
// 用户数据访问层（Repository 模式）
// 职责：封装数据库（MockTable）、MongoDB、Redis 缓存、布隆过滤器等存取细节
// 【设计原则】业务层只调用 Repository 接口，不直接操作存储层
// 【数据分层】L1 MockTable（主存储）→ L2 MongoDB（二级缓存）→ L3 Redis（三级缓存）
// 【统一异步】所有方法均为 async，保持接口一致性，便于未来切换真实存储

import {
  findByIdFromMongoOrDb,
  findFromMongoOrDb,
  invalidateCacheAll,
} from '../../Core/utils';
import type { MockUser } from '../../Entities/user';
import {
  emailBloomFilter,
  resetCodeCache,
  tokenCache,
  userCache,
  userListCache,
  userMongoCollection,
  userTable,
  usernameBloomFilter,
} from '../../Entities/user';

// ============================================================================
// 用户数据访问类
// ============================================================================

class UserRepository {
  // ==================== 用户查询（三级降级：MongoDB → MockTable） ====================

  /**
   * 按 ID 查询用户（优先 MongoDB L2，降级 MockTable L1）
   * @param id 用户 ID
   * @returns 用户对象（不存在时返回 null）
   */
  async findById(id: number): Promise<MockUser | null> {
    return findByIdFromMongoOrDb(
      userMongoCollection,
      userTable,
      id,
      'UserRepository',
    );
  }

  /**
   * 按用户名查询用户（优先 MongoDB L2，降级 MockTable L1）
   * @param username 用户名
   * @returns 用户对象（不存在时返回 null）
   */
  async findByUsername(username: string): Promise<MockUser | null> {
    return findFromMongoOrDb(
      userMongoCollection,
      userTable,
      { username },
      'UserRepository',
    );
  }

  /**
   * 按邮箱查询用户（优先 MongoDB L2，降级 MockTable L1）
   * @param email 邮箱
   * @returns 用户对象（不存在时返回 null）
   */
  async findByEmail(email: string): Promise<MockUser | null> {
    return findFromMongoOrDb(
      userMongoCollection,
      userTable,
      { email },
      'UserRepository',
    );
  }

  // ==================== 用户写入（双写：MockTable + MongoDB） ====================

  /**
   * 创建用户（同时写入 L1 MockTable 和 L2 MongoDB，保持数据一致）
   * @param data 用户数据
   * @returns 创建后的用户对象
   */
  async create(data: Partial<MockUser>): Promise<MockUser> {
    const newUser = await userTable.create(data);
    await userMongoCollection.insertOne(newUser);
    return newUser;
  }

  /**
   * 更新用户（同时更新 L1 MockTable 和 L2 MongoDB，保持数据一致）
   * @param id 用户 ID
   * @param data 更新数据
   * @returns 更新后的用户对象（MockTable 返回值）
   */
  async update(id: number, data: Partial<MockUser>): Promise<MockUser | null> {
    const [updatedUser] = await Promise.all([
      userTable.updateById(id, data),
      userMongoCollection.updateOne({ id }, { $set: data }),
    ]);
    return updatedUser ?? null;
  }

  // ==================== 重置密码验证码操作 ====================

  /**
   * 设置重置密码验证码（存储到 Redis，TTL 自动过期）
   * @param email 邮箱
   * @param code 验证码
   */
  async setResetCode(email: string, code: string): Promise<void> {
    resetCodeCache.set(email, code);
  }

  /**
   * 获取重置密码验证码（从 Redis 读取，自动检查过期）
   * @param email 邮箱
   * @returns 验证码（不存在或已过期时返回 null）
   */
  async getResetCode(email: string): Promise<string | null> {
    return resetCodeCache.get<string>(email);
  }

  /**
   * 删除重置密码验证码
   * @param email 邮箱
   */
  async deleteResetCode(email: string): Promise<void> {
    resetCodeCache.del(email);
  }

  // ==================== Redis 缓存操作 ====================

  /**
   * 失效单个用户缓存
   * @param id 用户 ID
   */
  async invalidateUserCache(id: number | string): Promise<void> {
    userCache.del(String(id));
  }

  /**
   * 失效用户列表缓存（全量失效）
   */
  async invalidateUserListCache(): Promise<void> {
    invalidateCacheAll(userListCache);
  }

  /**
   * 清除用户相关缓存（单个用户 + 列表）
   * @param id 用户 ID
   * @param invalidateList 是否失效列表缓存（默认 true）
   */
  async clearUserCache(
    id?: number | string,
    invalidateList: boolean = true,
  ): Promise<void> {
    if (id) {
      await this.invalidateUserCache(id);
    }
    if (invalidateList) {
      await this.invalidateUserListCache();
    }
  }

  // ==================== Token 操作 ====================

  /**
   * 设置用户登录 Token
   * @param token Token 字符串
   * @param userId 用户 ID
   */
  async setToken(token: string, userId: number): Promise<void> {
    tokenCache.set(token, userId);
  }

  /**
   * 通过 Token 获取用户 ID
   * @param token Token 字符串
   * @returns 用户 ID（不存在时返回 null）
   */
  async getUserIdByToken(token: string): Promise<number | null> {
    return tokenCache.get<number>(token);
  }

  /**
   * 删除用户登录 Token
   * @param token Token 字符串
   */
  async deleteToken(token: string): Promise<void> {
    tokenCache.del(token);
  }

  // ==================== 用户缓存操作（认证专用） ====================

  /**
   * 获取用户缓存（Redis L3）
   * @param userId 用户 ID
   * @returns 缓存的用户对象（不存在时返回 null）
   */
  async getUserCache(userId: number | string): Promise<MockUser | null> {
    return userCache.get<MockUser>(String(userId));
  }

  /**
   * 设置用户缓存（Redis L3）
   * @param userId 用户 ID
   * @param user 用户对象
   */
  async setUserCache(userId: number | string, user: MockUser): Promise<void> {
    userCache.set(String(userId), user);
  }

  /**
   * 仅从 MongoDB 查询用户（不降级到 MockTable，用于认证场景）
   * @param userId 用户 ID
   * @returns 用户对象（不存在时返回 null）
   */
  async findByIdFromMongoOnly(userId: number): Promise<MockUser | null> {
    try {
      return await userMongoCollection.findOne({ id: userId });
    } catch {
      return null;
    }
  }

  // ==================== 布隆过滤器操作 ====================

  /**
   * 检查用户名是否可能存在（布隆过滤器）
   * 【特点】说"不存在"就一定不存在；说"可能存在"需要精确查询确认
   * @param username 用户名
   * @returns 是否可能存在
   */
  async mayUsernameExist(username: string): Promise<boolean> {
    return usernameBloomFilter.mayExist(username);
  }

  /**
   * 检查邮箱是否可能存在（布隆过滤器）
   * 【特点】说"不存在"就一定不存在；说"可能存在"需要精确查询确认
   * @param email 邮箱
   * @returns 是否可能存在
   */
  async mayEmailExist(email: string): Promise<boolean> {
    return emailBloomFilter.mayExist(email);
  }

  /**
   * 添加用户名到布隆过滤器
   * @param username 用户名
   */
  async addUsername(username: string): Promise<void> {
    usernameBloomFilter.add(username);
  }

  /**
   * 添加邮箱到布隆过滤器
   * @param email 邮箱
   */
  async addEmail(email: string): Promise<void> {
    emailBloomFilter.add(email);
  }
}

// ============================================================================
// 导出 Repository 实例
// ============================================================================
export const userRepository = new UserRepository();
