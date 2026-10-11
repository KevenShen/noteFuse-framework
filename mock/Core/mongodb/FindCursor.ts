/**
 * 查询游标类
 * 支持链式调用：sort、skip、limit、project
 * 最终通过 toArray() 或 first() 获取结果
 */
import type { Document } from './types';
import { getNestedValue, setNestedValue, unsetNestedValue } from './utils';

export class FindCursor<T extends Document> {
  private documents: T[];
  private sortOptions?: { [key: string]: 1 | -1 };
  private skipCount?: number;
  private limitCount?: number;
  private projection?: { [key: string]: 1 | 0 };

  constructor(documents: T[]) {
    this.documents = [...documents];
  }

  /** 排序 */
  sort(sort: { [key: string]: 1 | -1 }): FindCursor<T> {
    this.sortOptions = sort;
    return this;
  }

  /** 跳过指定数量 */
  skip(n: number): FindCursor<T> {
    this.skipCount = n;
    return this;
  }

  /** 限制返回数量 */
  limit(n: number): FindCursor<T> {
    this.limitCount = n;
    return this;
  }

  /** 投影字段 */
  project(projection: { [key: string]: 1 | 0 }): FindCursor<T> {
    this.projection = projection;
    return this;
  }

  /** 转换为数组 */
  async toArray(): Promise<T[]> {
    let result = [...this.documents];

    // 排序
    if (this.sortOptions) {
      result.sort((a, b) => {
        for (const [field, order] of Object.entries(this.sortOptions!)) {
          const aVal = getNestedValue(a, field);
          const bVal = getNestedValue(b, field);
          if (aVal < bVal) return order === 1 ? -1 : 1;
          if (aVal > bVal) return order === 1 ? 1 : -1;
        }
        return 0;
      });
    }

    // 跳过
    if (this.skipCount) {
      result = result.slice(this.skipCount);
    }

    // 限制
    if (this.limitCount) {
      result = result.slice(0, this.limitCount);
    }

    // 投影
    if (this.projection) {
      result = result.map(doc => this.applyProjection(doc));
    }

    return result;
  }

  /** 获取第一个结果 */
  async first(): Promise<T | null> {
    const arr = await this.toArray();
    return arr.length > 0 ? arr[0] : null;
  }

  /** 计数 */
  async count(): Promise<number> {
    return this.documents.length;
  }

  /** 应用投影 */
  private applyProjection(doc: T): T {
    const result: any = { _id: doc._id };
    const includeFields = Object.entries(this.projection!)
      .filter(([, v]) => v === 1)
      .map(([k]) => k);
    const excludeFields = Object.entries(this.projection!)
      .filter(([, v]) => v === 0)
      .map(([k]) => k);

    if (includeFields.length > 0) {
      // 包含模式：只保留指定字段
      for (const field of includeFields) {
        if (field === '_id') continue;
        const value = getNestedValue(doc, field);
        if (value !== undefined) {
          setNestedValue(result, field, value);
        }
      }
    } else if (excludeFields.length > 0) {
      // 排除模式：复制所有字段，然后排除指定字段
      Object.assign(result, doc);
      for (const field of excludeFields) {
        unsetNestedValue(result, field);
      }
    }

    return result as T;
  }
}
