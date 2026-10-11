/**
 * RustFS 存储类型定义
 * 
 * 包含存储统计、配额、存储类转换等类型
 */

import type { StorageClass, FileObject, Bucket } from './base.types';

// ==================== 存储统计类型 ====================

/**
 * 桶统计信息
 */
export interface BucketStats {
  /** 桶名 */
  bucket: string;
  /** 对象数量 */
  object_count: number;
  /** 总大小（字节） */
  total_size: number;
  /** 平均对象大小（字节） */
  avg_object_size: number;
  /** 最大对象大小（字节） */
  max_object_size: number;
  /** 最小对象大小（字节） */
  min_object_size: number;
  /** 存储类分布 */
  storage_class_distribution: Record<StorageClass, { count: number; size: number }>;
  /** MIME类型分布 */
  content_type_distribution: Record<string, { count: number; size: number }>;
  /** 文件大小分布 */
  file_size_distribution: FileSizeDistribution[];
  /** 版本数量 */
  version_count?: number;
  /** 删除标记数量 */
  delete_marker_count?: number;
  /** 分片上传数量 */
  multipart_upload_count?: number;
  /** 最后修改时间 */
  last_modified: string;
  /** 创建时间 */
  creation_date: string;
}

/**
 * 文件大小分布
 */
export interface FileSizeDistribution {
  /** 范围名称 */
  range: string;
  /** 最小大小（字节） */
  min_size: number;
  /** 最大大小（字节） */
  max_size: number;
  /** 文件数量 */
  count: number;
  /** 总大小（字节） */
  total_size: number;
}

/**
 * 总统计信息
 */
export interface TotalStats {
  /** 桶数量 */
  bucket_count: number;
  /** 对象总数 */
  total_objects: number;
  /** 总大小（字节） */
  total_size: number;
  /** 平均桶大小（字节） */
  avg_bucket_size: number;
  /** 最大桶大小（字节） */
  max_bucket_size: number;
  /** 最小桶大小（字节） */
  min_bucket_size: number;
  /** 存储类分布 */
  storage_class_distribution: Record<StorageClass, { count: number; size: number }>;
  /** 区域分布 */
  region_distribution: Record<string, { bucket_count: number; object_count: number; size: number }>;
  /** 每日上传统计 */
  daily_upload_stats?: DailyStats[];
  /** 每日下载统计 */
  daily_download_stats?: DailyStats[];
  /** 流量统计 */
  traffic_stats?: TrafficStats;
}

/**
 * 每日统计
 */
export interface DailyStats {
  /** 日期 */
  date: string;
  /** 数量 */
  count: number;
  /** 大小（字节） */
  size: number;
}

/**
 * 流量统计
 */
export interface TrafficStats {
  /** 总上传流量（字节） */
  total_upload: number;
  /** 总下载流量（字节） */
  total_download: number;
  /** 总删除流量（字节） */
  total_delete: number;
  /** 今日上传流量（字节） */
  today_upload: number;
  /** 今日下载流量（字节） */
  today_download: number;
  /** 本月上传流量（字节） */
  month_upload: number;
  /** 本月下载流量（字节） */
  month_download: number;
}

// ==================== 配额类型 ====================

/**
 * 配额使用情况
 */
export interface QuotaUsage {
  /** 桶名 */
  bucket: string;
  /** 配额大小限制（字节） */
  size_limit: number;
  /** 当前使用大小（字节） */
  current_size: number;
  /** 使用百分比 */
  usage_percentage: number;
  /** 剩余大小（字节） */
  remaining_size: number;
  /** 对象数量限制 */
  object_count_limit?: number;
  /** 当前对象数量 */
  current_object_count: number;
  /** 对象数量使用百分比 */
  object_count_usage_percentage?: number;
  /** 配额类型 */
  type: 'hard' | 'soft';
  /** 告警状态 */
  alert_status: 'normal' | 'warning' | 'critical' | 'exceeded';
  /** 告警阈值（百分比） */
  alert_threshold: number;
  /** 最后检查时间 */
  last_checked: string;
}

/**
 * 用户配额
 */
