/**
 * MockTable 基类
 * 包含核心属性、构造函数和基础工具方法
 * 所有功能通过 Mixin 组合扩展
 */
import type { FlatItem } from './types/base.types';
import type {
  ExtendedTableConfig,
  SoftDeleteConfig,
  TimestampConfig,
  TreeConfig,
  IndexDefinition,
  CacheEntry,
  ForeignKeyDefinition,
  ValidationConfig,
  EventHooksConfig,
  PerformanceStat,
  SlowQueryRecord,
  ReplicationRole,
  BinlogEvent,
  LockInfo,
  TransactionOptions,
} from './types';
import { Transaction } from './Transaction';

/**
 * MockTable 基类
 * 所有 mixin 都继承此类以访问核心属性
 */
export class MockTableBase<T extends FlatItem> {
  // ==================== 核心属性 ====================
  protected config: ExtendedTableConfig<T>;
  protected data: T[];
  protected nextId: number;
  
  // ==================== 事务与锁 ====================
  protected activeTransaction: Transaction<T> | null = null;
  protected activeLocks: LockInfo[] = [];
  protected transactionStats = {
    committedCount: 0,
    rolledBackCount: 0,
    deadlockCount: 0,
  };
  
  // ==================== 索引与缓存 ====================
  protected indexes: Map<string, IndexDefinition> = new Map();
  protected indexData: Map<string, Map<string, T[]>> = new Map();
  protected queryCache: Map<string, CacheEntry> = new Map();
  protected cacheStats = { hits: 0, misses: 0 };
  protected cacheMaxSize: number = 100;
  protected cacheDefaultTTL: number = 5000; // 5 秒
  
  // ==================== 扩展功能配置 ====================
  protected softDeleteConfig: SoftDeleteConfig;
  protected timestampConfig: TimestampConfig;
  protected treeConfig: TreeConfig;
  protected withTrashedFlag: boolean = false;
  protected onlyTrashedFlag: boolean = false;
  
  // ==================== 约束与验证 ====================
  protected foreignKeys: Map<string, ForeignKeyDefinition> = new Map();
  protected validationConfig: ValidationConfig | null = null;
  protected hooksConfig: EventHooksConfig<T> = {};
  protected tableRegistry: Map<string, MockTableBase<any>> | null = null;
  
  // ==================== 性能监控 ====================
  protected performanceStats: Map<string, PerformanceStat> = new Map();
  protected slowQueries: SlowQueryRecord[] = [];
  protected slowQueryThreshold: number = 100; // 慢查询阈值（毫秒）
  protected maxSlowQueries: number = 100; // 最大慢查询记录数
  
  // ==================== 主从复制与 Binlog ====================
  protected replicationRole: ReplicationRole = 'STANDALONE';
  protected masterTable: MockTableBase<any> | null = null;
  protected slaveTables: Map<string, MockTableBase<any>> = new Map();
  protected binlog: BinlogEvent[] = [];
  protected binlogPosition: number = 0;
  protected maxBinlogSize: number = 1000; // 最大 binlog 记录数
  protected replicationDelay: number = 0; // 复制延迟（毫秒）
  protected lastSyncTime: Date | null = null;
  protected binlogConfig: { enabled: boolean; maxSize: number } = { enabled: false, maxSize: 10000 };
  protected replicationConfig: any = null;
  
  // ==================== 备份 ====================
  protected backups: any[] = [];

  constructor(config: ExtendedTableConfig<T>) {
    this.data = [...config.initialData];
    this.config = config;
    this.nextId = config.nextId || this.calculateNextId();
    
    // 初始化扩展配置
    this.softDeleteConfig = config.softDelete || { enabled: false, field: 'deleted_at', valueType: 'timestamp' };
    this.timestampConfig = config.timestamps || { enabled: false, createdAtField: 'created_at', updatedAtField: 'updated_at', auto: true };
    this.treeConfig = config.tree || { enabled: false, parentIdField: 'parent_id', sortField: 'sort', childrenField: 'children', rootParentId: 0 };
    
    // 初始化外键约束
    if (config.foreignKeys) {
      for (const fk of config.foreignKeys) {
        this.foreignKeys.set(fk.name, fk);
      }
    }
    
    // 初始化数据验证
    this.validationConfig = config.validation || null;
    
    // 初始化事件钩子
    this.hooksConfig = config.hooks || {};
    
    // 自动创建主键索引（由 index mixin 提供）
    // this.createIndex(['id'], { name: 'PRIMARY', type: 'PRIMARY' });
  }

  /** 计算下一个 ID */
  protected calculateNextId(): number {
    if (this.data.length === 0) return 1;
    const maxId = Math.max(...this.data.map((item) => Number(item.id)));
    return maxId + 1;
  }

  // ==================== 核心工具方法 ====================

  /** 获取原始数据 */
  getRawData(): T[] {
    return this.data;
  }

  /** 恢复数据（事务回滚用） */
  restoreData(data: T[], nextId: number): void {
    this.data = [...data];
    this.nextId = nextId;
  }

  /** 获取下一个 ID */
  getNextId(): number {
    return this.nextId;
  }

  /** 获取表名 */
  getTableName(): string {
    return this.config.name;
  }

  /** 重置表数据 */
  reset(): void {
    this.data = [...this.config.initialData];
    this.nextId = this.config.nextId || this.calculateNextId();
    this.queryCache.clear();
  }

