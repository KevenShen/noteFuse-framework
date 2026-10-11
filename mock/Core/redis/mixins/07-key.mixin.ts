/**
 * L2 键管理 - 键操作 Mixin
 * 包含：del/exists/expire/expireAt/persist/ttl/rename/type
 */
import type { MixinConstructor } from './mixin.types';

export function WithKey<T extends MixinConstructor>(Base: T) {
  return class KeyMixin extends Base {
    /** 删除缓存 */
    del(key: string): boolean {
      const result = this.cache.delete(key);
      this.totalCommandsProcessed++;
      this.debugLog('DEL:', key, result ? 'success' : 'not found');
      
      if (result) {
        // 记录 AOF
        this.recordAOF('del', [key]);
        
        // 触发键空间通知
        if (this.isNotificationEnabled('K') || this.isNotificationEnabled('E')) {
          this.notifyKeyspace('del', key);
        }
        
        // 复制到从节点
        this.replicateToSlaves('del', [key]);
      }
      
      return result;
    }

    /** 检查缓存是否存在 */
    exists(key: string): boolean {
      return this.getCacheItem(key) !== null;
    }

    /** 设置过期时间 */
    expire(key: string, ttl: number): boolean {
      const item = this.getCacheItem(key);
      if (!item) return false;
      item.expireAt = Date.now() + ttl;
      return true;
    }

    /** 设置过期时间（时间戳） */
    expireAt(key: string, timestamp: number): boolean {
      const item = this.getCacheItem(key);
      if (!item) return false;
      item.expireAt = timestamp;
      return true;
    }

    /** 移除过期时间（持久化） */
    persist(key: string): boolean {
      const item = this.getCacheItem(key);
      if (!item || item.expireAt === null) return false;
      item.expireAt = null;
      return true;
    }

    /** 获取剩余过期时间（毫秒） */
    ttl(key: string): number {
      const item = this.getCacheItem(key);
      if (!item) return -2; // key 不存在
      if (item.expireAt === null) return -1; // 永不过期
      const remaining = item.expireAt - Date.now();
      return remaining > 0 ? remaining : -2;
    }

    /** 重命名 key */
    rename(oldKey: string, newKey: string): boolean {
      const item = this.getCacheItem(oldKey);
      if (!item) return false;
      this.cache.delete(oldKey);
      this.cache.set(newKey, item);
      return true;
    }

    /** 获取 key 的数据类型 */
    type(key: string): string {
      const item = this.getCacheItem(key);
      if (!item) return 'none';
      
      const value = item.value;
      
      if (value === null || value === undefined) return 'string';
      if (typeof value === 'string') return 'string';
      if (typeof value === 'number' || typeof value === 'boolean') return 'string';
      if (Array.isArray(value)) return 'list';
      if (value instanceof Set) return 'set';
      if (value instanceof Map) return 'zset';
      if (typeof value === 'object') {
        // 判断是否为有序集合的旧格式（对象存储分数）
        // 这里简单判断为 hash，有序集合使用 Map 存储
        return 'hash';
      }
      
      return 'string';
    }
  };
}
