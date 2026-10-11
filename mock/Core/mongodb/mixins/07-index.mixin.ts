/**
 * L4 索引管理 Mixin
 * 包含：createIndex、listIndexes、dropIndex、dropIndexes
 */
import type { Document, IndexOptions, IndexInfo } from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithIndex<T extends MixinConstructor>(Base: T) {
  return class IndexMixin extends Base {
    /** 创建索引 */
    createIndex(keys: { [key: string]: 1 | -1 }, options?: IndexOptions): string {
      const name = options?.name || Object.entries(keys).map(([k, v]) => `${k}_${v}`).join('_');
      const indexInfo: IndexInfo = { name, keys, options: options || {} };
      (this as any).indexes.set(name, indexInfo);
      return name;
    }

    /** 获取所有索引 */
    listIndexes(): IndexInfo[] {
      return Array.from((this as any).indexes.values());
    }

    /** 删除索引 */
    dropIndex(name: string): boolean {
      return (this as any).indexes.delete(name);
    }

    /** 删除所有索引 */
    dropIndexes(): void {
      (this as any).indexes.clear();
    }
  };
}
