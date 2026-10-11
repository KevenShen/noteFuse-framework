/**
 * L1 数据结构 - 字符串操作 Mixin
 * 包含：set/get/getDel/setIfNotExists/setIfExists
 */
import type { MixinConstructor } from './mixin.types';

export function WithString<T extends MixinConstructor>(Base: T) {
  return class StringMixin extends Base {
    /** 设置缓存 */
    set<T = any>(key: string, value: T, ttl?: number): void {
      this.evictIfNeeded();
      this.cache.set(key, this.createCacheItem(value, ttl));
      this.totalCommandsProcessed++;
      this.debugLog('SET:', key, 'TTL:', ttl ?? 'none');
      
      // 记录 AOF
      this.recordAOF('set', [key, value, ttl]);
      
      // 触发键空间通知
      if (this.isNotificationEnabled('K') || this.isNotificationEnabled('E')) {
        this.notifyKeyspace('set', key);
      }
      
      // 复制到从节点
      this.replicateToSlaves('set', [key, value]);
    }

    /** 获取缓存 */
    get<T = any>(key: string): T | null {
      const item = this.getCacheItem(key);
      if (!item) return null;

      this.updateAccess(item);
      return item.value as T;
    }

    /** 获取并删除缓存（GETDEL） */
    getDel<T = any>(key: string): T | null {
      const item = this.getCacheItem(key);
      if (!item) return null;

      this.cache.delete(key);
      return item.value as T;
    }

    /** 设置缓存（仅当 key 不存在时），返回是否设置成功 */
    setIfNotExists<T = any>(key: string, value: T, ttl?: number): boolean {
      if (this.exists(key)) return false;
      this.set(key, value, ttl);
      return true;
    }

    /** 设置缓存（仅当 key 存在时），返回是否设置成功 */
    setIfExists<T = any>(key: string, value: T, ttl?: number): boolean {
      if (!this.exists(key)) return false;
      this.set(key, value, ttl);
      return true;
    }
  };
}
