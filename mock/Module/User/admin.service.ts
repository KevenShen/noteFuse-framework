// mock/User/admin.service.ts
// 管理员用户服务层
// 职责：处理管理员相关的核心业务逻辑，调用数据库（MockTable）和缓存（Redis）

import { BusinessError } from '../../Core';
import { sanitizeUser } from '../../Core/auth';
import {
  encryptPassword,
  findByIdFromMongoOrDb,
  findFromMongoOrDb,
  invalidateCacheAll,
} from '../../Core/utils';
import type { MockUser } from '../../Entities/user';
import {
  defaultEditorSettings,
  emailBloomFilter,
  userListCache,
  userMongoCollection,
  userTable,
  usernameBloomFilter,
} from '../../Entities/user';
import type {
  AdminCreateUserRequest,
  AdminGetUserListRequest,
  AdminUpdateUserRequest,
} from './admin.dto';
import { userRepository } from './user.repository';

// ==================== 管理员用户服务类 ====================

/**
 * 管理员用户服务
 */
class AdminService {
  // ==================== 管理员用户管理相关 ====================

  /**
   * 校验管理员权限
   * @param userId 当前用户 ID
   */
  async checkAdminPermission(userId: number): Promise<void> {
    // 查询优先从 MongoDB L2，降级到 MockTable L1
    const user = await findByIdFromMongoOrDb(userMongoCollection, userTable, userId, 'AdminService');
    if (!user) {
      throw new BusinessError('用户不存在', 401);
    }
    if (!user.is_staff) {
      throw new BusinessError('没有权限访问', 403);
    }
  }

  /**
   * 校验超级管理员权限
   * @param userId 当前用户 ID
   */
  async checkSuperAdminPermission(userId: number): Promise<void> {
    // 查询优先从 MongoDB L2，降级到 MockTable L1
    const user = await findByIdFromMongoOrDb(userMongoCollection, userTable, userId, 'AdminService');
    if (!user) {
      throw new BusinessError('用户不存在', 401);
    }
    if (!user.is_superuser) {
      throw new BusinessError('只有超级管理员可以删除用户', 403);
    }
  }

