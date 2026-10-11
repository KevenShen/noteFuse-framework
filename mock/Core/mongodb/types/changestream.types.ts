/**
 * 变更流类型定义
 * 包含：ChangeOperationType、ChangeEvent、ChangeStreamOptions、ChangeStreamCallback
 */
import type { ObjectId } from '../ObjectId';
import type { Document } from './base.types';

/** 变更操作类型 */
export type ChangeOperationType =
  | 'insert'
  | 'update'
  | 'replace'
  | 'delete'
  | 'drop'
  | 'rename'
  | 'dropDatabase'
  | 'invalidate';

/** 变更事件 */
export interface ChangeEvent<T extends Document = Document> {
  _id: { _data: string };
  operationType: ChangeOperationType;
  ns: { db: string; coll: string };
  documentKey?: { _id: ObjectId | string };
  fullDocument?: T;
  updateDescription?: {
    updatedFields?: Partial<T>;
    removedFields?: string[];
    truncatedArrays?: { field: string; newSize: number }[];
  };
  clusterTime?: Date;
  timestamp: Date;
  txnNumber?: number;
  lsid?: { id: string };
}

/** 变更流选项 */
export interface ChangeStreamOptions {
  resumeAfter?: { _data: string };
  startAtOperationTime?: Date;
  fullDocument?: 'default' | 'updateLookup' | 'whenAvailable' | 'required';
  maxAwaitTimeMS?: number;
  batchSize?: number;
}

/** 变更流回调函数 */
export type ChangeStreamCallback<T extends Document = Document> = (event: ChangeEvent<T>) => void;

/** 变更流状态 */
export type ChangeStreamState = 'pending' | 'open' | 'closed' | 'error';
