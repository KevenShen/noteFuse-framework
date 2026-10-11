/**
 * 高级 UPDATE 和批量操作类型定义
 * 包含：UPDATE 操作符、UPSERT、批量操作、CASE WHEN 等
 */
import type { QueryCondition } from './base.types';

/** 高级 UPDATE 操作符 */
export interface UpdateOperators<T> {
  /** 设置字段值 */
  $set?: Partial<T>;
  /** 数值递增/递减 */
  $inc?: Partial<Record<keyof T, number>>;
  /** 数值乘法 */
  $mul?: Partial<Record<keyof T, number>>;
  /** 取最小值 */
  $min?: Partial<T>;
  /** 取最大值 */
  $max?: Partial<T>;
  /** 重命名字段 { 旧字段名: 新字段名 } */
  $rename?: Record<string, string>;
  /** 删除字段 */
  $unset?: Partial<Record<keyof T, any>>;
  /** 数组追加元素 */
  $push?: Partial<Record<keyof T, any>>;
  /** 数组移除元素 */
  $pull?: Partial<Record<keyof T, any>>;
  /** 数组去重追加 */
  $addToSet?: Partial<Record<keyof T, any>>;
  /** 数组弹出首/尾元素（1=尾, -1=首） */
  $pop?: Partial<Record<keyof T, 1 | -1>>;
}

/** UPDATE 数据（支持普通对象或操作符） */
export type UpdateData<T> = Partial<T> | UpdateOperators<T>;

/** UPSERT 选项 */
export interface UpsertOptions {
  /** 冲突字段（用于判断是否已存在） */
  conflictKeys: string[];
  /** 更新的字段（不指定则更新所有非冲突字段） */
  updateColumns?: string[];
}

/** 批量更新操作 */
export interface BulkUpdateOperation<T> {
  /** 过滤条件 */
  where: QueryCondition<T>;
  /** 更新数据 */
  data: UpdateData<T>;
}

/** 批量删除操作 */
export interface BulkDeleteOperation<T> {
  /** 过滤条件 */
  where: QueryCondition<T>;
}

/** 批量操作结果 */
export interface BulkResult {
  /** 插入数量 */
  insertedCount: number;
  /** 更新数量 */
  updatedCount: number;
  /** 删除数量 */
  deletedCount: number;
  /** 匹配数量 */
  matchedCount: number;
  /** 错误列表 */
  errors: Array<{ index: number; message: string }>;
}

/** CASE WHEN 条件更新配置 */
export interface CaseWhenConfig<T> {
  /** 要更新的字段 */
  field: keyof T;
  /** 条件列表 */
  cases: Array<{
    /** WHEN 条件 */
    when: QueryCondition<T>;
    /** THEN 值 */
    then: any;
  }>;
  /** ELSE 默认值 */
  else?: any;
}
