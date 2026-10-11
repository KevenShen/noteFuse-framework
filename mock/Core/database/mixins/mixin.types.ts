/**
 * Mixin 基础设施类型定义
 * 用于将 MockTable 按功能拆分为多个 mixin 类，然后组合成最终类
 */
import type { FlatItem } from '../types/base.types';

/** Mixin 构造函数类型 */
export type MixinConstructor<T = {}> = new (...args: any[]) => T;

/** MockTable 基础接口（所有 mixin 都需要访问的核心属性和方法） */
export interface MockTableBase<T extends FlatItem> {
  // 核心属性
  tableName: string;
  data: T[];
  nextId: number;
  autoIncrementField: string;
  
  // 配置
  softDeleteConfig: { enabled: boolean; field: string; valueType: 'timestamp' | 'boolean' };
  timestampConfig: { enabled: boolean; createdAtField: string; updatedAtField: string; auto: boolean };
  treeConfig: { enabled: boolean; parentIdField: string; sortField: string; childrenField: string; rootParentId: any };
  
  // 索引和缓存
  indexes: Map<string, any>;
  queryCache: Map<string, any>;
  cacheHits: number;
  cacheMisses: number;
  
  // 事务
  activeTransaction: any;
  transactionStack: any[];
  tableLocks: Map<string, any>;
  rowLocks: Map<string, any>;
  
  // 性能监控
  performanceStats: Map<string, any>;
  slowQueries: any[];
  
  // Binlog 和复制
  binlogEvents: any[];
  replicationRole: string;
  slaveTables: any[];
  
  // 核心方法
  getRawData(): T[];
  restoreData(data: T[], nextId: number): void;
  getNextId(): number;
  getTableName(): string;
  findById(id: number | string): T | undefined;
  findAll(): T[];
  find(condition: any, options?: any): T[];
  create(data: any): T;
  update(condition: any, data: any): number;
  delete(condition: any): number;
  count(condition?: any): number;
  reset(): void;
}

/** Mixin 基类（所有 mixin 继承此类以获得类型安全） */
export class MixinBase<T extends FlatItem> {
  constructor(...args: any[]) {}
}
