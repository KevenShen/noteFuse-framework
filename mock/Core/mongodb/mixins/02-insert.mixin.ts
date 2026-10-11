/**
 * L2 插入操作 Mixin
 * 包含：insertOne、insertMany
 */
import type { Document, OptionalId, InsertOneResult, InsertManyResult } from '../types';
import type { ObjectId } from '../ObjectId';
import { queryCache } from '../QueryCache';
import type { MixinConstructor } from './mixin.types';

export function WithInsert<T extends MixinConstructor>(Base: T) {
  return class InsertMixin extends Base {
    /** 插入单个文档 */
    async insertOne<T extends Document = any>(doc: OptionalId<T>): Promise<InsertOneResult> {
      const newDoc = (this as any).insertDocument(doc);
      // 触发变更事件
      (this as any).emitChangeEvent('insert', { _id: newDoc._id as ObjectId }, newDoc);
      // 使缓存失效
      queryCache.invalidate((this as any).name);
      return {
        acknowledged: true,
        insertedId: newDoc._id as ObjectId,
      };
    }

    /** 插入多个文档 */
    async insertMany<T extends Document = any>(docs: OptionalId<T>[]): Promise<InsertManyResult> {
      const insertedIds: ObjectId[] = [];
      for (const doc of docs) {
        const newDoc = (this as any).insertDocument(doc);
        insertedIds.push(newDoc._id as ObjectId);
        (this as any).emitChangeEvent('insert', { _id: newDoc._id as ObjectId }, newDoc);
      }
      // 使缓存失效
      queryCache.invalidate((this as any).name);
      return {
        acknowledged: true,
        insertedCount: insertedIds.length,
        insertedIds,
      };
    }
  };
}
