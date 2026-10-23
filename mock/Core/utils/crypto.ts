/**
 * 用户密码加密工具
 *
 * 【加密算法】AES-256-GCM
 * 【密钥长度】256 位（32 字节）
 * 【IV 长度】96 位（12 字节），每次加密随机生成
 * 【认证标签】GCM 模式自动生成，用于验证数据完整性
 *
 * 【密文格式】
 * base64(iv):base64(authTag):base64(encryptedData)
 * 三段用冒号分隔，便于存储和解析
 *
 * 【安全特性】
 * - 每次加密使用随机 IV，相同明文加密结果不同
 * - GCM 模式提供认证加密（AEAD），防止篡改
 * - 使用 Node.js 原生 crypto 模块，无外部依赖
 *
 * 【使用场景】
 * - register：加密用户密码后存储
 * - login：解密存储的密码，与用户输入比较
 * - changePassword：解密原密码验证，加密新密码存储
 * - resetPassword：加密新密码存储
 */

import { Buffer } from 'buffer';
import * as crypto from 'crypto';

/**
 * 加密密钥（256 位，32 字节）
 *
 * 【注意】
 * - 生产环境应从环境变量或密钥管理服务获取
 * - Mock 环境使用固定密钥，便于开发测试
 * - 密钥一旦设定不可更改，否则已加密的数据无法解密
 */
const ENCRYPTION_KEY = Buffer.from(
  process.env.USER_PASSWORD_ENCRYPTION_KEY ||
    'NoteFuse_User_Password_Encryption_Key_256bit!',
  'utf-8',
).subarray(0, 32); // 确保正好 32 字节（256 位）

/**
 * IV 长度（12 字节，96 位，GCM 推荐长度）
 */
const IV_LENGTH = 12;

/**
 * 拼接多个 Buffer（避免 Buffer.concat 类型问题）
 *
 * @param buffers 待拼接的 Buffer 数组
 * @returns 拼接后的 Buffer
 */
function concatBuffers(buffers: Buffer[]): Buffer {
  const totalLength = buffers.reduce((sum, b) => sum + b.length, 0);
  const result = Buffer.alloc(totalLength);
  let offset = 0;
  for (const buf of buffers) {
    result.set(buf, offset);
    offset += buf.length;
  }
  return result;
}

/**
 * 加密明文
 *
 * 【流程】
 * 1. 生成随机 IV
 * 2. 使用 AES-256-GCM 加密
 * 3. 获取认证标签
 * 4. 拼接为 "iv:authTag:encryptedData" 格式（base64 编码）
 *
 * @param plaintext 明文字符串
 * @returns 加密后的密文字符串
 */
export function encryptPassword(plaintext: string): string {
  // 1. 生成随机 IV
  const iv = crypto.randomBytes(IV_LENGTH);

  // 2. 创建 AES-256-GCM 加密器
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);

  // 3. 加密数据
  const encrypted = concatBuffers([
    cipher.update(plaintext, 'utf-8'),
    cipher.final(),
  ]);

  // 4. 获取认证标签
  const authTag = cipher.getAuthTag();

  // 5. 拼接为 "iv:authTag:encryptedData" 格式（base64 编码）
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * 解密密文
 *
 * 【流程】
 * 1. 解析 "iv:authTag:encryptedData" 格式
 * 2. 创建 AES-256-GCM 解密器
 * 3. 设置认证标签（验证数据完整性）
 * 4. 解密数据
 *
 * @param ciphertext 密文字符串
 * @returns 解密后的明文字符串
 * @throws 解密失败时抛出错误（密文格式错误、认证失败等）
 */
