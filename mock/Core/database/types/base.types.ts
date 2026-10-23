/**
 * 基础类型定义
 * 包含：FlatItem、TableConfig、查询条件、排序、分页等核心类型
 */

/** 扁平化数据项（必须包含 id 和 parent_id） */
export interface FlatItem {
  id: number | string;
  parent_id?: number | string;
  name?: string;
  sort?: number;
  [key: string]: any;
}

/** 数据库表配置 */
export interface TableConfig<T extends FlatItem> {
  /** 表名 */
  name: string;
  /** 初始数据 */
  initialData: T[];
  /** 自增 ID 字段名（默认 id） */
  autoIncrementField?: string;
  /** 下一个自增 ID */
  nextId?: number;
  /** 是否启用异步模式（默认 false，启用后所有方法返回 Promise） */
  async?: boolean;
  /** 异步延迟配置（仅 async=true 时生效） */
  asyncConfig?: import('./async-table.types').AsyncDelayConfig;
}

/** 比较操作符 */
export interface ComparisonOperators<T> {
  $eq?: T;
  $ne?: T;
  $gt?: T;
  $gte?: T;
  $lt?: T;
  $lte?: T;
  $between?: [T, T];
  $notBetween?: [T, T];
  $in?: T[];
  $nin?: T[];
  $like?: string;
  $notLike?: string;
  $regexp?: string | RegExp;
  $isNull?: boolean;
  $isNotNull?: boolean;
}

/** 查询条件（支持操作符） */
export type QueryCondition<T> = {
  [K in keyof T]?: T[K] | ComparisonOperators<T[K]>;
} & {
  $and?: QueryCondition<T>[];
  $or?: QueryCondition<T>[];
  $not?: QueryCondition<T>;
  $raw?: (item: T) => boolean;
};

/** 排序选项（单字段） */
export interface SortOption<T> {
  /** 排序字段 */
  field: keyof T;
  /** 排序方式 */
  order: 'asc' | 'desc';
}

/** 排序选项（多字段，对象形式） */
export type SortObject<T> = Partial<Record<keyof T, 'asc' | 'desc'>>;

/** 排序选项（统一类型） */
export type OrderByOption<T> = SortOption<T> | SortOption<T>[] | SortObject<T>;

/** 字段投影选项 */
export interface ProjectionOption<T> {
  /** 包含的字段 */
  select?: (keyof T)[];
  /** 排除的字段 */
  exclude?: (keyof T)[];
  /** 字段别名映射 { 原字段名: 别名 } */
  alias?: Record<string, string>;
}

/** 查询选项 */
export interface FindOptions<T> {
  /** 字段投影 */
  select?: (keyof T)[];
  /** 排除字段 */
  exclude?: (keyof T)[];
  /** 字段别名 */
  alias?: Record<string, string>;
  /** 排序（支持单字段、多字段数组、对象形式） */
  orderBy?: OrderByOption<T>;
  /** 限制数量 */
  limit?: number;
  /** 偏移量 */
  offset?: number;
  /** 关联查询（Sequelize 风格 include） */
  include?: any[];
}

/** 分页选项 */
export interface PaginationOption {
  /** 当前页（从 1 开始） */
  page: number;
  /** 每页条数 */
  pageSize: number;
}

/** 分页结果 */
export interface PaginatedResult<T> {
  /** 数据列表 */
  list: T[];
  /** 总条数 */
  total: number;
  /** 当前页 */
  page: number;
  /** 每页条数 */
  pageSize: number;
}