  /**
   * 获取用户列表（分页 + 搜索 + 缓存 + MongoDB 分层）
   * 【参数约定】所有参数均已由 controller 层设置默认值，此处直接使用，无需再处理默认值
   * 【数据来源】优先从 MongoDB（L2）复杂查询，降级到 MockTable（L1）
   * @param data 完整的请求参数（page/pageSize/keyword/status）
   * @returns 用户列表
   */
  async getAdminUserList(data: AdminGetUserListRequest): Promise<{
    list: Omit<MockUser, 'password'>[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    // 直接解构使用，参数已由 controller 层设置默认值（使用非空断言）
    const page = data.page!;
    const pageSize = data.pageSize!;
    const keyword = data.keyword!;
    const status = data.status!;

    // 缓存键（userListCache 已有 'user:list:' 前缀，这里不需要再加 'list:'）
    const cacheKey = `admin:${page}:${pageSize}:${keyword}:${status}`;

    return (await userListCache.getOrSet(cacheKey, async () => {
      // ========== 优先从 MongoDB（L2）获取，支持复杂查询 ==========
      let filtered: MockUser[] = [];
      let useMongo = false;

      try {
        // 构建 MongoDB 查询条件
        const query: any = {};
        if (status) {
          query.status = status;
        }

        // 从 MongoDB 获取所有符合状态条件的用户
        let mongoUsers = await userMongoCollection.find(query).toArray();

        // 关键词搜索（MongoDB Mock 可能不支持正则，在内存中过滤）
        if (keyword) {
          const kw = keyword.toLowerCase();
          mongoUsers = mongoUsers.filter(
            (u) =>
              u.username.toLowerCase().includes(kw) ||
              u.nickname.toLowerCase().includes(kw) ||
              u.email.toLowerCase().includes(kw),
          );
        }

        filtered = mongoUsers;
        useMongo = true;
      } catch (error) {
        console.warn('[UserService] MongoDB 查询失败，降级到 MockTable:', error);
      }

      // ========== 降级到 MockTable（L1）==========
      if (!useMongo) {
        filtered = await userTable.findAll();

        if (keyword) {
          const kw = keyword.toLowerCase();
          filtered = filtered.filter(
            (u) =>
              u.username.toLowerCase().includes(kw) ||
              u.nickname.toLowerCase().includes(kw) ||
              u.email.toLowerCase().includes(kw),
          );
        }

        if (status) {
          filtered = filtered.filter((u) => u.status === status);
        }
      }

      // 分页
      const total = filtered.length;
      const start = (page - 1) * pageSize;
      const list = filtered.slice(start, start + pageSize).map(sanitizeUser);

      return {
        list,
        total,
        page,
        pageSize,
      };
    }))!;
  }

  /**
   * 获取单个用户详情
   * 【数据来源】优先从 MongoDB（L2），降级到 MockTable（L1）
   * @param userId 用户 ID
   * @returns 用户详情
   */
  async getAdminUserDetail(userId: number): Promise<Omit<MockUser, 'password'>> {
    // 查询优先从 MongoDB L2，降级到 MockTable L1
    const user = await findByIdFromMongoOrDb(userMongoCollection, userTable, userId, 'AdminService');

    if (!user) {
      throw new BusinessError('用户不存在', 404);
    }

    return sanitizeUser(user);
  }

  /**
   * 管理员创建用户
   * @param data 请求参数
   * @returns 创建的用户
   */
  async adminCreateUser(data: AdminCreateUserRequest): Promise<Omit<MockUser, 'password'>> {
    // 1. 检查用户名是否已存在（布隆过滤器优化 + MongoDB 优先查询）
    if (usernameBloomFilter.mayExist(data.username)) {
      // 优先从 MongoDB L2 查询，降级到 MockTable L1
      const existUser = await findFromMongoOrDb(userMongoCollection, userTable, { username: data.username }, 'AdminService');
      if (existUser) {
        throw new BusinessError('用户名已存在');
      }
    }

    // 2. 检查邮箱是否已存在（布隆过滤器优化 + MongoDB 优先查询）
    if (emailBloomFilter.mayExist(data.email)) {
      // 优先从 MongoDB L2 查询，降级到 MockTable L1
      const existUser = await findFromMongoOrDb(userMongoCollection, userTable, { email: data.email }, 'AdminService');
      if (existUser) {
        throw new BusinessError('邮箱已存在');
      }
    }

    // 3. 创建新用户（同时写入 L1 MockTable 和 L2 MongoDB）
    // 【安全】密码使用 AES-256-GCM 加密后存储，不保存明文
    const encryptedPassword = encryptPassword(data.password);
    const newUser = await userTable.create({
      username: data.username,
      password: encryptedPassword,
      nickname: data.nickname || data.username,
      email: data.email,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.username}`,
      is_staff: data.is_staff || false,
      is_superuser: false,
      status: 'active',
      created_at: new Date().toLocaleString('zh-CN', { hour12: false }),
      editor: defaultEditorSettings.editor,
      autosave: defaultEditorSettings.autosave,
      livepreview: defaultEditorSettings.livepreview,
    });
    // 同步插入 MongoDB L2
    await userMongoCollection.insertOne(newUser);

    // 4. 将新用户的 username 和 email 添加到布隆过滤器
    usernameBloomFilter.add(newUser.username);
    emailBloomFilter.add(newUser.email);

    // 5. 清除相关缓存
    await userRepository.clearUserCache();
    invalidateCacheAll(userListCache);

    return sanitizeUser(newUser);
  }

  /**
   * 管理员更新用户
   * @param userId 用户 ID
   * @param data 请求参数
   * @returns 更新后的用户
   */
  async adminUpdateUser(
    userId: number,
    data: AdminUpdateUserRequest,
  ): Promise<Omit<MockUser, 'password'>> {
    const user = await userTable.findById(userId);

    if (!user) {
      throw new BusinessError('用户不存在', 404);
    }

    // 检查邮箱是否被其他用户使用（布隆过滤器优化 + MongoDB 优先查询）
    if (data.email !== undefined && data.email !== user.email) {
      if (emailBloomFilter.mayExist(data.email)) {
        // 优先从 MongoDB L2 查询，降级到 MockTable L1
        const existUser = await findFromMongoOrDb(userMongoCollection, userTable, { email: data.email }, 'AdminService');
        if (existUser) {
          throw new BusinessError('邮箱已被使用');
        }
      }
      // 邮箱变更后，将新邮箱添加到布隆过滤器
      // 注意：布隆过滤器不支持删除，旧邮箱仍保留在过滤器中（不影响功能，只会导致多查一次数据库）
      emailBloomFilter.add(data.email);
    }

    // 更新字段
    const updateData: Partial<MockUser> = {};
    if (data.nickname !== undefined) updateData.nickname = data.nickname;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.is_staff !== undefined) updateData.is_staff = data.is_staff;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.avatar !== undefined) updateData.avatar = data.avatar;

    const [updatedUser] = await Promise.all([
      userTable.updateById(userId, updateData),
      // 同步更新 MongoDB L2（保持数据一致）
      userMongoCollection.updateOne(
        { id: userId },
        { $set: updateData },
      ),
    ]);

    // 清除相关缓存
    userRepository.clearUserCache(userId);
    invalidateCacheAll(userListCache);

    return sanitizeUser(updatedUser!);
  }

  /**
   * 管理员删除用户
   * @param userId 要删除的用户 ID
   * @param currentUserId 当前操作的用户 ID
   */
  async adminDeleteUser(userId: number, currentUserId: number): Promise<null> {
    // 不能删除自己
    if (userId === currentUserId) {
      throw new BusinessError('不能删除自己');
    }

    const user = await userTable.findById(userId);
    if (!user) {
      throw new BusinessError('用户不存在', 404);
    }

    // 删除用户（同时删除 L1 MockTable 和 L2 MongoDB）
    await Promise.all([
      userTable.deleteById(userId),
      userMongoCollection.deleteOne({ id: userId }),
    ]);

    // 清除相关缓存
    userRepository.clearUserCache(userId);
    invalidateCacheAll(userListCache);

    return null;
  }
}

export const adminService = new AdminService();
