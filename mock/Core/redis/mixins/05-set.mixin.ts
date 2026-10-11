/**
 * L1 数据结构 - 集合操作 Mixin
 * 包含：sadd/srem/smembers/sismember/scard/sunion/sinter/sdiff/srandmember/spop
 */
import type { MixinConstructor } from './mixin.types';

export function WithSet<T extends MixinConstructor>(Base: T) {
  return class SetMixin extends Base {
    /** 添加一个或多个元素到集合，返回添加的新元素数量 */
    sadd(key: string, ...members: any[]): number {
      const set = this.get<Set<any>>(key) ?? new Set<any>();
      let added = 0;
      for (const member of members) {
        if (!set.has(member)) {
          set.add(member);
          added++;
        }
      }
      this.set(key, set);
      return added;
    }

    /** 移除一个或多个元素，返回移除的元素数量 */
    srem(key: string, ...members: any[]): number {
      const set = this.get<Set<any>>(key);
      if (!set) return 0;
      
      let removed = 0;
      for (const member of members) {
        if (set.delete(member)) {
          removed++;
        }
      }
      this.set(key, set);
      return removed;
    }

    /** 获取集合中的所有元素 */
    smembers(key: string): any[] {
      const set = this.get<Set<any>>(key);
      return set ? Array.from(set) : [];
    }

    /** 判断元素是否在集合中 */
    sismember(key: string, member: any): boolean {
      const set = this.get<Set<any>>(key);
      return set ? set.has(member) : false;
    }

    /** 获取集合大小 */
    scard(key: string): number {
      const set = this.get<Set<any>>(key);
      return set ? set.size : 0;
    }

    /** 获取多个集合的并集 */
    sunion(...keys: string[]): any[] {
      const result = new Set<any>();
      for (const key of keys) {
        const set = this.get<Set<any>>(key);
        if (set) {
          for (const member of set) {
            result.add(member);
          }
        }
      }
      return Array.from(result);
    }

    /** 获取多个集合的交集 */
    sinter(...keys: string[]): any[] {
      if (keys.length === 0) return [];
      
      const firstSet = this.get<Set<any>>(keys[0]);
      if (!firstSet) return [];
      
      const result = new Set<any>(firstSet);
      for (let i = 1; i < keys.length; i++) {
        const set = this.get<Set<any>>(keys[i]);
        if (!set) return [];
        for (const member of Array.from(result)) {
          if (!set.has(member)) {
            result.delete(member);
          }
        }
      }
      return Array.from(result);
    }

    /** 获取多个集合的差集（第一个集合有，其他集合没有的） */
    sdiff(...keys: string[]): any[] {
      if (keys.length === 0) return [];
      
      const firstSet = this.get<Set<any>>(keys[0]);
      if (!firstSet) return [];
      
      const result = new Set<any>(firstSet);
      for (let i = 1; i < keys.length; i++) {
        const set = this.get<Set<any>>(keys[i]);
        if (set) {
          for (const member of set) {
            result.delete(member);
          }
        }
      }
      return Array.from(result);
    }

    /** 随机获取一个或多个元素 */
    srandmember(key: string, count?: number): any | any[] {
      const set = this.get<Set<any>>(key);
      if (!set || set.size === 0) return count === undefined ? null : [];
      
      const members = Array.from(set);
      
      if (count === undefined) {
        return members[Math.floor(Math.random() * members.length)];
      }
      
      if (count > 0) {
        // 不重复随机获取
        const shuffled = [...members].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, Math.min(count, members.length));
      } else {
        // 允许重复
        const result: any[] = [];
        for (let i = 0; i < Math.abs(count); i++) {
          result.push(members[Math.floor(Math.random() * members.length)]);
        }
        return result;
      }
    }

    /** 随机弹出一个或多个元素 */
    spop(key: string, count?: number): any | any[] {
      const set = this.get<Set<any>>(key);
      if (!set || set.size === 0) return count === undefined ? null : [];
      
      const members = Array.from(set);
      
      if (count === undefined) {
        const index = Math.floor(Math.random() * members.length);
        const value = members[index];
        set.delete(value);
        this.set(key, set);
        return value;
      }
      
      const result: any[] = [];
      const toRemove = Math.min(Math.abs(count), members.length);
      const shuffled = [...members].sort(() => Math.random() - 0.5);
      
      for (let i = 0; i < toRemove; i++) {
        const value = shuffled[i];
        set.delete(value);
        result.push(value);
      }
      
      this.set(key, set);
      return result;
    }
  };
}
