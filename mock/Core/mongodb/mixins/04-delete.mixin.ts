/**
 * L2 删除操作 Mixin
 * 包含：deleteOne、deleteMany、findByIdAndDelete
 */
import type { Document, FilterQuery, DeleteResult } from '../types';
import { ObjectId } from '../ObjectId';
import { matchDocument } from '../utils';
import { queryCache } from '../QueryCache';
import type { MixinConstructor } from './mixin.types';

export function WithDelete<T extends MixinConstructor>(Base: T) {
  return class DeleteMixin extends Base {
    /** 删除单个文档 */
    async deleteOne<T extends Document = any>(query: FilterQuery<T>): Promise<DeleteResult> {
      for (const [id, doc] of (this as any).documents.entries()) {
        if (matchDocument(doc, query)) {
          (this as any).documents.delete(id);
          // 触发变更事件
          (this as any).emitChangeEvent('delete', { _id: doc._id as ObjectId });
          // 使缓存失效
          queryCache.invalidate((this as any).name);
          return {
            acknowledged: true,
            deletedCount: 1,
          };
        }
      }
      return {
        acknowledged: true,
        deletedCount: 0,
      };
    }

    /** 删除多个文档 */
    async deleteMany<T extends Document = any>(query: FilterQuery<T>): Promise<DeleteResult> {
      let deletedCount = 0;
      for (const [id, doc] of (this as any).documents.entries()) {
        if (matchDocument(doc, query)) {
          (this as any).documents.delete(id);
          deletedCount++;
          (this as any).emitChangeEvent('delete', { _id: doc._id as ObjectId });
        }
      }
      // 使缓存失效
      if (deletedCount > 0) {
        queryCache.invalidate((this as any).name);
      }
      return {
        acknowledged: true,
        deletedCount,
      };
    }

    /** 根据 ID 删除 */
    async findByIdAndDelete<T extends Document = any>(id: ObjectId | string): Promise<T | null> {
      const idStr = id instanceof ObjectId ? id.toString() : id;
      const doc = (this as any).documents.get(idStr);
      if (doc) {
        (this as any).documents.delete(idStr);
        (this as any).emitChangeEvent('delete', { _id: doc._id as ObjectId });
        // 使缓存失效
        queryCache.invalidate((this as any).name);
        return doc;
      }
      return null;
    }
  };
}
