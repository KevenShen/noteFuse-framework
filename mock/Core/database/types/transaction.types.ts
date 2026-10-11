/**
 * 事务与锁类型定义
 * 包含：隔离级别、事务状态、保存点、锁信息、乐观锁等
 */
import type { FlatItem } from './base.types';

/** 事务隔离级别 */
export type IsolationLevel = 
  | 'READ UNCOMMITTED'
  | 'READ COMMITTED'
  | 'REPEATABLE READ'
  | 'SERIALIZABLE';

/** 事务状态 */
export type TransactionState = 
  | 'IDLE'           // 无活动事务
  | 'ACTIVE'         // 事务进行中
  | 'COMMITTED'      // 已提交
  | 'ROLLED_BACK';   // 已回滚

/** 事务选项 */
export interface TransactionOptions {
  /** 隔离级别（默认 REPEATABLE READ） */
  isolationLevel?: IsolationLevel;
  /** 只读事务 */
  readOnly?: boolean;
  /** 事务名称 */
  name?: string;
}

/** 保存点 */
export interface Savepoint {
  /** 保存点名称 */
  name: string;
  /** 创建时的数据快照 */
  snapshot: FlatItem[];
  /** 创建时的自增 ID */
  nextId: number;
}

/** 锁类型 */
export type LockType = 'READ' | 'WRITE';

/** 锁信息 */
export interface LockInfo {
  /** 锁类型 */
  type: LockType;
  /** 锁定的表名 */
  table: string;
  /** 锁定的记录 ID（行锁） */
  recordId?: number | string;
  /** 事务 ID */
  transactionId: string;
  /** 获取时间 */
  acquiredAt: Date;
}

/** 乐观锁选项 */
export interface OptimisticLockOptions {
  /** 版本号字段名（默认 version） */
  versionField?: string;
  /** 当前版本号 */
  version: number;
}

/** 事务统计信息 */
export interface TransactionStats {
  /** 活跃事务数 */
  activeTransactions: number;
  /** 已提交事务数 */
  committedCount: number;
  /** 已回滚事务数 */
  rolledBackCount: number;
  /** 当前持有的锁数 */
  activeLocks: number;
  /** 死锁检测次数 */
  deadlockCount: number;
}
