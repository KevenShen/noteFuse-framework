/**
 * L2 更新操作 Mixin
 * 包含：updateOne、updateMany、findByIdAndUpdate、replaceOne
 */
import type { Document, FilterQuery, UpdateQuery, UpdateResult } from '../types';
import { ObjectId } from '../ObjectId';
import { matchDocument, applyUpdate, setNestedValue } from '../utils';
import { queryCache } from '../QueryCache';
import type { MixinConstructor } from './mixin.types';

export function WithUpdate<T extends MixinConstructor>(Base: T) {
  return class UpdateMixin extends Base {
    /** 更新单个文档 */
    async updateOne<T extends Document = any>(
      query: FilterQuery<T>,
      update: UpdateQuery<T>,
      options?: { upsert?: boolean }
    ): Promise<UpdateResult> {
      const doc = Array.from((this as any).documents.values()).find((d: any) => matchDocument(d, query)) as any;

      if (doc) {
        const docId = doc._id;
        const modified = applyUpdate(doc, update);
        // 触发变更事件
        if (modified) {
          (this as any).emitChangeEvent(
            'update',
            { _id: docId as ObjectId },
            undefined,
            {
              updatedFields: update.$set as Partial<T>,
              removedFields: update.$unset ? Object.keys(update.$unset) : undefined,
            }
          );
          // 使缓存失效
          queryCache.invalidate((this as any).name);
        }
        return {
          acknowledged: true,
          matchedCount: 1,
          modifiedCount: modified ? 1 : 0,
        };
      }

      // upsert 逻辑
      if (options?.upsert) {
        const newDoc = {} as T;
        for (const [key, value] of Object.entries(query)) {
          if (!key.startsWith('$')) {
            setNestedValue(newDoc, key, value);
          }
        }
        applyUpdate(newDoc, update);
        const inserted = (this as any).insertDocument(newDoc);
        (this as any).emitChangeEvent('insert', { _id: inserted._id as ObjectId }, inserted);
        return {
          acknowledged: true,
          matchedCount: 0,
          modifiedCount: 0,
          upsertedId: inserted._id as ObjectId,
        };
      }

      return {
        acknowledged: true,
        matchedCount: 0,
        modifiedCount: 0,
      };
    }

    /** 更新多个文档 */
    async updateMany<T extends Document = any>(
      query: FilterQuery<T>,
      update: UpdateQuery<T>
    ): Promise<UpdateResult> {
      let matchedCount = 0;
      let modifiedCount = 0;

      for (const doc of (this as any).documents.values()) {
        if (matchDocument(doc, query)) {
          matchedCount++;
          if (applyUpdate(doc, update)) {
            modifiedCount++;
            (this as any).emitChangeEvent('update', { _id: doc._id as ObjectId }, undefined, {
              updatedFields: update.$set as Partial<T>,
              removedFields: update.$unset ? Object.keys(update.$unset) : undefined,
            });
          }
        }
      }

      // 使缓存失效
      if (modifiedCount > 0) {
        queryCache.invalidate((this as any).name);
      }

      return {
        acknowledged: true,
        matchedCount,
        modifiedCount,
      };
    }

    /** 根据 ID 更新 */
    async findByIdAndUpdate<T extends Document = any>(
      id: ObjectId | string,
      update: UpdateQuery<T>
    ): Promise<T | null> {
      const idStr = id instanceof ObjectId ? id.toString() : id;
      const doc = (this as any).documents.get(idStr);
      if (doc) {
        applyUpdate(doc, update);
        // 使缓存失效
        queryCache.invalidate((this as any).name);
        return doc;
      }
      return null;
    }

    /** 替换单个文档 */
    async replaceOne<T extends Document = any>(
      query: FilterQuery<T>,
      replacement: T,
      options?: { upsert?: boolean }
    ): Promise<UpdateResult> {
      const doc = Array.from((this as any).documents.values()).find((d: any) => matchDocument(d, query)) as any;

      if (doc) {
        const docId = doc._id;
        const idStr = docId instanceof ObjectId ? docId.toString() : String(docId);
        const newDoc = { ...replacement, _id: docId };
        (this as any).documents.set(idStr, newDoc);
        (this as any).emitChangeEvent('replace', { _id: docId as ObjectId }, newDoc);
        // 使缓存失效
        queryCache.invalidate((this as any).name);
        return {
          acknowledged: true,
          matchedCount: 1,
          modifiedCount: 1,
        };
      }

      // upsert 逻辑
      if (options?.upsert) {
        const inserted = (this as any).insertDocument(replacement);
        (this as any).emitChangeEvent('insert', { _id: inserted._id as ObjectId }, inserted);
        return {
          acknowledged: true,
          matchedCount: 0,
          modifiedCount: 0,
          upsertedId: inserted._id as ObjectId,
        };
      }

      return {
        acknowledged: true,
        matchedCount: 0,
        modifiedCount: 0,
      };
    }
  };
}
