/**
 * 扩展功能类型定义
 * 包含：软删除、时间戳、树形结构、表扩展配置等
 */
import type { FlatItem, TableConfig } from './base.types';
import type { ForeignKeyDefinition } from './constraint.types';
import type { ValidationConfig } from './constraint.types';
import type { EventHooksConfig } from './constraint.types';

/** 软删除配置 */
export interface SoftDeleteConfig {
  /** 是否启用软删除 */
  enabled: boolean;
  /** 软删除字段名（默认 deleted_at） */
  field?: string;
  /** 删除值类型（timestamp = 时间戳, boolean = true/false） */
  valueType?: 'timestamp' | 'boolean';
}

/** 时间戳配置 */
export interface TimestampConfig {
  /** 是否启用时间戳 */
  enabled: boolean;
  /** 创建时间字段名（默认 created_at） */
  createdAtField?: string;
  /** 更新时间字段名（默认 updated_at） */
  updatedAtField?: string;
  /** 是否自动维护 */
  auto?: boolean;
}

/** 树形结构配置 */
export interface TreeConfig {
  /** 是否启用树形结构 */
  enabled: boolean;
  /** 父 ID 字段名（默认 parent_id） */
  parentIdField?: string;
  /** 排序字段名（默认 sort） */
  sortField?: string;
  /** 子节点字段名（默认 children） */
  childrenField?: string;
  /** 根节点的 parent_id 值（默认 0） */
  rootParentId?: number | string | null;
}

/** 表扩展配置 */
export interface ExtendedTableConfig<T extends FlatItem> extends TableConfig<T> {
  /** 软删除配置 */
  softDelete?: SoftDeleteConfig;
  /** 时间戳配置 */
  timestamps?: TimestampConfig;
  /** 树形结构配置 */
  tree?: TreeConfig;
  /** 外键约束列表 */
  foreignKeys?: ForeignKeyDefinition[];
  /** 数据验证配置 */
  validation?: ValidationConfig;
  /** 事件钩子配置 */
  hooks?: EventHooksConfig<T>;
}

/** 树形节点 */
export interface TreeNode<T> {
  /** 节点数据 */
  data: T;
  /** 子节点 */
  children: TreeNode<T>[];
  /** 深度（从 0 开始） */
  depth: number;
  /** 路径（祖先节点 ID 列表） */
  path: Array<number | string>;
}
