/**
 * 08 - 查询缓存 Mixin
 * 包含：clearCache、getCacheStats、getFromCache、setCache（LRU/TTL/自动失效）
 */
import type { FlatItem } from '../types/base.types';
import type { CacheStats } from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithQueryCache<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** 清除查询缓存 */
    clearCache(): void {
      (this as any).queryCache.clear();
      (this as any).cacheStats.hits = 0;
      (this as any).cacheStats.misses = 0;
    }

    /** 获取缓存统计 */
    getCacheStats(): CacheStats {
      const totalRequests = (this as any).cacheStats.hits + (this as any).cacheStats.misses;
      return {
        size: (this as any).queryCache.size,
        maxSize: (this as any).cacheMaxSize,
        hits: (this as any).cacheStats.hits,
        misses: (this as any).cacheStats.misses,
        hitRate: totalRequests > 0 ? (this as any).cacheStats.hits / totalRequests : 0,
        totalSizeBytes: this.estimateCacheSize(),
      };
    }

    /** 估算缓存大小（字节） */
    private estimateCacheSize(): number {
      let size = 0;
      for (const [, entry] of (this as any).queryCache) {
        size += JSON.stringify(entry).length;
      }
      return size;
    }

    /** 获取缓存（内部方法） */
    protected getFromCache(key: string): any | null {
      const entry = (this as any).queryCache.get(key);
      if (!entry) {
        (this as any).cacheStats.misses++;
        return null;
      }
      if (entry.ttl > 0 && Date.now() - entry.timestamp > entry.ttl) {
        (this as any).queryCache.delete(key);
        (this as any).cacheStats.misses++;
        return null;
      }
      (this as any).cacheStats.hits++;
      return entry.data;
    }

    /** 设置缓存（内部方法） */
    protected setCache(key: string, data: any[], ttl?: number): void {
      if ((this as any).queryCache.size >= (this as any).cacheMaxSize) {
        const oldestKey = (this as any).queryCache.keys().next().value;
        if (oldestKey) (this as any).queryCache.delete(oldestKey);
      }
      (this as any).queryCache.set(key, {
        data,
        timestamp: Date.now(),
        ttl: ttl || (this as any).cacheDefaultTTL,
        query: key,
      });
    }
  };
}
