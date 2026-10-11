/**
 * 外键约束、数据验证和事件钩子类型定义
 */
import type { QueryCondition } from './base.types';

/** 外键动作类型 */
export type ForeignKeyAction = 'CASCADE' | 'RESTRICT' | 'SET NULL' | 'NO ACTION';

/** 外键约束定义 */
export interface ForeignKeyDefinition {
  /** 约束名称 */
  name: string;
  /** 本表字段 */
  field: string;
  /** 引用的表 */
  referencedTable: string;
  /** 引用的字段 */
  referencedField: string;
  /** 删除时的动作 */
  onDelete?: ForeignKeyAction;
  /** 更新时的动作 */
  onUpdate?: ForeignKeyAction;
}

/** 字段验证规则 */
export interface FieldValidationRule {
  /** 字段名 */
  field: string;
  /** 是否必填 */
  required?: boolean;
  /** 数据类型 */
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'date';
  /** 最小长度（字符串/数组） */
  minLength?: number;
  /** 最大长度（字符串/数组） */
  maxLength?: number;
  /** 最小值（数值） */
  min?: number;
  /** 最大值（数值） */
  max?: number;
  /** 正则表达式模式 */
  pattern?: RegExp;
  /** 枚举值 */
  enum?: any[];
  /** 自定义验证函数 */
  validator?: (value: any, item: any) => boolean | string;
  /** 错误消息 */
  message?: string;
}

/** 数据验证配置 */
export interface ValidationConfig {
  /** 字段验证规则 */
  rules: FieldValidationRule[];
  /** 是否在创建时验证 */
  validateOnCreate?: boolean;
  /** 是否在更新时验证 */
  validateOnUpdate?: boolean;
  /** 是否在删除时验证 */
  validateOnDelete?: boolean;
}

/** 验证错误 */
export interface ValidationError {
  /** 字段名 */
  field: string;
  /** 错误消息 */
  message: string;
  /** 错误类型 */
  type: string;
}

/** 验证结果 */
export interface ValidationResult {
  /** 是否通过 */
  valid: boolean;
  /** 错误列表 */
  errors: ValidationError[];
}

/** 事件类型 */
export type EventType = 
  | 'beforeCreate'
  | 'afterCreate'
  | 'beforeUpdate'
  | 'afterUpdate'
  | 'beforeDelete'
  | 'afterDelete'
  | 'beforeFind'
  | 'afterFind'
  | 'beforeValidate'
  | 'afterValidate';

/** 事件钩子函数 */
export type EventHook<T> = (data: {
  /** 事件类型 */
  type: EventType;
  /** 表名 */
  tableName: string;
  /** 数据（创建/更新时） */
  data?: Partial<T>;
  /** 原始数据（更新/删除前） */
  original?: T;
  /** 查询条件（查询时） */
  condition?: QueryCondition<T>;
  /** 查询结果（查询后） */
  result?: T[];
  /** 阻止后续操作（before 事件中返回 false 可阻止） */
  preventDefault?: () => void;
}) => void | boolean | Promise<void | boolean>;

/** 事件钩子配置 */
export interface EventHooksConfig<T> {
  beforeCreate?: EventHook<T>;
  afterCreate?: EventHook<T>;
  beforeUpdate?: EventHook<T>;
  afterUpdate?: EventHook<T>;
  beforeDelete?: EventHook<T>;
  afterDelete?: EventHook<T>;
  beforeFind?: EventHook<T>;
  afterFind?: EventHook<T>;
  beforeValidate?: EventHook<T>;
  afterValidate?: EventHook<T>;
}
