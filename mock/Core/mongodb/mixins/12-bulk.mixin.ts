/**
 * L6 批量操作 Mixin
 * 包含：bulkWrite
 */
import type { Document, FilterQuery, UpdateQuery, OptionalId, BulkOperation, BulkWriteResult } from '../types';
import { queryCache } from '../QueryCache';
import type { MixinConstructor } from './mixin.types';

export function WithBulk<T extends MixinConstructor>(Base: T) {
  return class BulkMixin extends Base {
    /**
     * 批量写入操作
     * 支持插入、更新、删除、替换的批量执行
     */
    async bulkWrite(operations: BulkOperation[], options?: { ordered?: boolean }): Promise<BulkWriteResult> {
      const result: BulkWriteResult = {
        ok: 1,
        insertedCount: 0,
        matchedCount: 0,
        modifiedCount: 0,
        deletedCount: 0,
        upsertedCount: 0,
        insertedIds: {},
        upsertedIds: {},
        errors: [],
      };

      const ordered = options?.ordered !== false;

      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        try {
          switch (op.type) {
            case 'insert':
              if (op.document) {
                const insertResult = await (this as any).insertOne(op.document as OptionalId<T>);
                result.insertedCount++;
                result.insertedIds[i] = insertResult.insertedId;
              }
              break;

            case 'update':
              if (op.filter && op.update) {
                if (op.multi) {
                  const updateResult = await (this as any).updateMany(op.filter as FilterQuery<T>, op.update as UpdateQuery<T>, { upsert: op.upsert });
                  result.matchedCount += updateResult.matchedCount;
                  result.modifiedCount += updateResult.modifiedCount;
                  if (updateResult.upsertedId) {
                    result.upsertedCount++;
                    result.upsertedIds[i] = updateResult.upsertedId;
                  }
                } else {
                  const updateResult = await (this as any).updateOne(op.filter as FilterQuery<T>, op.update as UpdateQuery<T>, { upsert: op.upsert });
                  result.matchedCount += updateResult.matchedCount;
                  result.modifiedCount += updateResult.modifiedCount;
                  if (updateResult.upsertedId) {
                    result.upsertedCount++;
                    result.upsertedIds[i] = updateResult.upsertedId;
                  }
                }
              }
              break;

            case 'delete':
              if (op.filter) {
                if (op.multi) {
                  const deleteResult = await (this as any).deleteMany(op.filter as FilterQuery<T>);
                  result.deletedCount += deleteResult.deletedCount;
                } else {
                  const deleteResult = await (this as any).deleteOne(op.filter as FilterQuery<T>);
                  result.deletedCount += deleteResult.deletedCount;
                }
              }
              break;

            case 'replace':
              if (op.filter && op.replacement) {
                const replaceResult = await (this as any).replaceOne(op.filter as FilterQuery<T>, op.replacement as T, { upsert: op.upsert });
                result.matchedCount += replaceResult.matchedCount;
                result.modifiedCount += replaceResult.modifiedCount;
                if (replaceResult.upsertedId) {
                  result.upsertedCount++;
                  result.upsertedIds[i] = replaceResult.upsertedId;
                }
              }
              break;
          }
        } catch (error) {
          result.errors.push({
            index: i,
            code: 11000,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
          if (ordered) {
            result.ok = 0;
            break;
          }
        }
      }

      // 使缓存失效
      queryCache.invalidate((this as any).name);

      return result;
    }
  };
}
