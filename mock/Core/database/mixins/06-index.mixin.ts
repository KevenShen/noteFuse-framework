/**
 * 06 - 索引管理 Mixin
 * 包含：createIndex、dropIndex、getIndexes、hasIndex、rebuildIndex
 */
import type { FlatItem } from '../types/base.types';
import type { IndexDefinition, IndexOptions, IndexType, QueryCondition } from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithIndex<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** 创建索引 */
    createIndex(columns: string[], options?: IndexOptions): string {
      const name = options?.name || `idx_${columns.join('_')}`;
      const type = options?.type || 'NORMAL';
      if ((this as any).indexes.has(name)) return name;
      const index: IndexDefinition = {
        name, columns, type,
        unique: type === 'UNIQUE' || type === 'PRIMARY',
        comment: options?.comment,
        createdAt: new Date(),
      };
      (this as any).indexes.set(name, index);
      this.rebuildIndex(name);
      return name;
    }

    /** 删除索引 */
    dropIndex(name: string): boolean {
      if (!(this as any).indexes.has(name)) return false;
      (this as any).indexes.delete(name);
      (this as any).indexData.delete(name);
      return true;
    }

    /** 获取所有索引 */
    getIndexes(): IndexDefinition[] {
      return Array.from((this as any).indexes.values());
    }

    /** 检查索引是否存在 */
    hasIndex(name: string): boolean {
      return (this as any).indexes.has(name);
    }

    /** 重建索引 */
    rebuildIndex(name: string): void {
      const index = (this as any).indexes.get(name);
      if (!index) return;
      const dataMap = new Map<string, any[]>();
      for (const item of (this as any).data) {
        const key = index.columns.map((col: string) => JSON.stringify(item[col])).join('|');
        if (!dataMap.has(key)) dataMap.set(key, []);
        dataMap.get(key)!.push(item);
      }
      (this as any).indexData.set(name, dataMap);
    }

    /** 使用索引查询（内部方法） */
    protected queryByIndex(condition: QueryCondition<any>): any[] | null {
      for (const [name, index] of (this as any).indexes) {
        const conditionKeys = Object.keys(condition).filter(k => !k.startsWith('$'));
        const matches = index.columns.every((col: string, i: number) => conditionKeys[i] === col);
        if (matches && conditionKeys.length >= 1) {
          const indexData = (this as any).indexData.get(name);
          if (indexData) {
            const key = index.columns.map((col: string) => JSON.stringify(condition[col as keyof typeof condition])).join('|');
            return indexData.get(key) || null;
          }
        }
      }
      return null;
    }
  };
}
