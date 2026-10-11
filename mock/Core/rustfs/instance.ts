/**
 * RustFS 全局实例
 * 
 * 提供单例模式的全局RustFS实例和工厂函数
 */

import { MockRustFS } from './MockRustFS';
import type { RustFSConfig } from './types';

/**
 * 全局 RustFS 实例（单例模式）
 */
export const rustfs = new MockRustFS({
  cluster_name: 'note-fuse-rustfs-cluster',
  default_region: 'us-east-1',
  default_storage_class: 'STANDARD',
  default_acl: 'private',
  enable_cache: true,
  cache_ttl: 60000,
});

/**
 * 创建 RustFS 实例的工厂函数
 * 
 * @param config 配置
 * @returns RustFS 实例
 */
export function createRustFSInstance(config?: RustFSConfig): MockRustFS {
  return new MockRustFS(config);
}

/**
 * 获取全局 RustFS 实例
 * 
 * @returns 全局实例
 */
export function getRustFSInstance(): MockRustFS {
  return rustfs;
}

/**
 * 重置全局 RustFS 实例
 */
export function resetRustFSInstance(): void {
  rustfs.reset();
}
