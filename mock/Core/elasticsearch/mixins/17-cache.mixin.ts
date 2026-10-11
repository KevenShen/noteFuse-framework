/**
 * L5 运维管理层 - 缓存管理 Mixin
 * 
 * 包含：查询缓存、字段数据缓存、请求缓存、缓存统计、缓存清理等
 */

import type { MixinConstructor } from './mixin.types';
import type { Document } from '../types';

/**
 * 缓存管理 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithCache<T extends MixinConstructor>(Base: T) {
  return class CacheMixin extends Base {
    // ==================== 查询缓存 ====================

    /**
     * 缓存查询结果
     * 
     * @param cacheKey 缓存键
     * @param result 查询结果
     * @param ttl 过期时间（毫秒，默认60000）
     */
    cacheQueryResult(
      cacheKey: string,
      result: any,
      ttl: number = 60000,
    ): void {
      if (!(this as any).queryCache) {
        (this as any).queryCache = new Map();
      }

      (this as any).queryCache.set(cacheKey, {
        result,
        expireAt: Date.now() + ttl,
        hitCount: 0,
      });
    }

    /**
     * 获取缓存的查询结果
     * 
     * @param cacheKey 缓存键
     * @returns 缓存结果或 null
     */
    getCachedQueryResult(cacheKey: string): any | null {
      if (!(this as any).queryCache) return null;

      const cached = (this as any).queryCache.get(cacheKey);
      if (!cached) return null;

      // 检查是否过期
      if (Date.now() > cached.expireAt) {
        (this as any).queryCache.delete(cacheKey);
        return null;
      }

      cached.hitCount++;
      return cached.result;
    }

    /**
     * 生成查询缓存键
     * 
     * @param indexName 索引名
     * @param query 查询
     * @param options 选项
     * @returns 缓存键
     */
    generateCacheKey(
      indexName: string,
      query: any,
      options: any = {},
    ): string {
      const keyData = {
        index: indexName,
        query,
        options: {
          from: options.from,
          size: options.size,
          sort: options.sort,
          _source: options._source,
        },
      };
      return JSON.stringify(keyData);
    }

    /**
     * 使查询缓存失效
     * 
     * @param indexName 索引名（可选，不指定则失效所有缓存）
     */
    invalidateQueryCache(indexName?: string): void {
      if (!(this as any).queryCache) return;

      if (!indexName) {
        (this as any).queryCache.clear();
        return;
      }

      // 删除指定索引的缓存
      const keysToDelete: string[] = [];
      for (const key of (this as any).queryCache.keys()) {
        try {
          const parsed = JSON.parse(key);
          if (parsed.index === indexName) {
            keysToDelete.push(key);
          }
        } catch {
          // 忽略解析错误
        }
      }

      for (const key of keysToDelete) {
        (this as any).queryCache.delete(key);
      }
    }

    // ==================== 字段数据缓存 ====================

    /**
     * 缓存字段数据
     * 
     * @param indexName 索引名
     * @param fieldName 字段名
     * @param data 字段数据
     */
    cacheFieldData(
      indexName: string,
      fieldName: string,
      data: Map<string, any>,
    ): void {
      if (!(this as any).fieldDataCache) {
        (this as any).fieldDataCache = new Map();
      }

      const cacheKey = `${indexName}:${fieldName}`;
      (this as any).fieldDataCache.set(cacheKey, {
        data,
        loadedAt: Date.now(),
        size: data.size,
      });
    }

    /**
     * 获取缓存的字段数据
     * 
     * @param indexName 索引名
     * @param fieldName 字段名
     * @returns 字段数据或 null
     */
    getCachedFieldData(
      indexName: string,
      fieldName: string,
    ): Map<string, any> | null {
      if (!(this as any).fieldDataCache) return null;

      const cacheKey = `${indexName}:${fieldName}`;
      const cached = (this as any).fieldDataCache.get(cacheKey);
      return cached ? cached.data : null;
    }

    /**
     * 清除字段数据缓存
     * 
     * @param indexName 索引名（可选）
     * @param fieldName 字段名（可选）
     */
    clearFieldDataCache(indexName?: string, fieldName?: string): void {
      if (!(this as any).fieldDataCache) return;

      if (!indexName) {
        (this as any).fieldDataCache.clear();
        return;
      }

      if (fieldName) {
        const cacheKey = `${indexName}:${fieldName}`;
        (this as any).fieldDataCache.delete(cacheKey);
      } else {
        // 删除指定索引的所有字段数据
        const prefix = `${indexName}:`;
        const keysToDelete: string[] = [];
        for (const key of (this as any).fieldDataCache.keys()) {
          if (key.startsWith(prefix)) {
            keysToDelete.push(key);
          }
        }
        for (const key of keysToDelete) {
          (this as any).fieldDataCache.delete(key);
        }
      }
    }

    // ==================== 请求缓存 ====================

    /**
     * 缓存请求结果
     * 
     * @param cacheKey 缓存键
     * @param result 结果
     * @param ttl 过期时间（毫秒）
     */
    cacheRequest(
      cacheKey: string,
      result: any,
      ttl: number = 30000,
    ): void {
      if (!(this as any).requestCache) {
        (this as any).requestCache = new Map();
      }

      (this as any).requestCache.set(cacheKey, {
        result,
        expireAt: Date.now() + ttl,
      });
    }

    /**
     * 获取缓存的请求结果
     * 
     * @param cacheKey 缓存键
     * @returns 缓存结果或 null
     */
    getCachedRequest(cacheKey: string): any | null {
      if (!(this as any).requestCache) return null;

      const cached = (this as any).requestCache.get(cacheKey);
      if (!cached) return null;

      if (Date.now() > cached.expireAt) {
        (this as any).requestCache.delete(cacheKey);
        return null;
      }

      return cached.result;
    }

    // ==================== 缓存统计 ====================

    /**
     * 获取缓存统计信息
     * 
     * @returns 缓存统计信息
     */
    getCacheStats(): {
      query_cache: {
        size: number;
        hit_count: number;
        miss_count: number;
        evictions: number;
        memory_size_in_bytes: number;
      };
      field_data: {
        size: number;
        memory_size_in_bytes: number;
        evictions: number;
      };
      request_cache: {
        size: number;
        hit_count: number;
        miss_count: number;
        evictions: number;
        memory_size_in_bytes: number;
      };
    } {
      const queryCache = (this as any).queryCache || new Map();
      const fieldDataCache = (this as any).fieldDataCache || new Map();
      const requestCache = (this as any).requestCache || new Map();

      let queryHitCount = 0;
      let queryMemorySize = 0;
      for (const cached of queryCache.values()) {
        queryHitCount += cached.hitCount || 0;
        queryMemorySize += JSON.stringify(cached.result).length * 2;
      }

      let fieldDataMemorySize = 0;
      for (const cached of fieldDataCache.values()) {
        fieldDataMemorySize += cached.size * 1024;
      }

      let requestMemorySize = 0;
      for (const cached of requestCache.values()) {
        requestMemorySize += JSON.stringify(cached.result).length * 2;
      }

      return {
        query_cache: {
          size: queryCache.size,
          hit_count: queryHitCount,
          miss_count: 0,
          evictions: 0,
          memory_size_in_bytes: queryMemorySize,
        },
        field_data: {
          size: fieldDataCache.size,
          memory_size_in_bytes: fieldDataMemorySize,
          evictions: 0,
        },
        request_cache: {
          size: requestCache.size,
          hit_count: 0,
          miss_count: 0,
          evictions: 0,
          memory_size_in_bytes: requestMemorySize,
        },
      };
    }

    // ==================== 缓存清理 ====================

    /**
     * 清理过期缓存
     */
    cleanExpiredCache(): void {
      const now = Date.now();

      // 清理查询缓存
      if ((this as any).queryCache) {
        const keysToDelete: string[] = [];
        for (const [key, cached] of (this as any).queryCache) {
          if (now > cached.expireAt) {
            keysToDelete.push(key);
          }
        }
        for (const key of keysToDelete) {
          (this as any).queryCache.delete(key);
        }
      }

      // 清理请求缓存
      if ((this as any).requestCache) {
        const keysToDelete: string[] = [];
        for (const [key, cached] of (this as any).requestCache) {
          if (now > cached.expireAt) {
            keysToDelete.push(key);
          }
        }
        for (const key of keysToDelete) {
          (this as any).requestCache.delete(key);
        }
      }
    }

    /**
     * 清除所有缓存
     */
    clearAllCache(): void {
      if ((this as any).queryCache) {
        (this as any).queryCache.clear();
      }
      if ((this as any).fieldDataCache) {
        (this as any).fieldDataCache.clear();
      }
      if ((this as any).requestCache) {
        (this as any).requestCache.clear();
      }
    }

    // ==================== 缓存预热 ====================

    /**
     * 预热字段数据缓存
     * 
     * @param indexName 索引名
     * @param fieldName 字段名
     * @param docs 文档列表
     */
    warmupFieldDataCache(
      indexName: string,
      fieldName: string,
      docs: Document[],
    ): void {
      const fieldData = new Map<string, any>();

      for (const doc of docs) {
        const value = (this as any).getNestedValue(doc._source, fieldName);
        if (value !== undefined) {
          fieldData.set(doc._id, value);
        }
      }

      this.cacheFieldData(indexName, fieldName, fieldData);
    }
  };
}
