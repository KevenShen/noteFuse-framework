// mock/User/service.ts
// 用户服务层
// 职责：处理核心业务逻辑，通过 Repository 访问数据层
// 【服务层】只包含业务逻辑，返回纯数据，失败时抛出 BusinessError
// 【控制器层】负责捕获 BusinessError 并包装成统一响应格式
// 【数据层】封装在 user.repository.ts 中，服务层不直接操作存储

import type { Request } from 'express';
import { BusinessError } from '../../Core';
import {
  generateToken,
  getTokenFromRequest,
  sanitizeUser,
} from '../../Core/auth';
import { CommonErrorCodes, UserErrorCodes } from '../../Core/errorCodes';
import { encryptPassword, verifyPassword } from '../../Core/utils';
import type { MockEditorSettings, MockUser } from '../../Entities/user';
import { defaultEditorSettings } from '../../Entities/user';
import type {
  ChangePasswordRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  SaveEditorSettingsRequest,
  UpdateProfileRequest,
} from './user.dto';
import { userRepository } from './user.repository';

// ============================================================================
// 普通用户服务类
// ============================================================================

class UserService {
  // ==================== 认证相关 ====================

  /** 登录 */
  async login(
    data: LoginRequest,
  ): Promise<{ token: string; user: Omit<MockUser, 'password'> }> {
    // 1. 按用户名查询用户（通过 Repository 三级降级查询）
    // 【注意】密码已加密存储，不能直接用密码查询，需要查询后解密比较
    const user = await userRepository.findByUsername(data.username);

    if (!user) {
      throw new BusinessError('用户名或密码错误', UserErrorCodes.LOGIN_FAILED);
    }

    // 2. 验证密码（解密存储的加密密码，与用户输入比较）
    // 使用恒定时间比较，防止时序攻击
    if (!verifyPassword(data.password, user.password)) {
      throw new BusinessError('用户名或密码错误', UserErrorCodes.LOGIN_FAILED);
    }

    if (user.status !== 'active') {
      throw new BusinessError(
        '账号已被禁用，请联系管理员',
        UserErrorCodes.ACCOUNT_DISABLED,
      );
    }

    // 3. 更新最后登录时间（通过 Repository 双写更新）
    const lastLogin = new Date().toLocaleString('zh-CN', { hour12: false });
    await userRepository.update(user.id, { last_login: lastLogin });

    // 4. 生成 token
    const token = generateToken(user.id);

    return {
      token,
      user: sanitizeUser(user),
    };
  }

  /** 退出登录（通过 Repository 删除 token） */
  async logout(req: Request): Promise<null> {
    const token = getTokenFromRequest(req);
    if (token) {
      await userRepository.deleteToken(token);
    }
    return null;
  }

  // ==================== 注册相关 ====================

