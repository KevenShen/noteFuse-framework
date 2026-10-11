// mock/User/service.ts
// 用户服务层
// 职责：处理核心业务逻辑，调用数据库（MockTable）和缓存（Redis）
// 【服务层】只包含业务逻辑，返回纯数据，失败时抛出 BusinessError
// 【控制器层】负责捕获 BusinessError 并包装成统一响应格式

import type { Request } from 'express';
import { BusinessError } from '../../Core';
import {
  generateToken,
  getTokenFromRequest,
  sanitizeUser,
} from '../../Core/auth';
import { encryptPassword, verifyPassword } from '../../Core/crypto';
import type { MockEditorSettings, MockUser } from '../../Entities/user';
import {
  addEmailToBloom,
  addUsernameToBloom,
  defaultEditorSettings,
  emailMayExist,
  resetCodeCache,
  tokenCache,
  userCache,
  userListCache,
  userMongoCollection,
  userTable,
  usernameMayExist,
} from '../../Entities/user';
import type {
  ChangePasswordRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  SaveEditorSettingsRequest,
  UpdateProfileRequest,
} from './user.dto';

// userTable 已包含完整配置：索引、验证规则、钩子、软删除、时间戳等

/**
 * 清除用户相关缓存
 * @param id 用户ID（可选，传入时失效单个用户缓存）
 * @param invalidateList 是否失效列表缓存（默认 true）
 */
export const clearUserCache = (
  id?: number | string,
  invalidateList: boolean = true,
) => {
  if (id) {
    // 编辑器设置是用户信息的一部分，包含在完整用户缓存中，不需要单独删除
    userCache.del(String(id));
  }
  if (invalidateList) {
    userListCache.invalidateAll();
  }
};

/**
 * 从 MongoDB（L2）获取用户，降级到 MockTable（L1）
 *
 * 【降级顺序】MongoDB（L2）→ MockTable（L1）
 * 【说明】MongoDB 作为只读 L2，运行时不更新，只在冷启动时重建
 * 【用途】统一用户查询入口，避免重复编写降级逻辑
 *
 * @param query 查询条件
 * @returns 用户对象或 null
 */
export async function findUserFromMongoOrDb(
  query: Partial<MockUser>,
): Promise<MockUser | null> {
  try {
    // 1. 优先从 MongoDB（L2）获取
    const mongoUser = await userMongoCollection.findOne(query);
    if (mongoUser) {
      return mongoUser;
    }
  } catch (error) {
    console.warn('[UserService] MongoDB 查询失败，降级到 MockTable:', error);
  }

  // 2. 降级到 MockTable（L1）
  return userTable.findOne(query) || null;
}

/**
 * 从 MongoDB（L2）按 ID 获取用户，降级到 MockTable（L1）
 *
 * @param id 用户 ID
 * @returns 用户对象或 null
 */
export async function findUserByIdFromMongoOrDb(
  id: number,
): Promise<MockUser | null> {
  try {
    // 1. 优先从 MongoDB（L2）获取
    const mongoUser = await userMongoCollection.findOne({ id });
    if (mongoUser) {
      return mongoUser;
    }
  } catch (error) {
    console.warn('[UserService] MongoDB 查询失败，降级到 MockTable:', error);
  }

  // 2. 降级到 MockTable（L1）
  return userTable.findById(id) || null;
}

// ==================== 用户服务类 ====================

// ==================== 普通用户服务类 ====================

class UserService {
  // ==================== 认证相关 ====================

  /** 登录 */
  async login(
    data: LoginRequest,
  ): Promise<{ token: string; user: Omit<MockUser, 'password'> }> {
    // 1. 按用户名查询用户（优先从 MongoDB L2，降级到 MockTable L1）
    // 【注意】密码已加密存储，不能直接用密码查询，需要查询后解密比较
    const user = await findUserFromMongoOrDb({
      username: data.username,
    });

    if (!user) {
      throw new BusinessError('用户名或密码错误', 401);
    }

    // 2. 验证密码（解密存储的加密密码，与用户输入比较）
    // 使用恒定时间比较，防止时序攻击
    if (!verifyPassword(data.password, user.password)) {
      throw new BusinessError('用户名或密码错误', 401);
    }

    if (user.status !== 'active') {
      throw new BusinessError('账号已被禁用，请联系管理员', 403);
    }

    // 2. 更新最后登录时间（同时更新 L1 MockTable 和 L2 MongoDB，保持数据一致）
    const lastLogin = new Date().toLocaleString('zh-CN', { hour12: false });
    userTable.updateById(user.id, { last_login: lastLogin });
    await userMongoCollection.updateOne(
      { id: user.id },
      { $set: { last_login: lastLogin } },
    );

    // 3. 生成 token
    const token = generateToken(user.id);

    return {
      token,
      user: sanitizeUser(user),
    };
  }

