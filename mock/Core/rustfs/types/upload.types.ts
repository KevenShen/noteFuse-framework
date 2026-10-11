/**
 * RustFS 上传类型定义
 * 
 * 包含分片上传、断点续传、上传进度等类型
 */

import type { StorageClass, ACLType, UploadPart, FileOwner, FileObject } from './base.types';

// ==================== 分片上传类型 ====================

/**
 * 初始化分片上传选项
 */
export interface CreateMultipartUploadOptions {
  /** 存储类 */
  storage_class?: StorageClass;
  /** ACL权限 */
  acl?: ACLType;
  /** 自定义元数据 */
  metadata?: Record<string, string>;
  /** 标签 */
  tags?: Record<string, string>;
  /** 内容类型 */
  content_type?: string;
  /** 内容编码 */
  content_encoding?: string;
  /** 缓存控制 */
  cache_control?: string;
  /** 过期时间 */
  expires?: string;
  /** 服务器端加密 */
  server_side_encryption?: string;
  /** 对象锁定模式 */
  object_lock_mode?: string;
  /** 对象锁定保留截止日期 */
  object_lock_retain_until_date?: string;
  /** 对象锁定合法保留 */
  object_lock_legal_hold?: boolean;
  /** 预期桶所有者 */
  expected_bucket_owner?: string;
}

/**
 * 初始化分片上传结果
 */
export interface CreateMultipartUploadResult {
  /** 桶名 */
  bucket: string;
  /** 对象键 */
  key: string;
  /** 上传ID */
  upload_id: string;
  /** 存储类 */
  storage_class: StorageClass;
  /** ACL权限 */
  acl: ACLType;
  /** 初始化时间 */
  initiated_at: string;
  /** 服务器端加密 */
  server_side_encryption?: string;
  /** 初始化者 */
  initiator?: FileOwner;
  /** 所有者 */
  owner?: FileOwner;
}

/**
 * 上传分片选项
 */
export interface UploadPartOptions {
  /** 分片编号 */
  part_number: number;
  /** 分片数据 */
  data: Buffer | string;
  /** 分片大小（字节） */
  size?: number;
  /** 内容MD5 */
  content_md5?: string;
  /** 预期桶所有者 */
  expected_bucket_owner?: string;
  /** 进度回调 */
  on_progress?: (uploaded: number, total: number) => void;
}

/**
 * 上传分片结果
 */
export interface UploadPartResult {
  /** 分片编号 */
  part_number: number;
  /** 分片ETag */
  etag: string;
  /** 分片大小（字节） */
  size: number;
  /** 上传时间 */
  uploaded_at: string;
  /** 服务器端加密 */
  server_side_encryption?: string;
}

/**
 * 复制分片选项
 */
export interface UploadPartCopyOptions {
  /** 分片编号 */
  part_number: number;
  /** 源桶 */
  source_bucket: string;
  /** 源键 */
  source_key: string;
  /** 源版本ID */
  source_version_id?: string;
  /** 复制范围开始 */
  range_start?: number;
  /** 复制范围结束 */
  range_end?: number;
  /** 如果匹配则复制 */
  if_match?: string;
  /** 如果不匹配则复制 */
  if_none_match?: string;
  /** 如果修改时间之后则复制 */
  if_modified_since?: string;
  /** 如果修改时间之前则复制 */
  if_unmodified_since?: string;
}

/**
 * 复制分片结果
 */
export interface UploadPartCopyResult {
  /** 分片编号 */
  part_number: number;
  /** 分片ETag */
  etag: string;
  /** 分片大小（字节） */
  size: number;
  /** 复制时间 */
  copied_at: string;
  /** 源对象最后修改时间 */
  last_modified: string;
}

/**
 * 完成分片上传选项
 */
export interface CompleteMultipartUploadOptions {
  /** 分片列表 */
  parts: { part_number: number; etag: string }[];
  /** 预期桶所有者 */
  expected_bucket_owner?: string;
  /** 请求付款者 */
  request_payer?: 'requester';
}

/**
 * 完成分片上传结果
 */
export interface CompleteMultipartUploadResult {
  /** 桶名 */
  bucket: string;
  /** 对象键 */
  key: string;
  /** 对象位置 */
  location: string;
  /** ETag */
  etag: string;
  /** 文件大小（字节） */
  size: number;
  /** 存储类 */
  storage_class: StorageClass;
  /** 版本ID */
  version_id?: string;
  /** 完成时间 */
  completed_at: string;
  /** 服务器端加密 */
  server_side_encryption?: string;
  /** 分片数量 */
  part_count: number;
}

/**
 * 取消分片上传选项
 */
export interface AbortMultipartUploadOptions {
  /** 预期桶所有者 */
  expected_bucket_owner?: string;
  /** 请求付款者 */
  request_payer?: 'requester';
}

/**
 * 取消分片上传结果
 */
export interface AbortMultipartUploadResult {
  /** 桶名 */
  bucket: string;
  /** 对象键 */
  key: string;
  /** 上传ID */
  upload_id: string;
  /** 取消时间 */
  aborted_at: string;
  /** 已取消的分片数量 */
  aborted_parts_count: number;
}

