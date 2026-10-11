/**
 * L1 数据结构 - 有序集合操作 Mixin
 * 包含：zadd/zrem/zrange/zrevrange/zrangebyscore/zscore/zrank/zrevrank/zincrby/zcard/zcount/zremrangebyrank/zremrangebyscore
 */
import type { MixinConstructor } from './mixin.types';

export function WithSortedSet<T extends MixinConstructor>(Base: T) {
  return class SortedSetMixin extends Base {
    /** 有序集合元素（内部使用，但声明为公共以匹配接口类型） */
    getZSet(key: string): Map<any, number> | null {
      // 使用 any 类型避免 Mixin 组合模式下的泛型类型推断问题
      const data: any = this.get(key);
      if (data && data instanceof Map) return data as Map<any, number>;
      // 兼容旧格式（对象）
      if (data && typeof data === 'object' && !(data instanceof Map)) {
        const map = new Map<any, number>();
        for (const [member, score] of Object.entries(data)) {
          map.set(member, score as number);
        }
        return map;
      }
      return null;
    }

    saveZSet(key: string, zset: Map<any, number>): void {
      this.set(key, zset);
    }

    /** 添加一个或多个元素（带分数），返回添加的新元素数量 */
    zadd(key: string, ...members: Array<{ score: number; member: any }>): number {
      const zset = this.getZSet(key) ?? new Map<any, number>();
      let added = 0;
      for (const { score, member } of members) {
        if (!zset.has(member)) {
          added++;
        }
        zset.set(member, score);
      }
      this.saveZSet(key, zset);
      return added;
    }

    /** 移除一个或多个元素，返回移除的元素数量 */
    zrem(key: string, ...members: any[]): number {
      const zset = this.getZSet(key);
      if (!zset) return 0;
      
      let removed = 0;
      for (const member of members) {
        if (zset.delete(member)) {
          removed++;
        }
      }
      this.saveZSet(key, zset);
      return removed;
    }

    /** 按索引范围获取元素（升序），返回成员列表或带分数的列表 */
    zrange(key: string, start: number, stop: number, withScores?: boolean): any[] {
      const zset = this.getZSet(key);
      if (!zset) return [];
      
      // 按分数升序排序
      const sorted = Array.from(zset.entries()).sort((a, b) => {
        if (a[1] !== b[1]) return a[1] - b[1];
        return String(a[0]).localeCompare(String(b[0]));
      });
      
      const len = sorted.length;
      const normalizedStart = start < 0 ? Math.max(0, len + start) : Math.min(start, len);
      const normalizedStop = stop < 0 ? Math.max(-1, len + stop) : Math.min(stop, len - 1);
      
      if (normalizedStart > normalizedStop) return [];
      
      const range = sorted.slice(normalizedStart, normalizedStop + 1);
      
      if (withScores) {
        return range.map(([member, score]) => ({ member, score }));
      }
      return range.map(([member]) => member);
    }

    /** 按索引范围获取元素（降序） */
    zrevrange(key: string, start: number, stop: number, withScores?: boolean): any[] {
      const zset = this.getZSet(key);
      if (!zset) return [];
      
      // 按分数降序排序
      const sorted = Array.from(zset.entries()).sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return String(b[0]).localeCompare(String(a[0]));
      });
      
      const len = sorted.length;
      const normalizedStart = start < 0 ? Math.max(0, len + start) : Math.min(start, len);
      const normalizedStop = stop < 0 ? Math.max(-1, len + stop) : Math.min(stop, len - 1);
      
      if (normalizedStart > normalizedStop) return [];
      
      const range = sorted.slice(normalizedStart, normalizedStop + 1);
      
      if (withScores) {
        return range.map(([member, score]) => ({ member, score }));
      }
      return range.map(([member]) => member);
    }

    /** 按分数范围获取元素（升序） */
    zrangebyscore(
      key: string,
      min: number,
      max: number,
      options?: { withScores?: boolean; limit?: { offset: number; count: number } }
    ): any[] {
      const zset = this.getZSet(key);
      if (!zset) return [];
      
      const sorted = Array.from(zset.entries())
        .filter(([, score]) => score >= min && score <= max)
        .sort((a, b) => {
          if (a[1] !== b[1]) return a[1] - b[1];
          return String(a[0]).localeCompare(String(b[0]));
        });
      
      let result = sorted;
      if (options?.limit) {
        result = sorted.slice(options.limit.offset, options.limit.offset + options.limit.count);
      }
      
      if (options?.withScores) {
        return result.map(([member, score]) => ({ member, score }));
      }
      return result.map(([member]) => member);
    }

    /** 获取元素的分数 */
    zscore(key: string, member: any): number | null {
      const zset = this.getZSet(key);
      if (!zset || !zset.has(member)) return null;
      return zset.get(member)!;
    }

    /** 获取元素的排名（升序，从 0 开始） */
    zrank(key: string, member: any): number | null {
      const zset = this.getZSet(key);
      if (!zset || !zset.has(member)) return null;
      
      const sorted = Array.from(zset.entries()).sort((a, b) => {
        if (a[1] !== b[1]) return a[1] - b[1];
        return String(a[0]).localeCompare(String(b[0]));
      });
      
      return sorted.findIndex(([m]) => m === member);
    }

    /** 获取元素的倒序排名（降序，从 0 开始） */
    zrevrank(key: string, member: any): number | null {
      const zset = this.getZSet(key);
      if (!zset || !zset.has(member)) return null;
      
      const sorted = Array.from(zset.entries()).sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return String(b[0]).localeCompare(String(a[0]));
      });
      
      return sorted.findIndex(([m]) => m === member);
    }

    /** 增加元素的分数，返回增加后的分数 */
    zincrby(key: string, increment: number, member: any): number {
      const zset = this.getZSet(key) ?? new Map<any, number>();
      const currentScore = zset.get(member) ?? 0;
      const newScore = currentScore + increment;
      zset.set(member, newScore);
      this.saveZSet(key, zset);
      return newScore;
    }

    /** 获取有序集合大小 */
    zcard(key: string): number {
      const zset = this.getZSet(key);
      return zset ? zset.size : 0;
    }

    /** 获取分数范围内的元素数量 */
    zcount(key: string, min: number, max: number): number {
      const zset = this.getZSet(key);
      if (!zset) return 0;
      
      let count = 0;
      for (const score of zset.values()) {
        if (score >= min && score <= max) count++;
      }
      return count;
    }

    /** 按排名范围删除元素，返回删除的数量 */
    zremrangebyrank(key: string, start: number, stop: number): number {
      const zset = this.getZSet(key);
      if (!zset) return 0;
      
      const sorted = Array.from(zset.entries()).sort((a, b) => {
        if (a[1] !== b[1]) return a[1] - b[1];
        return String(a[0]).localeCompare(String(b[0]));
      });
      
      const len = sorted.length;
      const normalizedStart = start < 0 ? Math.max(0, len + start) : Math.min(start, len);
      const normalizedStop = stop < 0 ? Math.max(-1, len + stop) : Math.min(stop, len - 1);
      
      if (normalizedStart > normalizedStop) return 0;
      
      const toRemove = sorted.slice(normalizedStart, normalizedStop + 1);
      for (const [member] of toRemove) {
        zset.delete(member);
      }
      
      this.saveZSet(key, zset);
      return toRemove.length;
    }

    /** 按分数范围删除元素，返回删除的数量 */
    zremrangebyscore(key: string, min: number, max: number): number {
      const zset = this.getZSet(key);
      if (!zset) return 0;
      
      let removed = 0;
      for (const [member, score] of Array.from(zset.entries())) {
        if (score >= min && score <= max) {
          zset.delete(member);
          removed++;
        }
      }
      
      this.saveZSet(key, zset);
      return removed;
    }
  };
}
