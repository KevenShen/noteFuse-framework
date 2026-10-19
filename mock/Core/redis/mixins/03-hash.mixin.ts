/**
 * L1 数据结构 - 哈希操作 Mixin
 * 包含：hset/hget/hgetAll/hdel/hexists/hlen/hkeys/hvals/hincrby
 */
import type { MixinConstructor } from './mixin.types';

export function WithHash<T extends MixinConstructor>(Base: T) {
  return class HashMixin extends Base {
    /**
     * 设置哈希字段（支持两种调用方式）
     * - hset(key, field, value)：单字段
     * - hset(key, { field1: value1, field2: value2 })：多字段
     */
    hset(key: string, field: string | Record<string, any>, value?: any): number {
      const hash = this.get<Record<string, any>>(key) ?? {};
      let newFieldCount = 0;

      if (typeof field === 'object' && field !== null) {
        // 多字段模式
        for (const [f, v] of Object.entries(field)) {
          if (!(f in hash)) newFieldCount++;
          hash[f] = v;
        }
      } else {
        // 单字段模式
        if (!(field in hash)) newFieldCount++;
        hash[field] = value;
      }

      this.set(key, hash);
      return newFieldCount;
    }

    /** 获取哈希字段 */
    hget(key: string, field: string): any | null {
      const hash = this.get<Record<string, any>>(key);
      if (!hash) return null;
      return hash[field] ?? null;
    }

    /** 获取所有哈希字段 */
    hgetAll(key: string): Record<string, any> | null {
      return this.get<Record<string, any>>(key);
    }

    /** 删除哈希字段 */
    hdel(key: string, field: string): number {
      const hash = this.get<Record<string, any>>(key);
      if (!hash || !(field in hash)) return 0;
      delete hash[field];
      this.set(key, hash);
      return 1;
    }

    /** 检查哈希字段是否存在 */
    hexists(key: string, field: string): boolean {
      const hash = this.get<Record<string, any>>(key);
      return !!hash && field in hash;
    }

    /** 获取哈希字段数量 */
    hlen(key: string): number {
      const hash = this.get<Record<string, any>>(key);
      return hash ? Object.keys(hash).length : 0;
    }

    /** 获取所有哈希字段名 */
    hkeys(key: string): string[] {
      const hash = this.get<Record<string, any>>(key);
      return hash ? Object.keys(hash) : [];
    }

    /** 获取所有哈希字段值 */
    hvals(key: string): any[] {
      const hash = this.get<Record<string, any>>(key);
      return hash ? Object.values(hash) : [];
    }

    /**
     * 哈希字段自增（HINCRBY）
     * 将哈希中指定字段的值增加 increment，如果字段不存在则初始化为 0 后再增加
     * @param key 键名
     * @param field 字段名
     * @param increment 增量（可以为负数）
     * @returns 增加后的值
     */
    hincrby(key: string, field: string, increment: number): number {
      const hash = this.get<Record<string, any>>(key) ?? {};
      const currentValue = Number(hash[field] ?? 0);
      const newValue = currentValue + increment;
      hash[field] = newValue;
      this.set(key, hash);
      return newValue;
    }
  };
}
