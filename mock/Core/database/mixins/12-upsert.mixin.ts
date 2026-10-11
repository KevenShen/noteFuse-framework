/**
 * 12 - UPSERT Mixin
 * 包含：upsert（存在则更新，不存在则插入）
 */
import type { FlatItem } from '../types/base.types';
import type { UpsertOptions } from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithUpsert<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** UPSERT（存在则更新，不存在则插入） */
    upsert(data: Partial<any>, options: UpsertOptions): any {
      const { conflictKeys, updateColumns } = options;
      const condition: any = {};
      for (const key of conflictKeys) condition[key] = (data as any)[key];
      
      const existing = (this as any).findOne(condition);
      if (existing) {
        const updateData: any = {};
        const columnsToUpdate = updateColumns || Object.keys(data).filter(k => !conflictKeys.includes(k));
        for (const key of columnsToUpdate) {
          if ((data as any)[key] !== undefined) updateData[key] = (data as any)[key];
        }
        (this as any).update(condition, updateData);
        return (this as any).findOne(condition);
      } else {
        return (this as any).create(data);
      }
    }
  };
}