export interface UserQuota {
  /** 用户ID */
  user_id: string;
  /** 总存储配额（字节） */
  total_storage_quota: number;
  /** 已使用存储（字节） */
  used_storage: number;
  /** 桶数量配额 */
  bucket_count_quota: number;
  /** 已使用桶数量 */
  used_bucket_count: number;
  /** 对象数量配额 */
  object_count_quota?: number;
  /** 已使用对象数量 */
  used_object_count?: number;
  /** 每日上传流量配额（字节） */
  daily_upload_quota?: number;
  /** 今日已上传流量（字节） */
  today_upload_used?: number;
  /** 每日下载流量配额（字节） */
  daily_download_quota?: number;
  /** 今日已下载流量（字节） */
  today_download_used?: number;
  /** 创建时间 */
  created_at: string;
  /** 最后更新时间 */
  updated_at: string;
}

// ==================== 存储类转换类型 ====================

/**
 * 存储类转换规则
 */
export interface StorageClassTransition {
  /** 规则ID */
  id: string;
  /** 规则名称 */
  name: string;
  /** 前缀筛选 */
  prefix?: string;
  /** 标签筛选 */
  tags?: Record<string, string>;
  /** 源存储类 */
  source_storage_class: StorageClass;
  /** 目标存储类 */
  target_storage_class: StorageClass;
  /** 转换天数（对象创建后多少天转换） */
  days_after_creation: number;
  /** 是否启用 */
  enabled: boolean;
  /** 创建时间 */
  created_at: string;
  /** 最后修改时间 */
  updated_at: string;
}

/**
 * 存储类转换结果
 */
export interface StorageClassTransitionResult {
  /** 转换的对象数量 */
  transitioned_count: number;
  /** 转换的总大小（字节） */
  transitioned_size: number;
  /** 转换失败的对象数量 */
  failed_count: number;
  /** 转换详情 */
  details: {
    key: string;
    source_storage_class: StorageClass;
    target_storage_class: StorageClass;
    size: number;
    status: 'success' | 'failed';
    error?: string;
  }[];
  /** 开始时间 */
  started_at: string;
  /** 结束时间 */
  completed_at: string;
}

// ==================== 缓存类型 ====================

/**
 * 缓存配置
 */
export interface CacheConfig {
  /** 是否启用缓存 */
  enabled: boolean;
  /** 缓存TTL（毫秒） */
  ttl: number;
  /** 最大缓存条目数 */
  max_entries: number;
  /** 最大缓存大小（字节） */
  max_size: number;
  /** 缓存策略 */
  strategy: 'LRU' | 'LFU' | 'FIFO' | 'RR';
  /** 缓存类型 */
  cache_type: 'memory' | 'disk' | 'hybrid';
}

/**
 * 缓存统计
 */
export interface CacheStats {
  /** 缓存条目数 */
  entry_count: number;
  /** 缓存大小（字节） */
  size: number;
  /** 命中次数 */
  hit_count: number;
  /** 未命中次数 */
  miss_count: number;
  /** 命中率 */
  hit_rate: number;
  /** 未命中率 */
  miss_rate: number;
  /** 驱逐次数 */
  eviction_count: number;
  /** 最大缓存条目数 */
  max_entries: number;
  /** 最大缓存大小（字节） */
  max_size: number;
  /** 缓存配置 */
  config: CacheConfig;
}

/**
 * 缓存条目
 */
export interface CacheEntry<T = any> {
  /** 缓存键 */
  key: string;
  /** 缓存值 */
  value: T;
  /** 创建时间 */
  created_at: number;
  /** 最后访问时间 */
  last_accessed_at: number;
  /** 访问次数 */
  access_count: number;
  /** 过期时间 */
  expires_at: number;
  /** 大小（字节） */
  size: number;
}

// ==================== 批量操作类型 ====================

/**
 * 批量操作状态
 */
export interface BulkOperationStatus {
  /** 操作ID */
  operation_id: string;
  /** 操作类型 */
  operation_type: 'upload' | 'download' | 'delete' | 'copy' | 'move' | 'set_metadata' | 'set_acl';
  /** 状态 */
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'partially_completed';
  /** 总数量 */
  total_count: number;
  /** 成功数量 */
  success_count: number;
  /** 失败数量 */
  failed_count: number;
  /** 进度百分比 */
  progress: number;
  /** 开始时间 */
  started_at: string;
  /** 结束时间 */
  completed_at?: string;
  /** 错误信息 */
  errors?: BulkOperationError[];
  /** 结果详情 */
  results?: BulkOperationResult[];
}

