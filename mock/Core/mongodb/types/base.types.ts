/**
 * 基础类型定义
 * 包含：Document、OptionalId、FilterQuery、UpdateQuery、FindOptions
 */
import type { ObjectId } from '../ObjectId';

/** 文档基础类型 */
export interface Document {
  _id?: ObjectId | string;
  [key: string]: any;
}

/** 可选 _id 的文档 */
export type OptionalId<T extends Document> = Omit<T, '_id'> & { _id?: ObjectId | string };

/** 过滤查询类型（支持常用操作符） */
export type FilterQuery<T> = {
  [P in keyof T]?: T[P] | {
    $eq?: T[P];
    $ne?: T[P];
    $gt?: T[P];
    $gte?: T[P];
    $lt?: T[P];
    $lte?: T[P];
    $in?: T[P][];
    $nin?: T[P][];
    $exists?: boolean;
  };
} & {
  $and?: FilterQuery<T>[];
  $or?: FilterQuery<T>[];
  $not?: FilterQuery<T>;
  $nor?: FilterQuery<T>[];
  [key: string]: any;
};

/** 更新查询类型 */
export interface UpdateQuery<T> {
  $set?: Partial<T>;
  $unset?: { [P in keyof T]?: '' };
  $inc?: { [P in keyof T]?: number };
  $mul?: { [P in keyof T]?: number };
  $rename?: { [key: string]: string };
  $min?: Partial<T>;
  $max?: Partial<T>;
  $push?: { [P in keyof T]?: any };
  $pull?: { [P in keyof T]?: any };
  $addToSet?: { [P in keyof T]?: any };
  $pop?: { [P in keyof T]?: 1 | -1 };
  [key: string]: any;
}

/** 查询选项 */
export interface FindOptions {
  sort?: { [key: string]: 1 | -1 };
  skip?: number;
  limit?: number;
  projection?: { [key: string]: 1 | 0 };
}