  /** 注册 */
  async register(
    data: RegisterRequest,
  ): Promise<{ id: number; username: string }> {
    // 1. 检查用户名是否已存在（布隆过滤器优化 + Repository 精确查询）
    // 【性能优化】先查布隆过滤器，"一定不存在"时直接通过，避免查询数据库
    if (await userRepository.mayUsernameExist(data.username)) {
      // 布隆过滤器说"可能存在"，需要查数据库确认（防止误判）
      const existUser = await userRepository.findByUsername(data.username);
      if (existUser) {
        throw new BusinessError(
          '该用户名已被注册',
          UserErrorCodes.USERNAME_EXISTS,
        );
      }
    }

    // 2. 检查邮箱是否已存在（布隆过滤器优化 + Repository 精确查询）
    if (await userRepository.mayEmailExist(data.email)) {
      const existUser = await userRepository.findByEmail(data.email);
      if (existUser) {
        throw new BusinessError('该邮箱已被注册', UserErrorCodes.EMAIL_EXISTS);
      }
    }

    // 3. 创建新用户（通过 Repository 双写：MockTable + MongoDB）
    // 【安全】密码使用 AES-256-GCM 加密后存储，不保存明文
    const encryptedPassword = encryptPassword(data.password);
    const newUser = await userRepository.create({
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

    // 4. 将新用户的 username 和 email 添加到布隆过滤器
    await userRepository.addUsername(newUser.username);
    await userRepository.addEmail(newUser.email);

    // 5. 失效用户列表缓存（新用户加入，列表数据已变更）
    await userRepository.invalidateUserListCache();

    return {
      id: newUser.id,
      username: newUser.username,
    };
  }

  // ==================== 密码重置相关 ====================

  /** 发送重置密码验证码（存储到 Redis 命名空间，5 分钟过期） */
  async sendResetCode(email: string): Promise<null> {
    // 1. 检查邮箱是否已注册（布隆过滤器快速判断 + Repository 精确查询）
    // 1.1 布隆过滤器快速判断（O(1)，内存操作，无网络开销）
    // 布隆过滤器特点：说"不存在"就一定不存在；说"可能存在"需要精确查询确认
    if (!await userRepository.mayEmailExist(email)) {
      throw new BusinessError(
        '该邮箱未注册',
        UserErrorCodes.EMAIL_NOT_REGISTERED,
      );
    }

    // 1.2 布隆过滤器说"可能存在"，进行精确查询
    const user = await userRepository.findByEmail(email);
    if (!user) {
      // 布隆过滤器误判（假阳性），实际不存在
      throw new BusinessError(
        '该邮箱未注册',
        UserErrorCodes.EMAIL_NOT_REGISTERED,
      );
    }

    // 2. 生成验证码（模拟：固定为 123456，方便测试）
    const code = '123456';
    // 存储到 Redis 命名空间，TTL 自动过期
    await userRepository.setResetCode(email, code);

    // 3. 模拟发送邮件
    console.log(`[Mock] 已向 ${email} 发送验证码：${code}`);

    return null;
  }

  /** 重置密码（从 Redis 读取验证码，自动检查过期） */
  async resetPassword(data: ResetPasswordRequest): Promise<null> {
    // 1. 验证验证码（通过 Repository 从 Redis 读取，自动检查过期）
    const code = await userRepository.getResetCode(data.email);
    if (!code) {
      throw new BusinessError(
        '请先获取验证码或验证码已过期',
        UserErrorCodes.VERIFY_CODE_EXPIRED,
      );
    }
    if (code !== data.code) {
      throw new BusinessError('验证码错误', UserErrorCodes.VERIFY_CODE_ERROR);
    }

    // 2. 查询用户并更新密码
    const user = await userRepository.findByEmail(data.email);
    if (user) {
      // 新密码与原密码相同时直接返回，避免不必要的 IO
      if (verifyPassword(data.new_password, user.password)) {
        throw new BusinessError(
          '新密码不能与原密码相同',
          UserErrorCodes.PASSWORD_SAME_AS_OLD,
        );
      }

      // 【安全】新密码使用 AES-256-GCM 加密后存储
      const encryptedPassword = encryptPassword(data.new_password);
      await userRepository.update(user.id, { password: encryptedPassword });
    }

    // 3. 清除验证码
    await userRepository.deleteResetCode(data.email);

    return null;
  }

  // ==================== 个人中心相关 ====================

  /** 更新个人资料 */
  async updateProfile(
    currentUser: MockUser,
    data: UpdateProfileRequest,
  ): Promise<Omit<MockUser, 'password'>> {
    // 相同数据校验：只比较传入的字段，完全相同则抛出错误，避免不必要的 IO
    const isSame = Object.entries(data).every(
      ([key, value]) => currentUser[key as keyof MockUser] === value,
    );
    if (isSame) {
      throw new BusinessError(
        '数据无变化，不需要修改',
        CommonErrorCodes.DATA_NO_CHANGE,
      );
    }

    // 直接展开请求数据（UpdateProfileRequest 只含 nickname/avatar/email 三个可选字段）
    const updateData: Partial<MockUser> = { ...data };

    // 邮箱变更时，检查新邮箱是否被其他用户使用（布隆过滤器优化）
    if (data.email !== undefined && data.email !== currentUser.email) {
      if (await userRepository.mayEmailExist(data.email)) {
        const existUser = await userRepository.findByEmail(data.email);
        if (existUser) {
          throw new BusinessError('邮箱已被使用', UserErrorCodes.EMAIL_EXISTS);
        }
      }
      // 邮箱变更后，将新邮箱添加到布隆过滤器
      await userRepository.addEmail(data.email);
    }

    // 通过 Repository 双写更新
    const updatedUser = await userRepository.update(currentUser.id, updateData);

    // 清除用户缓存
    await userRepository.clearUserCache(currentUser.id);

    return sanitizeUser(updatedUser!);
  }

  /** 修改密码 */
  async changePassword(
    userId: number,
    data: ChangePasswordRequest,
  ): Promise<null> {
    // 通过 Repository 按 ID 查询用户
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new BusinessError('用户不存在', UserErrorCodes.USER_NOT_FOUND);
    }

    // 验证原密码（解密存储的加密密码，与用户输入比较）
    if (!verifyPassword(data.old_password, user.password)) {
      throw new BusinessError('原密码错误', UserErrorCodes.OLD_PASSWORD_ERROR);
    }

    // 新密码与原密码相同时直接返回，避免不必要的 IO
    if (verifyPassword(data.new_password, user.password)) {
      throw new BusinessError(
        '新密码不能与原密码相同',
        UserErrorCodes.PASSWORD_SAME_AS_OLD,
      );
    }

    // 【安全】新密码使用 AES-256-GCM 加密后存储
    const encryptedPassword = encryptPassword(data.new_password);
    await userRepository.update(userId, { password: encryptedPassword });

    return null;
  }

  // ==================== 编辑器设置相关 ====================

  /** 获取编辑器设置（直接从 authMiddleware 挂载的 currentUser 中提取，无需查询缓存） */
  getEditorSettings(currentUser: MockUser): MockEditorSettings {
    // 从完整用户信息中提取编辑器设置子集
    return {
      editor: currentUser.editor,
      autosave: currentUser.autosave,
      livepreview: currentUser.livepreview,
    };
  }

  /** 保存编辑器设置 */
  async saveEditorSettings(
    currentUser: MockUser,
    data: SaveEditorSettingsRequest,
  ): Promise<MockEditorSettings> {
    // 相同数据校验：只比较传入的字段，完全相同则抛出错误，避免不必要的 IO
    const isSame = Object.entries(data).every(
      ([key, value]) => currentUser[key as keyof MockUser] === value,
    );
    if (isSame) {
      throw new BusinessError(
        '数据无变化，不需要修改',
        CommonErrorCodes.DATA_NO_CHANGE,
      );
    }

    // 只更新传入的字段（autosave/livepreview 未传入时不修改）
    const updateData: Partial<MockEditorSettings> = { ...data };

    // 通过 Repository 双写更新（同时更新 L1 MockTable 和 L2 MongoDB）
    await userRepository.update(currentUser.id, updateData);

    // 清除用户缓存（编辑器设置包含在完整用户缓存中，下次查询自动回源获取最新数据）
    await userRepository.clearUserCache(currentUser.id);

    // 返回合并后的完整设置
    return {
      editor: updateData.editor ?? currentUser.editor,
      autosave: updateData.autosave ?? currentUser.autosave,
      livepreview: updateData.livepreview ?? currentUser.livepreview,
    };
  }
}

// ============================================================================
// 导出服务实例
// ============================================================================
export const userService = new UserService();
