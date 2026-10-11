/**
 * L1 基础查询 Mixin
 * 包含：find、findOne、findById、countDocuments、distinct、exists
 */
import type { Document, FilterQuery, FindOptions } from '../types';
import { ObjectId } from '../ObjectId';
import { FindCursor } from '../FindCursor';
import { matchDocument, getNestedValue } from '../utils';
import type { MixinConstructor } from './mixin.types';

export function WithQuery<T extends MixinConstructor>(Base: T) {
  return class QueryMixin extends Base {
    /** 查询多个文档 */
    find<T extends Document = any>(query?: FilterQuery<T>, options?: FindOptions): FindCursor<T> {
      const filtered = Array.from((this as any).documents.values()).filter((doc: any) =>
        matchDocument(doc, query || {})
      ) as T[];
      const cursor = new FindCursor<T>(filtered);
      if (options?.sort) cursor.sort(options.sort);
      if (options?.skip) cursor.skip(options.skip);
      if (options?.limit) cursor.limit(options.limit);
      if (options?.projection) cursor.project(options.projection);
      return cursor;
    }

    /** 查询单个文档 */
    async findOne<T extends Document = any>(query?: FilterQuery<T>, options?: FindOptions): Promise<T | null> {
      return this.find(query, options).first();
    }

    /** 根据 ID 查询 */
    async findById<T extends Document = any>(id: ObjectId | string): Promise<T | null> {
      const idStr = id instanceof ObjectId ? id.toString() : id;
      return (this as any).documents.get(idStr) || null;
    }

    /** 统计文档数量 */
    async countDocuments<T extends Document = any>(query?: FilterQuery<T>): Promise<number> {
      if (!query || Object.keys(query).length === 0) {
        return (this as any).documents.size;
      }
      let count = 0;
      for (const doc of (this as any).documents.values()) {
        if (matchDocument(doc, query)) count++;
      }
      return count;
    }

    /** 获取字段的不同值 */
    async distinct<T extends Document = any>(field: string, query?: FilterQuery<T>): Promise<any[]> {
      const values = new Set<any>();
      for (const doc of (this as any).documents.values()) {
        if (!query || matchDocument(doc, query)) {
          const value = getNestedValue(doc, field);
          if (value !== undefined) {
            values.add(JSON.stringify(value));
          }
        }
      }
      return Array.from(values).map(v => JSON.parse(v));
    }

    /** 检查文档是否存在 */
    async exists<T extends Document = any>(query: FilterQuery<T>): Promise<boolean> {
      return (await this.countDocuments(query)) > 0;
    }
  };
}