  /** 设置表注册表（用于外键约束） */
  setTableRegistry(registry: Map<string, MockTableBase<any>>): void {
    this.tableRegistry = registry;
  }

  // ==================== 条件匹配（核心方法，所有查询都依赖） ====================

  /**
   * 匹配查询条件
   * 支持操作符：$eq, $ne, $gt, $gte, $lt, $lte, $between, $in, $nin, $like, $regexp, $isNull, $and, $or, $not
   */
  protected matchCondition(item: T, condition: any): boolean {
    if (!condition || Object.keys(condition).length === 0) {
      return true;
    }

    // 处理逻辑操作符
    if (condition.$and) {
      return condition.$and.every((cond: any) => this.matchCondition(item, cond));
    }
    if (condition.$or) {
      return condition.$or.some((cond: any) => this.matchCondition(item, cond));
    }
    if (condition.$not) {
      return !this.matchCondition(item, condition.$not);
    }
    if (condition.$raw) {
      return condition.$raw(item);
    }

    // 处理字段条件
    for (const [field, value] of Object.entries(condition)) {
      if (field.startsWith('$')) continue;
      
      const itemValue = (item as any)[field];
      
      // 值是操作符对象
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        const operators = value as any;
        
        if (operators.$eq !== undefined && itemValue !== operators.$eq) return false;
        if (operators.$ne !== undefined && itemValue === operators.$ne) return false;
        if (operators.$gt !== undefined && !(itemValue > operators.$gt)) return false;
        if (operators.$gte !== undefined && !(itemValue >= operators.$gte)) return false;
        if (operators.$lt !== undefined && !(itemValue < operators.$lt)) return false;
        if (operators.$lte !== undefined && !(itemValue <= operators.$lte)) return false;
        if (operators.$between && !(itemValue >= operators.$between[0] && itemValue <= operators.$between[1])) return false;
        if (operators.$notBetween && (itemValue >= operators.$notBetween[0] && itemValue <= operators.$notBetween[1])) return false;
        if (operators.$in && !operators.$in.includes(itemValue)) return false;
        if (operators.$nin && operators.$nin.includes(itemValue)) return false;
        if (operators.$like && !String(itemValue).includes(operators.$like.replace(/%/g, ''))) return false;
        if (operators.$notLike && String(itemValue).includes(operators.$notLike.replace(/%/g, ''))) return false;
        if (operators.$regexp) {
          const regex = operators.$regexp instanceof RegExp ? operators.$regexp : new RegExp(operators.$regexp);
          if (!regex.test(String(itemValue))) return false;
        }
        if (operators.$isNull === true && itemValue !== null && itemValue !== undefined) return false;
        if (operators.$isNull === false && (itemValue === null || itemValue === undefined)) return false;
        if (operators.$isNotNull === true && (itemValue === null || itemValue === undefined)) return false;
        if (operators.$isNotNull === false && itemValue !== null && itemValue !== undefined) return false;
      } else {
        // 直接值比较
        if (itemValue !== value) return false;
      }
    }

    return true;
  }

  // ==================== 排序（核心方法） ====================

  /**
   * 应用排序
   * 支持单字段、多字段数组、对象形式
   */
  protected applySort(data: T[], orderBy?: any): T[] {
    if (!orderBy) return data;
    
    let sortFields: Array<{ field: string; order: 'asc' | 'desc' }> = [];
    
    if (Array.isArray(orderBy)) {
      sortFields = orderBy.map((s: any) => ({
        field: String(s.field),
        order: s.order || 'asc',
      }));
    } else if (orderBy.field) {
      sortFields = [{ field: String(orderBy.field), order: orderBy.order || 'asc' }];
    } else if (typeof orderBy === 'object') {
      sortFields = Object.entries(orderBy).map(([field, order]) => ({
        field,
        order: (order as 'asc' | 'desc') || 'asc',
      }));
    }
    
    if (sortFields.length === 0) return data;
    
    return [...data].sort((a, b) => {
      for (const { field, order } of sortFields) {
        const aVal = (a as any)[field];
        const bVal = (b as any)[field];
        
        if (aVal === bVal) continue;
        if (aVal === null || aVal === undefined) return order === 'asc' ? -1 : 1;
        if (bVal === null || bVal === undefined) return order === 'asc' ? 1 : -1;
        
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return order === 'asc' ? comparison : -comparison;
      }
      return 0;
    });
  }

  // ==================== 字段投影（核心方法） ====================

  /**
   * 应用字段投影
   */
  protected applyProjection(item: T, options?: { select?: string[]; exclude?: string[]; alias?: Record<string, string> }): T {
    if (!options || (!options.select && !options.exclude && !options.alias)) {
      return item;
    }
    
    const result: any = {};
    
    if (options.select) {
      for (const field of options.select) {
        result[field] = (item as any)[field];
      }
    } else if (options.exclude) {
      for (const [key, value] of Object.entries(item)) {
        if (!options.exclude.includes(key)) {
          result[key] = value;
        }
      }
    } else {
      Object.assign(result, item);
    }
    
    // 应用别名
    if (options.alias) {
      for (const [original, alias] of Object.entries(options.alias)) {
        if (result[original] !== undefined) {
          result[alias] = result[original];
          delete result[original];
        }
      }
    }
    
    return result as T;
  }
}
