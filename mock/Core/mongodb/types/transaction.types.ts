/**
 * 事务类型定义
 * 包含：TransactionState、TransactionOptions
 */

/** 事务状态 */
export type TransactionState =
  | 'NO_TRANSACTION'
  | 'STARTING_TRANSACTION'
  | 'TRANSACTION_IN_PROGRESS'
  | 'TRANSACTION_COMMITTED'
  | 'TRANSACTION_ABORTED';

/** 事务选项 */
export interface TransactionOptions {
  /** 读关注 */
  readConcern?: { level: 'local' | 'majority' | 'linearizable' | 'available' | 'snapshot' };
  /** 写关注 */
  writeConcern?: { w: number | 'majority', wtimeout?: number, j?: boolean };
  /** 读偏好 */
  readPreference?: 'primary' | 'primaryPreferred' | 'secondary' | 'secondaryPreferred' | 'nearest';
  /** 最大提交时间（毫秒） */
  maxCommitTimeMS?: number;
}