  /** 退出登录（从 Redis 删除 token） */
  async logout(req: Request): Promise<null> {
    const token = getTokenFromRequest(req);
    if (token) {
      tokenCache.del(token);
    }
    return null;
  }

  /** 获取当前用户信息（带缓存，使用 Redis + MongoDB 分层） */
  async getCurrentUser(userId: number): Promise<Omit<MockUser, 'password'>> {
    // 先查 Redis 缓存（L3）
    let cachedUser = userCache.get<MockUser>(String(userId));
    if (!cachedUser) {
      // 缓存未命中，优先从 MongoDB（L2）获取，降级到 MockTable（L1）
      cachedUser = await findUserByIdFromMongoOrDb(userId);
      if (cachedUser) {
        // 写入 Redis 缓存
        userCache.set(String(userId), cachedUser);
      }
    }

    if (!cachedUser) {
      throw new BusinessError('用户不存在', 401);
    }

    return sanitizeUser(cachedUser);
  }

  // ==================== 注册相关 ====================

  /** 注册 */
  async register(
    data: RegisterRequest,
  ): Promise<{ id: number; username: string }> {
    // 1. 检查用户名是否已存在（布隆过滤器优化 + MongoDB 优先查询）
    // 【性能优化】先查布隆过滤器，"一定不存在"时直接通过，避免查询数据库
    if (usernameMayExist(data.username)) {
      // 布隆过滤器说"可能存在"，需要查数据库确认（防止误判）
      // 优先从 MongoDB L2 查询，降级到 MockTable L1
      const existUser = await findUserFromMongoOrDb({
        username: data.username,
      });
      if (existUser) {
        throw new BusinessError('该用户名已被注册');
      }
    }

    // 2. 检查邮箱是否已存在（布隆过滤器优化 + MongoDB 优先查询）
    if (emailMayExist(data.email)) {
      // 布隆过滤器说"可能存在"，需要查数据库确认（防止误判）
      // 优先从 MongoDB L2 查询，降级到 MockTable L1
      const existUser = await findUserFromMongoOrDb({ email: data.email });
      if (existUser) {
        throw new BusinessError('该邮箱已被注册');
      }
    }

    // 3. 创建新用户（同时写入 L1 MockTable 和 L2 MongoDB）
    // 【安全】密码使用 AES-256-GCM 加密后存储，不保存明文
    const encryptedPassword = encryptPassword(data.password);
    const newUser = userTable.create({
      username: data.username,
      password: encryptedPassword,
      nickname: data.username,
      email: data.email,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.username}`,
      is_staff: false,
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
    addUsernameToBloom(newUser.username);
    addEmailToBloom(newUser.email);

    // 5. 失效用户列表缓存（新用户加入，列表数据已变更）
    userListCache.invalidateAll();

    return {
      id: newUser.id,
      username: newUser.username,
    };
  }

  // ==================== 密码重置相关 ====================

  /** 发送重置密码验证码（存储到 Redis 命名空间，5 分钟过期） */
  async sendResetCode(email: string): Promise<null> {
    // 1. 检查邮箱是否已注册（布隆过滤器快速判断 + 三级降级精确查询）
    // 1.1 布隆过滤器快速判断（O(1)，内存操作，无网络开销）
    // 布隆过滤器特点：说"不存在"就一定不存在；说"可能存在"需要精确查询确认
    if (!emailMayExist(email)) {
      throw new BusinessError('该邮箱未注册', 404);
    }

    // 1.2 布隆过滤器说"可能存在"，进行精确查询（优先 MongoDB L2，降级 MockTable L1）
    const user = await findUserFromMongoOrDb({ email });
    if (!user) {
      // 布隆过滤器误判（假阳性），实际不存在
      throw new BusinessError('该邮箱未注册', 404);
    }

    // 2. 生成验证码（模拟：固定为 123456，方便测试）
    const code = '123456';
    // 存储到 Redis 命名空间，TTL 自动过期，不需要手动管理 expireAt
    resetCodeCache.set(email, code);

    // 3. 模拟发送邮件
    console.log(`[Mock] 已向 ${email} 发送验证码：${code}`);

    return null;
  }

  /** 重置密码（从 Redis 读取验证码，自动检查过期） */
  async resetPassword(data: ResetPasswordRequest): Promise<null> {
    // 1. 验证验证码（从 Redis 读取，自动检查过期）
    const code = resetCodeCache.get<string>(data.email);
    if (!code) {
      throw new BusinessError('请先获取验证码或验证码已过期');
    }

    if (code !== data.code) {
      throw new BusinessError('验证码错误');
    }

    // 2. 更新密码（同时更新 L1 MockTable 和 L2 MongoDB，保持数据一致）
    // 【安全】新密码使用 AES-256-GCM 加密后存储
    const user = await findUserFromMongoOrDb({ email: data.email });
    if (user) {
      const encryptedPassword = encryptPassword(data.new_password);
      userTable.updateById(user.id, { password: encryptedPassword });
      await userMongoCollection.updateOne(
        { id: user.id },
        { $set: { password: encryptedPassword } },
      );
      clearUserCache(user.id);
    }

    // 3. 清除验证码
    resetCodeCache.del(data.email);

    return null;
  }

  // ==================== 个人中心相关 ====================

  /** 更新个人资料 */
  async updateProfile(
    userId: number,
    data: UpdateProfileRequest,
  ): Promise<Omit<MockUser, 'password'>> {
    const updateData: Partial<MockUser> = {};
    if (data.nickname !== undefined) updateData.nickname = data.nickname;
    if (data.avatar !== undefined) updateData.avatar = data.avatar;

    // 邮箱变更时，检查新邮箱是否被其他用户使用（布隆过滤器优化）
    if (data.email !== undefined) {
      // 查询优先从缓存（L3），再到 MongoDB L2，降级到 MockTable L1
      // 使用 getOrSet 模式：缓存命中直接返回，未命中时自动查询并写入缓存
      const currentUser = await userCache.getOrSet<MockUser>(
        String(userId),
        async () => await findUserByIdFromMongoOrDb(userId),
      );
      if (currentUser && data.email !== currentUser.email) {
        if (emailMayExist(data.email)) {
          // 优先从 MongoDB L2 查询，降级到 MockTable L1
          const existUser = await findUserFromMongoOrDb({ email: data.email });
          if (existUser) {
            throw new BusinessError('邮箱已被使用');
          }
        }
        // 邮箱变更后，将新邮箱添加到布隆过滤器
        addEmailToBloom(data.email);
      }
      updateData.email = data.email;
    }

    const updatedUser = userTable.updateById(userId, updateData);

    // 同步更新 MongoDB L2（保持数据一致）
    if (Object.keys(updateData).length > 0) {
      await userMongoCollection.updateOne({ id: userId }, { $set: updateData });
    }

    // 清除用户缓存
    clearUserCache(userId);

    return sanitizeUser(updatedUser!);
  }

  /** 修改密码 */
  async changePassword(
    userId: number,
    data: ChangePasswordRequest,
  ): Promise<null> {
    // 查询优先从 MongoDB L2，降级到 MockTable L1
    const user = await findUserByIdFromMongoOrDb(userId);
    if (!user) {
      throw new BusinessError('用户不存在');
    }

    // 验证原密码（解密存储的加密密码，与用户输入比较）
    if (!verifyPassword(data.old_password, user.password)) {
      throw new BusinessError('原密码错误');
    }

    // 【安全】新密码使用 AES-256-GCM 加密后存储
    const encryptedPassword = encryptPassword(data.new_password);
    userTable.updateById(userId, { password: encryptedPassword });
    // 同步更新 MongoDB L2
    await userMongoCollection.updateOne(
      { id: userId },
      { $set: { password: encryptedPassword } },
    );
    clearUserCache(userId);

    return null;
  }

  // ==================== 编辑器设置相关 ====================

  /** 获取编辑器设置（从完整用户缓存中提取，不独立缓存） */
  async getEditorSettings(userId: number): Promise<MockEditorSettings> {
    // 从 userCache 获取完整用户信息（缓存未命中时优先从 MongoDB L2，降级到 MockTable L1）
    const user = await userCache.getOrSet<MockUser>(
      String(userId),
      async () => await findUserByIdFromMongoOrDb(userId),
    );

    if (!user) {
      throw new BusinessError('用户不存在', 404);
    }

    // 从完整用户信息中提取编辑器设置子集
    return {
      editor: user.editor,
      autosave: user.autosave,
      livepreview: user.livepreview,
    };
  }

  /** 保存编辑器设置 */
  async saveEditorSettings(
    userId: number,
    data: SaveEditorSettingsRequest,
  ): Promise<MockEditorSettings> {
    // 写入扁平字段（同时更新 L1 MockTable 和 L2 MongoDB）
    const editorUpdateData = {
      editor: data.editor,
      autosave: !!data.autosave,
      livepreview: !!data.livepreview,
    };
    userTable.updateById(userId, editorUpdateData);
    await userMongoCollection.updateOne(
      { id: userId },
      { $set: editorUpdateData },
    );

    // 清除用户缓存（编辑器设置包含在完整用户缓存中，下次查询自动回源获取最新数据）
    clearUserCache(userId);

    return {
      editor: data.editor,
      autosave: !!data.autosave,
      livepreview: !!data.livepreview,
    };
  }
}

export const userService = new UserService();
