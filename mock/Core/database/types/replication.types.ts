/**
 * 主从复制、分片和备份类型定义
 */
import type { MockTable } from '../MockTable';

/** 复制角色 */
export type ReplicationRole = 'MASTER' | 'SLAVE' | 'STANDALONE';

/** 复制状态 */
export interface ReplicationStatus {
  /** 角色 */
  role: ReplicationRole;
  /** 是否正在复制 */
  isReplicating: boolean;
  /** 主库表名 */
  masterTable?: string;
  /** 从库表名列表 */
  slaveTables: string[];
  /** 最后同步时间 */
  lastSyncTime?: Date;
  /** 同步延迟（毫秒） */
  replicationDelay: number;
  /** 已同步的 binlog 位置 */
  lastBinlogPosition?: number;
  /** 错误信息 */
  lastError?: string;
}

/** Binlog 事件类型 */
export type BinlogEventType = 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE' | 'ALTER' | 'DROP';

/** Binlog 事件 */
export interface BinlogEvent {
  /** 事件 ID（自增） */
  id: number;
  /** 事件类型 */
  type: BinlogEventType;
  /** 表名 */
  tableName: string;
  /** 操作时间 */
  timestamp: Date;
  /** 操作前数据（UPDATE/DELETE） */
  beforeData?: any;
  /** 操作后数据（INSERT/UPDATE） */
  afterData?: any;
  /** 记录 ID */
  recordId?: number | string;
  /** 事务 ID */
  transactionId?: string;
}

/** 分片策略 */
export type ShardingStrategy = 'HASH' | 'RANGE' | 'LIST' | 'MODULO';

/** 分片配置 */
export interface ShardConfig {
  /** 分片 ID */
  shardId: number;
  /** 分片表实例 */
  table: MockTable<any>;
  /** 分片范围（RANGE 策略）[start, end) */
  range?: [number, number];
  /** 分片值列表（LIST 策略） */
  values?: any[];
}

/** 分片管理器配置 */
export interface ShardingManagerConfig {
  /** 分片字段 */
  shardKey: string;
  /** 分片策略 */
  strategy: ShardingStrategy;
  /** 分片数量（HASH/MODULO 策略） */
  shardCount?: number;
  /** 分片配置列表 */
  shards: ShardConfig[];
}

/** 增量备份 */
export interface IncrementalBackup {
  /** 备份 ID */
  id: string;
  /** 备份类型 */
  type: 'FULL' | 'INCREMENTAL';
  /** 备份时间 */
  timestamp: Date;
  /** 基于哪个备份（增量备份） */
  baseBackupId?: string;
  /** 数据 */
  data: any[];
  /** Binlog 起始位置 */
  binlogStart?: number;
  /** Binlog 结束位置 */
  binlogEnd?: number;
  /** 记录数 */
  recordCount: number;
}

/** 时间点恢复配置 */
export interface PointInTimeRecoveryConfig {
  /** 目标时间 */
  targetTime: Date;
  /** 全量备份 */
  fullBackup: IncrementalBackup;
  /** 增量备份列表 */
  incrementalBackups: IncrementalBackup[];
}