export function decryptPassword(ciphertext: string): string {
  try {
    // 1. 解析密文格式
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new Error('密文格式错误，应为 iv:authTag:encryptedData');
    }

    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const encrypted = Buffer.from(parts[2], 'base64');

    // 2. 创建 AES-256-GCM 解密器
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);

    // 3. 设置认证标签（验证数据完整性）
    decipher.setAuthTag(authTag);

    // 4. 解密数据
    const decrypted = concatBuffers([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf-8');
  } catch (error) {
    throw new Error(
      `密码解密失败: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * 验证密码是否匹配
 *
 * 【说明】
 * - 解密存储的密码，与用户输入的明文密码比较
 * - 使用恒定时间比较，防止时序攻击
 *
 * @param inputPassword 用户输入的明文密码
 * @param storedCiphertext 存储的加密密码
 * @returns 是否匹配
 */
export function verifyPassword(
  inputPassword: string,
  storedCiphertext: string,
): boolean {
  // 1. 判断存储的密码是否为加密格式
  if (isEncryptedPassword(storedCiphertext)) {
    // 加密格式：解密后比较
    try {
      const decrypted = decryptPassword(storedCiphertext);
      // 使用恒定时间比较，防止时序攻击
      return crypto.timingSafeEqual(
        Buffer.from(inputPassword, 'utf-8'),
        Buffer.from(decrypted, 'utf-8'),
      );
    } catch {
      // 解密失败（格式错误、认证失败等），返回 false
      return false;
    }
  }

  // 2. 兼容旧数据：明文密码直接比较
  // 【说明】旧用户的密码是明文存储的，迁移期间需要兼容
  // 【安全建议】建议在登录成功后自动将明文密码加密存储
  return inputPassword === storedCiphertext;
}

/**
 * 检查字符串是否为加密后的密码格式
 *
 * 【用途】
 * - 兼容旧数据：判断密码是否已加密
 * - 迁移时可用于识别需要加密的明文密码
 *
 * @param str 待检查的字符串
 * @returns 是否为加密密码格式
 */
export function isEncryptedPassword(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  const parts = str.split(':');
  // 加密格式：三段 base64，且第一段长度为 16（12 字节 base64 编码后为 16 字符）
  return (
    parts.length === 3 &&
    parts[0].length === 16 &&
    parts[1].length === 24 && // 16 字节 authTag base64 编码后为 24 字符
    parts[2].length > 0
  );
}

// ==================== UUID 生成 ====================

/**
 * 生成唯一 UUID（v4 版本）
 *
 * 【实现方式】
 * - 优先使用 Node.js 原生 crypto.randomUUID()（Node.js 14.17+）
 * - 降级方案：手动实现 v4 UUID（使用 crypto.randomBytes 生成随机数）
 *
 * 【UUID v4 格式】
 * xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * - 第 13 位固定为 4（版本号）
 * - 第 17 位为 8/9/a/b 之一（变体位）
 *
 * 【唯一性保证】
 * - 使用 122 位随机数，碰撞概率极低
 * - 每秒生成 10 亿个 UUID，100 年内碰撞概率约为 50%
 *
 * @returns UUID 字符串，例如："550e8400-e29b-41d4-a716-446655440000"
 */
export function generateUUID(): string {
  // 优先使用 Node.js 原生实现（更快、更安全）
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // 降级方案：手动实现 v4 UUID
  const bytes = crypto.randomBytes(16);

  // 设置版本号（第 7 字节高 4 位为 0100）
  bytes[6] = (bytes[6] & 0x0f) | 0x40;

  // 设置变体位（第 9 字节高 2 位为 10）
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  // 格式化为 UUID 字符串
  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/**
 * 生成带前缀的唯一 ID
 *
 * 【用途】
 * - 生成带业务前缀的唯一标识符，便于识别
 * - 例如："user_550e8400e29b41d4a716446655440000"
 *
 * @param prefix 前缀，例如 "user"、"doc"、"order"
 * @param separator 前缀与 UUID 之间的分隔符，默认 "_"
 * @returns 带前缀的唯一 ID
 */
export function generatePrefixedId(prefix: string, separator = '_'): string {
  const uuid = generateUUID().replace(/-/g, ''); // 去掉连字符，更简洁
  return `${prefix}${separator}${uuid}`;
}

/**
 * 生成短 ID（8 位，适合非关键场景）
 *
 * 【注意】
 * - 短 ID 碰撞概率高于完整 UUID
 * - 不适合作为全局唯一标识符
 * - 适合用于临时 ID、短链接、验证码等场景
 *
 * @param length ID 长度，默认 8 位
 * @returns 短 ID 字符串（小写字母 + 数字）
 */
export function generateShortId(length = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * 生成随机字符串（指定字符集）
 *
 * @param length 字符串长度
 * @param charset 字符集，默认大小写字母 + 数字
 * @returns 随机字符串
 */
export function generateRandomString(
  length: number,
  charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
): string {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[bytes[i] % charset.length];
  }
  return result;
}
