/**
 * Mixin 基础设施类型定义
 * 用于将 MockMongoCollection 按功能拆分为多个 mixin 类，然后组合成最终类
 */
import type { Document } from '../types';
import type { ObjectId } from '../ObjectId';
import type { IndexInfo } from '../types';

/** Mixin 构造函数类型 */
export type MixinConstructor<T = {}> = new (...args: any[]) => T;

/** MockMongoCollection 基础接口（所有 mixin 都需要访问的核心属性和方法） */
export interface MockMongoCollectionBase<T extends Document> {
  // 核心属性
  name: string;
  documents: Map<string, T>;
  indexes: Map<string, IndexInfo>;

  // 核心方法
  insertDocument(doc: any): T;
  emitChangeEvent(
    operationType: any,
    documentKey?: { _id: ObjectId | string },
    fullDocument?: T,
    updateDescription?: any
  ): void;
}
