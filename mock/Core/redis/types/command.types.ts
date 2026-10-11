/**
 * 命令相关类型定义
 * 包含：SlowlogEntry、TransactionCommand
 */

/** 慢查询记录 */
export interface SlowlogEntry {
  /** 自增 ID */
  id: number;
  /** 时间戳 */
  timestamp: number;
  /** 执行耗时（微秒） */
  duration: number;
  /** 命令名 */
  command: string;
  /** 命令参数 */
  args: any[];
}

/** 事务命令 */
export interface TransactionCommand {
  /** 命令名 */
  command: string;
  /** 命令参数 */
  args: any[];
}
