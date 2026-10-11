/**
 * 复制与持久化类型定义
 * 包含：ReplicationRole、SlaveInfo、RDBSnapshot、AOFEntry
 */
import type { CacheItem } from './base.types';

/** 主从复制角色 */
export type ReplicationRole = 'master' | 'slave';

/** 从节点信息 */
export interface SlaveInfo {
  /** 从节点 ID */
  id: string;
  /** 从节点地址 */
  address: string;
  /** 复制偏移量 */
  offset: number;
  /** 最后同步时间 */
  lastSync: number;
  /** 状态 */
  status: 'online' | 'offline';
}

/** RDB 快照 */
export interface RDBSnapshot {
  /** 快照时间 */
  timestamp: number;
  /** 数据 */
  data: Record<string, CacheItem>;
  /** 数据大小 */
  size: number;
}

/** AOF 日志条目 */
export interface AOFEntry {
  /** 时间戳 */
  timestamp: number;
  /** 命令 */
  command: string;
  /** 参数 */
  args: any[];
}