// ==================== 断点续传类型 ====================

/**
 * 断点续传状态
 */
export interface ResumeUploadStatus {
  /** 上传ID */
  upload_id: string;
  /** 桶名 */
  bucket: string;
  /** 对象键 */
  key: string;
  /** 总大小（字节） */
  total_size: number;
  /** 已上传大小（字节） */
  uploaded_size: number;
  /** 上传进度百分比 */
  progress: number;
  /** 已上传的分片 */
  uploaded_parts: UploadPart[];
  /** 待上传的分片 */
  pending_parts: { part_number: number; size: number; offset: number }[];
  /** 上传状态 */
  status: 'in_progress' | 'paused' | 'completed' | 'aborted';
  /** 开始时间 */
  started_at: string;
  /** 最后更新时间 */
  updated_at: string;
  /** 预计剩余时间（秒） */
  estimated_remaining_time?: number;
  /** 上传速度（字节/秒） */
  upload_speed?: number;
}

/**
 * 断点续传选项
 */
export interface ResumeUploadOptions {
  /** 上传ID（如果有） */
  upload_id?: string;
  /** 分片大小（字节） */
  part_size?: number;
  /** 并发上传数量 */
  concurrency?: number;
  /** 重试次数 */
  max_retries?: number;
  /** 重试间隔（毫秒） */
  retry_interval?: number;
  /** 进度回调 */
  on_progress?: (uploaded: number, total: number, speed: number) => void;
  /** 分片完成回调 */
  on_part_complete?: (part: UploadPartResult) => void;
  /** 分片失败回调 */
  on_part_failed?: (part_number: number, error: Error) => void;
  /** 完成回调 */
  on_complete?: (result: CompleteMultipartUploadResult) => void;
  /** 失败回调 */
  on_failed?: (error: Error) => void;
}

// ==================== 上传进度类型 ====================

/**
 * 上传进度
 */
export interface UploadProgress {
  /** 桶名 */
  bucket: string;
  /** 对象键 */
  key: string;
  /** 总大小（字节） */
  total_size: number;
  /** 已上传大小（字节） */
  uploaded_size: number;
  /** 进度百分比 */
  progress: number;
  /** 上传速度（字节/秒） */
  speed: number;
  /** 预计剩余时间（秒） */
  estimated_remaining_time: number;
  /** 开始时间 */
  started_at: string;
  /** 最后更新时间 */
  updated_at: string;
  /** 上传状态 */
  status: 'uploading' | 'paused' | 'completed' | 'failed' | 'cancelled';
  /** 错误信息 */
  error?: string;
}

/**
 * 下载进度
 */
export interface DownloadProgress {
  /** 桶名 */
  bucket: string;
  /** 对象键 */
  key: string;
  /** 总大小（字节） */
  total_size: number;
  /** 已下载大小（字节） */
  downloaded_size: number;
  /** 进度百分比 */
  progress: number;
  /** 下载速度（字节/秒） */
  speed: number;
  /** 预计剩余时间（秒） */
  estimated_remaining_time: number;
  /** 开始时间 */
  started_at: string;
  /** 最后更新时间 */
  updated_at: string;
  /** 下载状态 */
  status: 'downloading' | 'paused' | 'completed' | 'failed' | 'cancelled';
  /** 错误信息 */
  error?: string;
}

// ==================== 预签名URL类型 ====================

/**
 * 预签名URL选项
 */
export interface PresignedUrlOptions {
  /** HTTP方法 */
  method: 'GET' | 'PUT' | 'DELETE' | 'HEAD';
  /** 过期时间（秒） */
  expires_in?: number;
  /** 响应头覆盖 */
  response_headers?: {
    'content-type'?: string;
    'content-language'?: string;
    'content-disposition'?: string;
    'cache-control'?: string;
    'expires'?: string;
  };
  /** 自定义参数 */
  custom_params?: Record<string, string>;
  /** 版本ID */
  version_id?: string;
  /** 上传的内容类型 */
  content_type?: string;
  /** 上传的内容MD5 */
  content_md5?: string;
  /** 预期桶所有者 */
  expected_bucket_owner?: string;
}

/**
 * 预签名URL结果
 */
export interface PresignedUrlResult {
  /** URL */
  url: string;
  /** HTTP方法 */
  method: string;
  /** 桶名 */
  bucket: string;
  /** 对象键 */
  key: string;
  /** 过期时间（秒） */
  expires_in: number;
  /** 创建时间 */
  created_at: string;
  /** 过期时间戳 */
  expires_at: number;
  /** 签名 */
  signature: string;
  /** 访问密钥ID */
  access_key_id: string;
  /** 安全令牌 */
  security_token?: string;
  /** 请求头 */
  headers?: Record<string, string>;
}

// ==================== 临时凭证类型 ====================

/**
 * 临时凭证选项
 */
