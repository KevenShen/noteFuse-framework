/**
 * RustFS Mock 统一导出入口
 * 
 * 提供完整的对象存储模拟功能，包括：
 * - L1 基础层：存储桶管理、文件上传、文件下载、文件删除、文件元数据
 * - L2 操作层：文件操作、目录操作、批量操作
 * - L3 高级功能层：版本管理、分片上传/断点续传、文件预览
 * - L4 扩展功能层：权限管理、标签管理、生命周期管理、跨桶复制
 * - L5 运维管理层：存储统计、配额管理、集群管理、缓存管理
 * 
 * 使用方式：
 * import { MockRustFS, rustfs, createRustFS } from '@/mock/Core/rustfs';
 * 
 * // 使用全局实例
 * rustfs.createBucket('my-bucket');
 * rustfs.upload('my-bucket', 'file.txt', 'Hello World');
 * const result = rustfs.download('my-bucket', 'file.txt');
 * 
 * // 创建独立实例
 * const fs = new MockRustFS({ cluster_name: 'my-cluster' });
 * 
 * // 使用工厂函数
 * const fs2 = createRustFS({ cluster_name: 'another-cluster' });
 */

// ==================== 主类导出 ====================

import { MockRustFS } from './MockRustFS';

/** RustFS Mock 主类 */
export { MockRustFS };

/** RustFS Mock 基类（用于自定义扩展） */
export { MockRustFSBase } from './MockRustFSBase';

// ==================== 全局实例导出 ====================

/** 全局 RustFS 实例（单例模式） */
export { rustfs, createRustFSInstance, getRustFSInstance, resetRustFSInstance } from './instance';

/**
 * 创建 RustFS 实例的便捷函数
 * 
 * @param config 配置
 * @returns RustFS 实例
 */
export function createRustFS(config?: ConstructorParameters<typeof MockRustFS>[0]) {
  return new MockRustFS(config);
}

// ==================== 类型导出 ====================

export * from './types';

// ==================== 工具函数导出 ====================

export * from './utils';

// ==================== Mixin 导出 ====================

export * from './mixins';

// ==================== 便捷常量导出 ====================

/**
 * 默认 RustFS 配置
 */
export { DEFAULT_RUSTFS_CONFIG } from './types';

/**
 * 默认缓存配置
 */
export { DEFAULT_CACHE_CONFIG } from './utils';

/**
 * MIME类型映射表
 */
export { MIME_TYPE_MAP } from './utils';

/**
 * 存储类描述映射
 */
export { STORAGE_CLASS_DESCRIPTIONS } from './utils';

/**
 * 存储类成本系数
 */
export { STORAGE_CLASS_COST_FACTORS } from './utils';

/**
 * 存储类最小存储天数
 */
export { STORAGE_CLASS_MIN_DAYS } from './utils';

/**
 * 预定义ACL组
 */
export { PREDEFINED_ACL_GROUPS } from './types';

/**
 * ACL权限映射
 */
export { ACL_PERMISSION_MAP } from './types';

/**
 * 支持的存储类列表
 */
export const SUPPORTED_STORAGE_CLASSES = [
  'STANDARD',
  'STANDARD_IA',
  'ARCHIVE',
  'DEEP_ARCHIVE',
  'INTELLIGENT_TIERING',
  'REDUCED_REDUNDANCY',
  'GLACIER',
  'COLD',
] as const;

/**
 * 支持的ACL列表
 */
export const SUPPORTED_ACLS = [
  'private',
  'public-read',
  'public-read-write',
  'authenticated-read',
  'bucket-owner-read',
  'bucket-owner-full-control',
  'log-delivery-write',
] as const;

/**
 * 支持的缓存策略
 */
export const SUPPORTED_CACHE_STRATEGIES = [
  'LRU',
  'LFU',
  'FIFO',
  'RR',
] as const;

/**
 * 支持的缓存类型
 */
export const SUPPORTED_CACHE_TYPES = [
  'memory',
  'disk',
  'hybrid',
] as const;

/**
 * 集群健康状态
 */
export const CLUSTER_HEALTH_STATUS = {
  GREEN: 'green',
  YELLOW: 'yellow',
  RED: 'red',
} as const;

/**
 * 复制状态
 */
export const REPLICATION_STATUS = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REPLICA: 'REPLICA',
} as const;

/**
 * 对象锁定模式
 */
export const OBJECT_LOCK_MODES = {
  GOVERNANCE: 'GOVERNANCE',
  COMPLIANCE: 'COMPLIANCE',
} as const;

// ==================== 使用示例导出 ====================

/**
 * RustFS 使用示例
 * 
 * 包含12个完整的使用示例，展示RustFS的各种功能
 */
export * from './example';