/**
 * 批量操作错误
 */
export interface BulkOperationError {
  /** 键 */
  key: string;
  /** 错误代码 */
  code: string;
  /** 错误消息 */
  message: string;
}

/**
 * 批量操作结果
 */
export interface BulkOperationResult {
  /** 键 */
  key: string;
  /** 状态 */
  status: 'success' | 'failed';
  /** 结果数据 */
  data?: any;
  /** 错误信息 */
  error?: string;
}

// ==================== 目录类型 ====================

/**
 * 目录信息
 */
export interface DirectoryInfo {
  /** 路径 */
  path: string;
  /** 名称 */
  name: string;
  /** 桶名 */
  bucket: string;
  /** 创建时间 */
  creation_date: string;
  /** 最后修改时间 */
  last_modified: string;
  /** 文件数量 */
  file_count: number;
  /** 子目录数量 */
  subdirectory_count: number;
  /** 总大小（字节） */
  total_size: number;
  /** 是否为空 */
  is_empty: boolean;
}

/**
 * 目录列表结果
 */
export interface ListDirectoryResult {
  /** 目录信息 */
  directory: DirectoryInfo;
  /** 文件列表 */
  files: FileObject[];
  /** 子目录列表 */
  subdirectories: DirectoryInfo[];
  /** 前缀 */
  prefix: string;
  /** 分隔符 */
  delimiter: string;
  /** 标记 */
  marker?: string;
  /** 下一个标记 */
  next_marker?: string;
  /** 最大数量 */
  max_keys: number;
  /** 是否被截断 */
  is_truncated: boolean;
}

/**
 * 复制结果
 */
export interface CopyResult {
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 源对象 */
  source?: { bucket: string; key: string };
  /** 目标对象 */
  destination?: { bucket: string; key: string };
  /** ETag */
  etag?: string;
  /** 最后修改时间 */
  last_modified?: string;
  /** 版本ID */
  version_id?: string;
}

/**
 * 移动结果
 */
export interface MoveResult {
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 源对象 */
  source?: { bucket: string; key: string };
  /** 目标对象 */
  destination?: { bucket: string; key: string };
}

/**
 * 批量上传结果
 */
export interface BulkUploadResult {
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 成功上传的文件列表 */
  uploaded: Array<{
    key: string;
    etag: string;
    size: number;
    last_modified: string;
  }>;
  /** 失败的文件列表 */
  failed: Array<{
    key: string;
    error: string;
  }>;
  /** 总数 */
  total: number;
  /** 成功数量 */
  success_count: number;
  /** 失败数量 */
  failed_count: number;
}

/**
 * 批量下载结果
 */
export interface BulkDownloadResult {
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 成功下载的文件列表 */
  downloaded: Array<{
    key: string;
    data: string | Buffer;
    size: number;
    content_type: string;
    etag: string;
    last_modified: string;
  }>;
  /** 失败的文件列表 */
  failed: Array<{
    key: string;
    error: string;
  }>;
  /** 总数 */
  total: number;
  /** 成功数量 */
  success_count: number;
  /** 失败数量 */
  failed_count: number;
  /** 总大小 */
  total_size: number;
}

/**
 * 批量删除结果
 */
export interface BulkDeleteResult {
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 成功删除的键列表 */
  deleted: string[];
  /** 失败的文件列表 */
  failed: Array<{
    key: string;
    error: string;
  }>;
  /** 总数 */
  total: number;
  /** 成功数量 */
  success_count: number;
  /** 失败数量 */
  failed_count: number;
  /** 删除的总大小 */
  deleted_size: number;
}

/**
 * 批量复制结果
 */
export interface BulkCopyResult {
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 成功复制的文件列表 */
  copied: Array<{
    source: string;
    destination: string;
    etag: string;
    last_modified: string;
  }>;
  /** 失败的文件列表 */
  failed: Array<{
    source: string;
    error: string;
  }>;
  /** 总数 */
  total: number;
  /** 成功数量 */
  success_count: number;
  /** 失败数量 */
  failed_count: number;
}
