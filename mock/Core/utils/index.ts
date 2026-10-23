/**
 * Core 层通用工具函数统一导出
 *
 * 【工具分组】
 * - mongodb: MongoDB 相关工具（降级查询 findFromMongoOrDb / findByIdFromMongoOrDb）
 * - bloom: 布隆过滤器工具（通用函数 + 实例工厂 createBloomFilter）
 * - transform: 数据转换工具（基础类型转换 + Hash 转换工厂 createHashConverter）
 * - crypto: 加密与 ID 生成工具（密码加密/验证、UUID/短ID生成）
 * - redis: Redis 通用工具（SCAN 迭代获取键、批量前缀查询、缓存失效）
 * - tree: 树形数据计算工具（泛型 computeTreeCacheData，用于分类缓存预计算）
 * - validator: 通用校验工具（邮箱/用户名格式、密码强度）
 *
 * 【扩展说明】
 * 未来新增工具函数时，按功能创建独立文件（如 cache.ts、date.ts 等），
 * 并在此处统一导出，保持目录结构清晰。
 */

// MongoDB 相关工具
export {
  findFromMongoOrDb,
  findByIdFromMongoOrDb,
} from './mongodb';

// 布隆过滤器工具
export {
  // 类型
  type BloomFilterConfig,
  type BloomFilter,
  // 实例工厂
  createBloomFilter,
  // 通用函数
  bloomMayExist,
  bloomAdd,
  bloomBatchAdd,
  bloomInfo,
  bloomReserve,
} from './bloom';

// 数据转换工具
export {
  // 基础类型转换
  toNumber,
  toString,
  toUndefinable,
  toBoolean,
  parseJSON,
  // Hash 转换工厂
  createHashConverter,
} from './transform';

// 加密与 ID 生成工具
export {
  // 密码加密/解密/验证
  encryptPassword,
  decryptPassword,
  verifyPassword,
  isEncryptedPassword,
  // UUID / ID 生成
  generateUUID,
  generatePrefixedId,
  generateShortId,
  generateRandomString,
} from './crypto';

// Redis 通用工具
export {
  scanAllKeys,
  scanAllKeysByPrefixes,
  invalidateCacheAll,
  invalidateCacheAllByScan,
} from './redis';

// 树形数据计算工具
export {
  // 类型
  type TreeCacheData,
  type TreeCacheOptions,
  // 通用函数
  computeTreeCacheData,
} from './tree';

// 通用校验工具
export {
  isValidEmail,
  isValidUsername,
  getPasswordStrength,
} from './validator';
