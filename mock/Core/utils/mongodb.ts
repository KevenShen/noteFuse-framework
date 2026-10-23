/**
 * MongoDB 相关工具函数
 *
 * 【功能分组】
 * - 降级查询：findFromMongoOrDb / findByIdFromMongoOrDb
 *
 * 【降级顺序】MongoDB（L2）→ MockTable（L1）
 * 【说明】MongoDB 作为只读 L2，运行时不更新，只在冷启动时重建
 *
 * 【使用场景】
 * - 用户查询：findFromMongoOrDb(userMongoCollection, userTable, query, 'UserService')
 * - 文档查询：findFromMongoOrDb(docMongoCollection, docTable, query, 'DocService')
 * - 文集查询：findFromMongoOrDb(projectMongoCollection, projectTable, query, 'ProjectService')
 */

import type { MockMongoCollection } from '../mongodb/MockMongoCollection';
import type { Document } from '../mongodb/types';

/**
 * 从 MongoDB（L2）查询，降级到 MockTable（L1）
 *
 * @typeParam T - 数据类型
 * @param mongoCollection - MongoDB 集合实例
 * @param table - MockTable 实例
 * @param query - 查询条件
 * @param logPrefix - 日志前缀（用于定位是哪个模块的降级）
 * @returns 查询结果，未命中返回 null
 *
 * @example
 * ```typescript
 * const user = await findFromMongoOrDb(
 *   userMongoCollection,
 *   userTable,
 *   { email: 'test@example.com' },
 *   'UserService'
 * );
 * ```
 */
export async function findFromMongoOrDb<T extends Document>(
  mongoCollection: MockMongoCollection<T>,
  table: {
    findOne: (condition: any) => T | undefined | Promise<T | undefined>;
  },
  query: Partial<T>,
  logPrefix: string = 'MongoFallback',
): Promise<T | null> {
  try {
    // 1. 优先从 MongoDB（L2）获取
    const mongoResult = await mongoCollection.findOne(query);
    if (mongoResult) {
      return mongoResult;
    }
  } catch (error) {
    console.warn(`[${logPrefix}] MongoDB 查询失败，降级到 MockTable:`, error);
  }

  // 2. 降级到 MockTable（L1）
  const tableResult = await table.findOne(query);
  return tableResult || null;
}

/**
 * 从 MongoDB（L2）按 ID 查询，降级到 MockTable（L1）
 *
 * @typeParam T - 数据类型
 * @param mongoCollection - MongoDB 集合实例
 * @param table - MockTable 实例
 * @param id - 记录 ID
 * @param logPrefix - 日志前缀
 * @returns 查询结果，未命中返回 null
 *
 * @example
 * ```typescript
 * const user = await findByIdFromMongoOrDb(
 *   userMongoCollection,
 *   userTable,
 *   1,
 *   'UserService'
 * );
 * ```
 */
export async function findByIdFromMongoOrDb<T extends Document>(
  mongoCollection: MockMongoCollection<T>,
  table: {
    findById: (id: number | string) => T | undefined | Promise<T | undefined>;
  },
  id: number,
  logPrefix: string = 'MongoFallback',
): Promise<T | null> {
  try {
    // 1. 优先从 MongoDB（L2）获取
    const mongoResult = await mongoCollection.findOne({ id } as any);
    if (mongoResult) {
      return mongoResult;
    }
  } catch (error) {
    console.warn(`[${logPrefix}] MongoDB 查询失败，降级到 MockTable:`, error);
  }

  // 2. 降级到 MockTable（L1）
  const tableResult = await table.findById(id);
  return tableResult || null;
}
