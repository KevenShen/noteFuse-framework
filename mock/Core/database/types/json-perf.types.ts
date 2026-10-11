/**
 * JSON 操作、性能监控和导入导出类型定义
 */
import type { QueryCondition } from './base.types';

/** JSON 路径类型（支持点号和数组索引） */
export type JsonPath = string;

/** 性能统计项 */
export interface PerformanceStat {
  /** 操作类型 */
  operation: string;
  /** 调用次数 */
  count: number;
  /** 总耗时（毫秒） */
  totalTime: number;
  /** 平均耗时（毫秒） */
  avgTime: number;
  /** 最小耗时（毫秒） */
  minTime: number;
  /** 最大耗时（毫秒） */
  maxTime: number;
  /** 最后一次耗时（毫秒） */
  lastTime: number;
}

/** 慢查询记录 */
export interface SlowQueryRecord {
  /** 操作类型 */
  operation: string;
  /** 查询条件 */
  condition?: string;
  /** 耗时（毫秒） */
  duration: number;
  /** 时间戳 */
  timestamp: Date;
  /** 返回记录数 */
  resultCount?: number;
}

/** 性能报告 */
export interface PerformanceReport {
  /** 表名 */
  tableName: string;
  /** 总操作次数 */
  totalOperations: number;
  /** 总耗时（毫秒） */
  totalTime: number;
  /** 各操作统计 */
  stats: PerformanceStat[];
  /** 慢查询列表 */
  slowQueries: SlowQueryRecord[];
  /** 数据量 */
  recordCount: number;
  /** 索引数量 */
  indexCount: number;
  /** 缓存命中率 */
  cacheHitRate: number;
}

/** 导出选项 */
export interface ExportOptions {
  /** 导出字段（不指定则导出所有） */
  fields?: string[];
  /** 过滤条件 */
  where?: QueryCondition<any>;
  /** 是否包含表头（CSV） */
  includeHeader?: boolean;
  /** 格式化 JSON */
  pretty?: boolean;
}

/** 导入选项 */
export interface ImportOptions {
  /** 是否覆盖现有数据 */
  overwrite?: boolean;
  /** 是否跳过验证 */
  skipValidation?: boolean;
  /** 批量大小 */
  batchSize?: number;
  /** 冲突时更新（UPSERT） */
  updateOnConflict?: boolean;
  /** 冲突字段 */
  conflictFields?: string[];
}
