/**
 * L1 数据结构 - 计数器操作 Mixin
 * 包含：incr/incrBy/decr/decrBy
 */
import type { MixinConstructor } from './mixin.types';

export function WithCounter<T extends MixinConstructor>(Base: T) {
  return class CounterMixin extends Base {
    /** 自增 1，返回自增后的值 */
    incr(key: string): number {
      return this.incrBy(key, 1);
    }

    /** 自增指定值，返回自增后的值 */
    incrBy(key: string, increment: number): number {
      const current = this.get<number>(key) ?? 0;
      const newValue = current + increment;
      this.set(key, newValue);
      return newValue;
    }

    /** 自减 1，返回自减后的值 */
    decr(key: string): number {
      return this.incrBy(key, -1);
    }

    /** 自减指定值，返回自减后的值 */
    decrBy(key: string, decrement: number): number {
      return this.incrBy(key, -decrement);
    }
  };
}
