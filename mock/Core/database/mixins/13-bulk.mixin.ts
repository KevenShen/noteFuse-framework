/**
 * 13 - 批量操作 Mixin
 * 包含：bulkCreate、bulkUpdate、bulkDelete、bulkUpsert
 */
import type { FlatItem } from '../types/base.types';
import type { BulkUpdateOperation, BulkDeleteOperation, BulkResult, UpsertOptions } from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithBulk<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** 批量创建 */
    bulkCreate(items: Array<Partial<any>>): BulkResult {
      const result: BulkResult = { insertedCount: 0, updatedCount: 0, deletedCount: 0, matchedCount: 0, errors: [] };
      for (let i = 0; i < items.length; i++) {
        try {
          (this as any).create(items[i]);
          result.insertedCount++;
        } catch (error) {
          result.errors.push({ index: i, message: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
      return result;
    }

    /** 批量更新 */
    bulkUpdate(operations: BulkUpdateOperation<any>[]): BulkResult {
      const result: BulkResult = { insertedCount: 0, updatedCount: 0, deletedCount: 0, matchedCount: 0, errors: [] };
      for (let i = 0; i < operations.length; i++) {
        try {
          const { where, data } = operations[i];
          const count = (this as any).update(where, data);
          result.updatedCount += count;
          result.matchedCount += count;
        } catch (error) {
          result.errors.push({ index: i, message: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
      return result;
    }

    /** 批量删除 */
    bulkDelete(operations: BulkDeleteOperation<any>[]): BulkResult {
      const result: BulkResult = { insertedCount: 0, updatedCount: 0, deletedCount: 0, matchedCount: 0, errors: [] };
      for (let i = 0; i < operations.length; i++) {
        try {
          result.deletedCount += (this as any).delete(operations[i].where);
        } catch (error) {
          result.errors.push({ index: i, message: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
      return result;
    }

    /** 批量 UPSERT */
    bulkUpsert(items: Array<Partial<any>>, options: UpsertOptions): BulkResult {
      const result: BulkResult = { insertedCount: 0, updatedCount: 0, deletedCount: 0, matchedCount: 0, errors: [] };
      for (let i = 0; i < items.length; i++) {
        try {
          const before = (this as any).count();
          (this as any).upsert(items[i], options);
          const after = (this as any).count();
          if (after > before) result.insertedCount++;
          else { result.updatedCount++; result.matchedCount++; }
        } catch (error) {
          result.errors.push({ index: i, message: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
      return result;
    }
  };
}