export interface TemporaryCredentialsOptions {
  /** 桶名 */
  bucket: string;
  /** 前缀（可选，限制访问范围） */
  prefix?: string;
  /** 权限 */
  permissions: ('read' | 'write' | 'delete' | 'list')[];
  /** 过期时间（秒） */
  expires_in?: number;
  /** 会话名称 */
  session_name?: string;
  /** 外部ID */
  external_id?: string;
  /** 策略 */
  policy?: string;
}

/**
 * 临时凭证结果
 */
export interface TemporaryCredentialsResult {
  /** 访问密钥ID */
  access_key_id: string;
  /** 秘密访问密钥 */
  secret_access_key: string;
  /** 会话令牌 */
  session_token: string;
  /** 过期时间 */
  expiration: string;
  /** 过期时间戳 */
  expires_at: number;
  /** 桶名 */
  bucket: string;
  /** 前缀 */
  prefix?: string;
  /** 权限 */
  permissions: string[];
  /** 会话名称 */
  session_name: string;
}

// ==================== 文件预览类型 ====================

/**
 * 生成缩略图选项
 */
export interface GenerateThumbnailOptions {
  /** 宽度 */
  width?: number;
  /** 高度 */
  height?: number;
  /** 裁剪模式 */
  crop?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  /** 质量（0-100） */
  quality?: number;
  /** 格式 */
  format?: 'jpeg' | 'png' | 'webp' | 'gif';
  /** 旋转角度 */
  rotate?: number;
  /** 水印 */
  watermark?: {
    text?: string;
    image?: string;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    opacity?: number;
  };
  /** 是否缓存 */
  cache?: boolean;
  /** 缓存TTL（毫秒） */
  cache_ttl?: number;
}

/**
 * 生成缩略图结果
 */
export interface GenerateThumbnailResult {
  /** 缩略图URL */
  url: string;
  /** 缩略图数据 */
  data?: Buffer;
  /** 宽度 */
  width: number;
  /** 高度 */
  height: number;
  /** 格式 */
  format: string;
  /** 大小（字节） */
  size: number;
  /** 生成时间 */
  generated_at: string;
  /** 是否来自缓存 */
  from_cache: boolean;
}

/**
 * 文档预览选项
 */
export interface DocumentPreviewOptions {
  /** 页码（从1开始） */
  page?: number;
  /** 每页数量 */
  per_page?: number;
  /** 缩放比例 */
  scale?: number;
  /** 格式 */
  format?: 'pdf' | 'html' | 'text' | 'images';
  /** 是否缓存 */
  cache?: boolean;
  /** 缓存TTL（毫秒） */
  cache_ttl?: number;
}

/**
 * 文档预览结果
 */
export interface DocumentPreviewResult {
  /** 预览URL */
  url: string;
  /** 预览数据 */
  data?: Buffer | string;
  /** 格式 */
  format: string;
  /** 总页数 */
  total_pages: number;
  /** 当前页 */
  current_page: number;
  /** 每页数量 */
  per_page: number;
  /** 大小（字节） */
  size: number;
  /** 生成时间 */
  generated_at: string;
  /** 是否来自缓存 */
  from_cache: boolean;
}

/**
 * 视频截图选项
 */
export interface VideoScreenshotOptions {
  /** 时间戳（秒） */
  timestamp?: number;
  /** 时间格式（HH:MM:SS） */
  time_format?: string;
  /** 宽度 */
  width?: number;
  /** 高度 */
  height?: number;
  /** 质量（0-100） */
  quality?: number;
  /** 格式 */
  format?: 'jpeg' | 'png' | 'webp';
  /** 是否缓存 */
  cache?: boolean;
  /** 缓存TTL（毫秒） */
  cache_ttl?: number;
}

/**
 * 视频截图结果
 */
export interface VideoScreenshotResult {
  /** 截图URL */
  url: string;
  /** 截图数据 */
  data?: Buffer;
  /** 时间戳（秒） */
  timestamp: number;
  /** 宽度 */
  width: number;
  /** 高度 */
  height: number;
  /** 格式 */
  format: string;
  /** 大小（字节） */
  size: number;
  /** 生成时间 */
  generated_at: string;
  /** 是否来自缓存 */
  from_cache: boolean;
}

/**
 * 音频波形选项
 */
export interface AudioWaveformOptions {
  /** 采样点数 */
  samples?: number;
  /** 宽度 */
  width?: number;
  /** 高度 */
  height?: number;
  /** 颜色 */
  color?: string;
  /** 背景颜色 */
  background_color?: string;
  /** 格式 */
  format?: 'json' | 'png' | 'svg';
  /** 是否缓存 */
  cache?: boolean;
  /** 缓存TTL（毫秒） */
  cache_ttl?: number;
}

/**
 * 音频波形结果
 */
export interface AudioWaveformResult {
  /** 波形URL */
  url?: string;
  /** 波形数据 */
  data?: number[] | Buffer | string;
  /** 采样点数 */
  samples: number;
  /** 宽度 */
  width: number;
  /** 高度 */
  height: number;
  /** 格式 */
  format: string;
  /** 大小（字节） */
  size: number;
  /** 时长（秒） */
  duration: number;
  /** 生成时间 */
  generated_at: string;
  /** 是否来自缓存 */
  from_cache: boolean;
}
