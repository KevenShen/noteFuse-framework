/**
 * L6 监控运维 - 工具方法 Mixin
 * 包含：flushAll/flushExpired/size/keys/randomKey/stats/export/import
 *       scan/hscan/sscan/zscan（游标迭代）
 */
import type { MixinConstructor } from './mixin.types';
import { isExpired, patternToRegex } from '../utils';

/** SCAN 命令选项 */
export interface ScanOptions {
  /** 匹配模式（支持 * ? [abc] 通配符） */
  match?: string;
  /** 每次返回的元素数量提示（实际返回数量可能不同） */
  count?: number;
  /** 按类型过滤（仅 SCAN 支持） */
  type?: 'string' | 'hash' | 'list' | 'set' | 'zset';
}

/** SCAN 命令返回结果 */
export interface ScanResult<T = string> {
  /** 下一个游标（0 表示迭代结束） */
  cursor: number;
  /** 当前批次的元素列表 */
  elements: T[];
}

export function WithUtility<T extends MixinConstructor>(Base: T) {
  return class UtilityMixin extends Base {
    /** 清空所有缓存 */
    flushAll(): void {
      this.cache.clear();
      this.debugLog('FLUSHALL');
    }

    /** 清空过期缓存，返回删除的数量 */
    flushExpired(): number {
      let count = 0;
      for (const [key, item] of this.cache.entries()) {
        if (isExpired(item)) {
          this.cache.delete(key);
          count++;
        }
      }
      this.debugLog('FLUSHEXPIRED:', count, 'items removed');
      return count;
    }

    /** 获取缓存项数 */
    size(): number {
      return this.cache.size;
    }

    /** 获取所有 key（支持通配符模式） */
    keys(pattern?: string): string[] {
      const allKeys = Array.from(this.cache.keys());
      if (!pattern) return allKeys;
      const regex = patternToRegex(pattern);
      return allKeys.filter((key) => regex.test(key));
    }

    /** 随机获取一个 key */
    randomKey(): string | null {
      const keys = Array.from(this.cache.keys());
      if (keys.length === 0) return null;
      return keys[Math.floor(Math.random() * keys.length)];
    }

    // ==================== SCAN 系列游标迭代 ====================

    /**
     * SCAN - 迭代当前数据库中的键集合
     *
     * 【与 KEYS 的区别】
     * - KEYS：一次性返回所有匹配的键，数据量大时会阻塞
     * - SCAN：基于游标的增量式迭代，每次返回一小批，不会阻塞
     *
     * 【使用方式】
     * let cursor = 0;
     * do {
     *   const result = redis.scan(cursor, { match: 'user:*', count: 10 });
     *   console.log(result.elements);
     *   cursor = result.cursor;
     * } while (cursor !== 0);
     *
     * @param cursor 游标（0 表示开始新的迭代）
     * @param options 选项（match/count/type）
     * @returns 下一个游标和当前批次的键列表
     */
    scan(cursor: number, options?: ScanOptions): ScanResult<string> {
      const { match, count = 10, type } = options || {};

      // 获取所有未过期的键
      let allKeys = Array.from(this.cache.keys()).filter((key) => {
        const item = this.cache.get(key);
        return item && !isExpired(item);
      });

      // 按类型过滤
      if (type) {
        allKeys = allKeys.filter((key) => {
          const value = this.cache.get(key)?.value;
          if (!value) return false;
          switch (type) {
            case 'string':
              return typeof value !== 'object' || value === null;
            case 'hash':
              return typeof value === 'object' && !Array.isArray(value) && !(value instanceof Set) && !(value instanceof Map);
            case 'list':
              return Array.isArray(value);
            case 'set':
              return value instanceof Set;
            case 'zset':
              return value instanceof Map;
            default:
              return true;
          }
        });
      }

      // 按模式匹配
      if (match) {
        const regex = patternToRegex(match);
        allKeys = allKeys.filter((key) => regex.test(key));
      }

      // 基于游标分批返回
      const start = cursor;
      const end = Math.min(start + count, allKeys.length);
      const elements = allKeys.slice(start, end);
      const nextCursor = end >= allKeys.length ? 0 : end;

      this.debugLog('SCAN:', `cursor=${cursor}`, `returned=${elements.length}`, `next=${nextCursor}`);
      return { cursor: nextCursor, elements };
    }

    /**
     * HSCAN - 迭代哈希表中的键值对
     *
     * 【返回格式】
     * elements 是扁平数组：[field1, value1, field2, value2, ...]
     * 与 Redis 原生 HSCAN 返回格式一致
     *
     * @param key 哈希键
     * @param cursor 游标（0 表示开始新的迭代）
     * @param options 选项（match/count）
     * @returns 下一个游标和当前批次的字段值对（扁平数组）
     */
    hscan(key: string, cursor: number, options?: Omit<ScanOptions, 'type'>): ScanResult<any> {
      const hash = this.get<Record<string, any>>(key);
      if (!hash || typeof hash !== 'object') {
        return { cursor: 0, elements: [] };
      }

      const { match, count = 10 } = options || {};

      // 获取所有字段
      let fields = Object.keys(hash);

      // 按模式匹配字段名
      if (match) {
        const regex = patternToRegex(match);
        fields = fields.filter((field) => regex.test(field));
      }

      // 基于游标分批返回（扁平数组：[field1, value1, field2, value2, ...]）
      const start = cursor;
      const end = Math.min(start + count, fields.length);
      const elements: any[] = [];
      for (let i = start; i < end; i++) {
        elements.push(fields[i], hash[fields[i]]);
      }
      const nextCursor = end >= fields.length ? 0 : end;

      this.debugLog('HSCAN:', `key=${key}`, `cursor=${cursor}`, `returned=${elements.length / 2}`, `next=${nextCursor}`);
      return { cursor: nextCursor, elements };
    }

    /**
     * SSCAN - 迭代集合中的元素
     *
     * @param key 集合键
     * @param cursor 游标（0 表示开始新的迭代）
     * @param options 选项（match/count）
     * @returns 下一个游标和当前批次的成员列表
     */
    sscan(key: string, cursor: number, options?: Omit<ScanOptions, 'type'>): ScanResult<any> {
      const set = this.get<Set<any>>(key);
      if (!set || !(set instanceof Set)) {
        return { cursor: 0, elements: [] };
      }

      const { match, count = 10 } = options || {};

      // 获取所有成员
      let members = Array.from(set);

      // 按模式匹配（仅对字符串成员有效）
      if (match) {
        const regex = patternToRegex(match);
        members = members.filter((member) =>
          typeof member === 'string' ? regex.test(member) : true,
        );
      }

      // 基于游标分批返回
      const start = cursor;
      const end = Math.min(start + count, members.length);
      const elements = members.slice(start, end);
      const nextCursor = end >= members.length ? 0 : end;

      this.debugLog('SSCAN:', `key=${key}`, `cursor=${cursor}`, `returned=${elements.length}`, `next=${nextCursor}`);
      return { cursor: nextCursor, elements };
    }

    /**
     * ZSCAN - 迭代有序集合中的元素和分数
     *
     * 【返回格式】
     * elements 是扁平数组：[member1, score1, member2, score2, ...]
     * 与 Redis 原生 ZSCAN 返回格式一致
     *
     * @param key 有序集合键
     * @param cursor 游标（0 表示开始新的迭代）
     * @param options 选项（match/count）
     * @returns 下一个游标和当前批次的成员分数对（扁平数组）
     */
    zscan(key: string, cursor: number, options?: Omit<ScanOptions, 'type'>): ScanResult<any> {
      const zset = this.getZSet(key);
      if (!zset) {
        return { cursor: 0, elements: [] };
      }

      const { match, count = 10 } = options || {};

      // 获取所有成员
      let members = Array.from(zset.keys());

      // 按模式匹配（仅对字符串成员有效）
      if (match) {
        const regex = patternToRegex(match);
        members = members.filter((member) =>
          typeof member === 'string' ? regex.test(member) : true,
        );
      }

      // 基于游标分批返回（扁平数组：[member1, score1, member2, score2, ...]）
      const start = cursor;
      const end = Math.min(start + count, members.length);
      const elements: any[] = [];
      for (let i = start; i < end; i++) {
        elements.push(members[i], zset.get(members[i]));
      }
      const nextCursor = end >= members.length ? 0 : end;

      this.debugLog('ZSCAN:', `key=${key}`, `cursor=${cursor}`, `returned=${elements.length / 2}`, `next=${nextCursor}`);
      return { cursor: nextCursor, elements };
    }

    /** 获取缓存统计信息 */
    stats(): {
      totalKeys: number;
      expiredKeys: number;
      memoryUsage: string;
      hitRate: number;
    } {
      let expiredCount = 0;
      let totalAccess = 0;

      for (const item of this.cache.values()) {
        if (isExpired(item)) expiredCount++;
        totalAccess += item.accessCount;
      }

      return {
        totalKeys: this.cache.size,
        expiredKeys: expiredCount,
        memoryUsage: `${(this.cache.size * 0.1).toFixed(2)}KB (estimated)`,
        hitRate: totalAccess > 0 ? 100 : 0,
      };
    }

    /** 导出缓存数据（用于持久化） */
    export(): Array<{ key: string; value: any; expireAt: number | null }> {
      return Array.from(this.cache.entries()).map(([key, item]) => ({
        key,
        value: item.value,
        expireAt: item.expireAt,
      }));
    }

    /** 导入缓存数据（用于恢复） */
    import(
      data: Array<{ key: string; value: any; expireAt: number | null }>,
    ): void {
      data.forEach(({ key, value, expireAt }) => {
        const ttl = expireAt ? expireAt - Date.now() : undefined;
        if (ttl === undefined || ttl > 0) {
          this.set(key, value, ttl);
        }
      });
    }
  };
}
