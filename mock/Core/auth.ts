// mock/Core/auth.ts
// 认证相关核心逻辑
// 职责：提供当前用户获取函数
// 【核心层】避免循环依赖，将认证逻辑从 User/service 提取到 Core
// 【重要】使用 Entities/user.ts 导出的 userTable/tokenCache/userCache，保证数据和前缀一致

import type { Request } from 'express';
import {
  tokenCache,
  userCache,
  userMongoCollection,
  type MockUser,
} from '../Entities/user';
import { generateUUID } from './crypto';

// ==================== 认证工具函数 ====================

/**
 * 生成 Token（简单的 UUID 模拟）
 * 注意：实际生成 token 并存储到 tokenCache 的逻辑在 User/service.ts 的 generateToken 中
 * 此函数仅用于其他模块需要生成 token 字符串的场景
 */
export const generateToken = (userId: number): string => {
  const token = 'token_' + generateUUID();
  tokenCache.set(token, userId);
  return token;
};
/**
 * 从请求中获取 Token
 * 仅从 Authorization header 获取（支持 Token 和 Bearer 两种格式）
 * 出于安全考虑，不支持从 query 参数或 body 获取 token
 */
export const getTokenFromRequest = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  // 支持 "Token xxx" 格式（项目使用的格式）
  if (authHeader.startsWith('Token ')) {
    return authHeader.slice(6);
  }
  // 兼容 "Bearer xxx" 格式
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
};

/**
 * 根据 Token 获取当前用户
 * @param req Express 请求对象
 * @returns 用户对象（未登录返回 null）
 */
export const getCurrentUserFromToken = async (
  req: Request,
): Promise<MockUser | null> => {
  const token = getTokenFromRequest(req);
  if (!token) return null;

  // 从 tokenCache 中获取用户 ID（和 service.ts 中的 generateToken 使用同一个缓存实例）
  const userId = tokenCache.get<number>(token);
  if (!userId) return null;

  // 从 userCache 中获取用户信息（缓存穿透防护）
  const cacheKey = String(userId);
  const cachedUser = userCache.get<MockUser>(cacheKey);
  if (cachedUser) {
    return sanitizeUser(cachedUser);
  }

  // 缓存未命中，从 MongoDB 查询（L2 文档数据库）
  const user = await userMongoCollection.findOne({ id: userId });
  if (!user) return null;

  // 写入缓存（只存储脱敏后的用户信息，不包含密码，提升安全性）
  userCache.set(cacheKey, sanitizeUser(user));

  return sanitizeUser(user);
};

/**
 * 脱敏用户信息（移除密码等敏感字段）
 */
export const sanitizeUser = (user: MockUser): MockUser => {
  const { password, ...safeUser } = user;
  return safeUser as MockUser;
};
