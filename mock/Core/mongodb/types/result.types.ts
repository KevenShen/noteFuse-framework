/**
 * 操作结果类型定义
 * 包含：InsertOneResult、InsertManyResult、UpdateResult、DeleteResult
 */
import type { ObjectId } from '../ObjectId';

/** 插入单个结果 */
export interface InsertOneResult {
  acknowledged: boolean;
  insertedId: ObjectId;
}

/** 插入多个结果 */
export interface InsertManyResult {
  acknowledged: boolean;
  insertedCount: number;
  insertedIds: ObjectId[];
}

/** 更新结果 */
export interface UpdateResult {
  acknowledged: boolean;
  matchedCount: number;
  modifiedCount: number;
  upsertedId?: ObjectId;
}

/** 删除结果 */
export interface DeleteResult {
  acknowledged: boolean;
  deletedCount: number;
}
