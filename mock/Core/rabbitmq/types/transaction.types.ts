/**
 * RabbitMQ 事务类型定义
 *
 * 包含：事务状态、事务信息、事务操作
 */

// ==================== 事务状态 ====================

/** 事务状态 */
export type TransactionState =
  | 'none'           // 无事务
  | 'active'         // 事务进行中
  | 'committing'     // 提交中
  | 'committed'      // 已提交
  | 'rolling-back'   // 回滚中
  | 'rolled-back';   // 已回滚

// ==================== 事务操作 ====================

/** 事务操作类型 */
export type TransactionOperationType =
  | 'publish'          // 发布消息
  | 'ack'              // 确认消息
  | 'nack'             // 拒绝消息
  | 'queue.declare'    // 声明队列
  | 'exchange.declare' // 声明交换机
  | 'queue.bind'       // 绑定队列
  | 'queue.purge';     // 清空队列

/** 事务操作 */
export interface TransactionOperation {
  /** 操作类型 */
  type: TransactionOperationType;
  /** 操作数据 */
  data: any;
  /** 操作时间 */
  timestamp: number;
  /** 操作序号 */
  sequence: number;
}

// ==================== 事务信息 ====================

/** 事务信息 */
export interface TransactionInfo {
  /** 通道 ID */
  channelId: number;
  /** 事务状态 */
  state: TransactionState;
  /** 事务开始时间 */
  startedAt: number;
  /** 事务结束时间 */
  endedAt?: number;
  /** 事务操作列表 */
  operations: TransactionOperation[];
  /** 事务 ID（自动生成） */
  transactionId: string;
}

// ==================== 事务统计 ====================

/** 事务统计 */
export interface TransactionStats {
  /** 累计事务数 */
  totalTransactions: number;
  /** 累计提交数 */
  totalCommits: number;
  /** 累计回滚数 */
  totalRollbacks: number;
  /** 当前进行中的事务数 */
  activeTransactions: number;
  /** 平均事务持续时间（毫秒） */
  avgDuration: number;
}
