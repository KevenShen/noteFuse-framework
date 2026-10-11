/**
 * RustFS 生命周期类型定义
 * 
 * 包含生命周期规则、存储类转换、过期删除等类型
 */

import type { StorageClass } from './base.types';

// ==================== 生命周期规则类型 ====================

/**
 * 生命周期规则
 */
export interface LifecycleRule {
  /** 规则ID */
  id: string;
  /** 规则状态 */
  status: 'Enabled' | 'Disabled';
  /** 筛选条件 */
  filter?: LifecycleFilter;
  /** 转换操作 */
  transitions?: LifecycleTransition[];
  /** 过期操作 */
  expiration?: LifecycleExpiration;
  /** 非当前版本转换操作 */
  noncurrent_version_transitions?: LifecycleNoncurrentVersionTransition[];
  /** 非当前版本过期操作 */
  noncurrent_version_expiration?: LifecycleNoncurrentVersionExpiration;
  /** 不完整上传过期操作 */
  abort_incomplete_multipart_upload?: LifecycleAbortIncompleteMultipartUpload;
  /** 规则优先级 */
  priority?: number;
}

/**
 * 生命周期筛选条件
 */
export interface LifecycleFilter {
  /** 前缀 */
  prefix?: string;
  /** 标签 */
  tag?: { key: string; value: string };
  /** 标签组合（AND逻辑） */
  and?: {
    prefix?: string;
    tags?: { key: string; value: string }[];
  };
  /** 对象大小大于等于（字节） */
  object_size_greater_than?: number;
  /** 对象大小小于等于（字节） */
  object_size_less_than?: number;
}

/**
 * 生命周期转换操作
 */
export interface LifecycleTransition {
  /** 转换天数（对象创建后多少天转换） */
  days?: number;
  /** 转换日期 */
  date?: string;
  /** 目标存储类 */
  storage_class: StorageClass;
}

/**
 * 生命周期过期操作
 */
export interface LifecycleExpiration {
  /** 过期天数（对象创建后多少天过期） */
  days?: number;
  /** 过期日期 */
  date?: string;
  /** 是否过期删除标记 */
  expired_object_delete_marker?: boolean;
}

/**
 * 非当前版本转换操作
 */
export interface LifecycleNoncurrentVersionTransition {
  /** 非当前版本天数 */
  noncurrent_days: number;
  /** 目标存储类 */
  storage_class: StorageClass;
}

/**
 * 非当前版本过期操作
 */
export interface LifecycleNoncurrentVersionExpiration {
  /** 非当前版本天数 */
  noncurrent_days: number;
  /** 保留的新版本数量 */
  newer_noncurrent_versions?: number;
}

/**
 * 不完整上传过期操作
 */
export interface LifecycleAbortIncompleteMultipartUpload {
  /** 初始化后多少天过期 */
  days_after_initiation: number;
}

/**
 * 生命周期配置
 */
export interface LifecycleConfiguration {
  /** 规则列表 */
  rules: LifecycleRule[];
}

// ==================== 生命周期执行类型 ====================

/**
 * 生命周期执行结果
 */
export interface LifecycleExecutionResult {
  /** 桶名 */
  bucket: string;
  /** 执行的规则数量 */
  rules_executed: number;
  /** 转换的对象数量 */
  transitioned_count: number;
  /** 转换的总大小（字节） */
  transitioned_size: number;
  /** 过期删除的对象数量 */
  expired_count: number;
  /** 过期删除的总大小（字节） */
  expired_size: number;
  /** 取消的不完整上传数量 */
  aborted_multipart_count: number;
  /** 非当前版本转换数量 */
  noncurrent_transitioned_count: number;
  /** 非当前版本过期数量 */
  noncurrent_expired_count: number;
  /** 失败数量 */
  failed_count: number;
  /** 执行详情 */
  details: LifecycleExecutionDetail[];
  /** 开始时间 */
  started_at: string;
  /** 结束时间 */
  completed_at: string;
  /** 执行状态 */
  status: 'success' | 'partial' | 'failed';
}

/**
 * 生命周期执行详情
 */
export interface LifecycleExecutionDetail {
  /** 规则ID */
  rule_id: string;
  /** 规则名称 */
  rule_name?: string;
  /** 操作类型 */
  action_type: 'transition' | 'expiration' | 'noncurrent_transition' | 'noncurrent_expiration' | 'abort_multipart';
  /** 影响的对象数量 */
  affected_count: number;
  /** 影响的总大小（字节） */
  affected_size: number;
  /** 成功数量 */
  success_count: number;
  /** 失败数量 */
  failed_count: number;
  /** 目标存储类（转换操作） */
  target_storage_class?: StorageClass;
  /** 执行时间（毫秒） */
  execution_time: number;
}

/**
 * 生命周期执行状态
 */
export interface LifecycleExecutionStatus {
  /** 桶名 */
  bucket: string;
  /** 是否正在执行 */
  is_running: boolean;
  /** 最后执行时间 */
  last_executed_at?: string;
  /** 最后执行结果 */
  last_execution_result?: LifecycleExecutionResult;
  /** 下一次执行时间 */
  next_execution_at?: string;
  /** 执行频率 */
  execution_frequency?: 'daily' | 'weekly' | 'monthly' | 'manual';
  /** 总执行次数 */
  total_executions: number;
  /** 总成功次数 */
  total_success: number;
  /** 总失败次数 */
  total_failed: number;
}

// ==================== 对象锁定类型 ====================

/**
 * 对象锁定配置
 */
export interface ObjectLockConfiguration {
  /** 对象锁定状态 */
  object_lock_enabled: 'Enabled';
  /** 默认保留模式 */
  rule?: {
    default_retention?: {
      /** 保留模式 */
      mode: 'GOVERNANCE' | 'COMPLIANCE';
      /** 保留天数 */
      days?: number;
      /** 保留年数 */
      years?: number;
    };
  };
}

/**
 * 对象锁定保留
 */
export interface ObjectLockRetention {
  /** 保留模式 */
  mode: 'GOVERNANCE' | 'COMPLIANCE';
  /** 保留截止日期 */
  retain_until_date: string;
}

/**
 * 对象锁定合法保留
 */
export interface ObjectLockLegalHold {
  /** 合法保留状态 */
  status: 'ON' | 'OFF';
}

/**
 * 对象锁定配置选项
 */
export interface ObjectLockOptions {
  /** 保留模式 */
  mode?: 'GOVERNANCE' | 'COMPLIANCE';
  /** 保留天数 */
  retain_until_date?: string;
  /** 合法保留 */
  legal_hold?: 'ON' | 'OFF';
  /** 绕过治理保留 */
  bypass_governance_retention?: boolean;
}
