/**
 * L1 数据结构 - 列表操作 Mixin
 * 包含：lpush/rpush/lpop/rpop/lrange/llen/lindex/lset/lrem/ltrim/linsert
 */
import type { MixinConstructor } from './mixin.types';

export function WithList<T extends MixinConstructor>(Base: T) {
  return class ListMixin extends Base {
    /** 左插入（从左侧插入一个或多个元素），返回列表长度 */
    lpush(key: string, ...values: any[]): number {
      const list = this.get<any[]>(key) ?? [];
      list.unshift(...values);
      this.set(key, list);
      return list.length;
    }

    /** 右插入（从右侧插入一个或多个元素），返回列表长度 */
    rpush(key: string, ...values: any[]): number {
      const list = this.get<any[]>(key) ?? [];
      list.push(...values);
      this.set(key, list);
      return list.length;
    }

    /** 左弹出（移除并返回第一个元素） */
    lpop(key: string): any | null {
      const list = this.get<any[]>(key);
      if (!list || list.length === 0) return null;
      const value = list.shift();
      this.set(key, list);
      return value;
    }

    /** 右弹出（移除并返回最后一个元素） */
    rpop(key: string): any | null {
      const list = this.get<any[]>(key);
      if (!list || list.length === 0) return null;
      const value = list.pop();
      this.set(key, list);
      return value;
    }

    /** 获取指定范围的元素（支持负数索引，-1 表示最后一个） */
    lrange(key: string, start: number, stop: number): any[] {
      const list = this.get<any[]>(key);
      if (!list) return [];
      
      const len = list.length;
      // 处理负数索引
      const normalizedStart = start < 0 ? Math.max(0, len + start) : Math.min(start, len);
      const normalizedStop = stop < 0 ? Math.max(-1, len + stop) : Math.min(stop, len - 1);
      
      if (normalizedStart > normalizedStop) return [];
      
      return list.slice(normalizedStart, normalizedStop + 1);
    }

    /** 获取列表长度 */
    llen(key: string): number {
      const list = this.get<any[]>(key);
      return list ? list.length : 0;
    }

    /** 获取指定索引的元素（支持负数索引） */
    lindex(key: string, index: number): any | null {
      const list = this.get<any[]>(key);
      if (!list) return null;
      
      const len = list.length;
      const normalizedIndex = index < 0 ? len + index : index;
      
      if (normalizedIndex < 0 || normalizedIndex >= len) return null;
      return list[normalizedIndex];
    }

    /** 设置指定索引的元素，返回是否成功 */
    lset(key: string, index: number, value: any): boolean {
      const list = this.get<any[]>(key);
      if (!list) return false;
      
      const len = list.length;
      const normalizedIndex = index < 0 ? len + index : index;
      
      if (normalizedIndex < 0 || normalizedIndex >= len) return false;
      list[normalizedIndex] = value;
      this.set(key, list);
      return true;
    }

    /** 删除指定数量的元素，返回删除的数量
     * count > 0: 从左往右删 count 个
     * count < 0: 从右往左删 count 个
     * count = 0: 删除所有
     */
    lrem(key: string, count: number, value: any): number {
      const list = this.get<any[]>(key);
      if (!list) return 0;
      
      let removed = 0;
      if (count === 0) {
        // 删除所有匹配的元素
        const newList = list.filter(item => item !== value);
        removed = list.length - newList.length;
        this.set(key, newList);
      } else if (count > 0) {
        // 从左往右删 count 个
        const newList = [...list];
        let toRemove = count;
        for (let i = 0; i < newList.length && toRemove > 0; i++) {
          if (newList[i] === value) {
            newList.splice(i, 1);
            i--;
            toRemove--;
            removed++;
          }
        }
        this.set(key, newList);
      } else {
        // 从右往左删 count 个
        const newList = [...list];
        let toRemove = Math.abs(count);
        for (let i = newList.length - 1; i >= 0 && toRemove > 0; i--) {
          if (newList[i] === value) {
            newList.splice(i, 1);
            toRemove--;
            removed++;
          }
        }
        this.set(key, newList);
      }
      
      return removed;
    }

    /** 修剪列表（只保留指定范围），返回是否成功 */
    ltrim(key: string, start: number, stop: number): boolean {
      const list = this.get<any[]>(key);
      if (!list) return false;
      
      const trimmed = this.lrange(key, start, stop);
      this.set(key, trimmed);
      return true;
    }

    /**
     * 在列表的指定元素之前或之后插入元素
     * @param key 键名
     * @param direction 插入方向：'BEFORE'（之前）或 'AFTER'（之后）
     * @param pivot 参考元素（在列表中查找的元素）
     * @param value 要插入的元素
     * @returns 插入元素后列表的长度；如果没有找到 pivot 返回 -1；如果 key 不存在返回 0
     */
    linsert(
      key: string,
      direction: 'BEFORE' | 'AFTER',
      pivot: any,
      value: any,
    ): number {
      const list = this.get<any[]>(key);
      if (!list) return 0; // key 不存在

      // 查找 pivot 元素的索引（从左往右找第一个匹配的）
      const pivotIndex = list.findIndex((item) => item === pivot);
      if (pivotIndex === -1) return -1; // 没有找到 pivot

      // 根据方向插入元素
      if (direction === 'BEFORE') {
        list.splice(pivotIndex, 0, value);
      } else {
        // AFTER
        list.splice(pivotIndex + 1, 0, value);
      }

      this.set(key, list);
      return list.length;
    }
  };
}
