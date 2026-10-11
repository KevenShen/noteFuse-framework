/**
 * RustFS 基础类型定义
 * 
 * 包含存储桶、文件对象、文件元数据等核心类型
 */

// ==================== 存储类类型 ====================

/**
 * 存储类类型
 * - STANDARD: 标准存储（高频访问）
 * - STANDARD_IA: 低频访问存储
 * - ARCHIVE: 归档存储
 * - DEEP_ARCHIVE: 深度归档存储
 * - INTELLIGENT_TIERING: 智能分层存储
 * - REDUCED_REDUNDANCY: 低冗余存储
 * - GLACIER: 冰川存储
 * - COLD: 冷存储
 */
export type StorageClass =
  | 'STANDARD'
  | 'STANDARD_IA'
  | 'ARCHIVE'
  | 'DEEP_ARCHIVE'
  | 'INTELLIGENT_TIERING'
  | 'REDUCED_REDUNDANCY'
  | 'GLACIER'
  | 'COLD';

// ==================== ACL权限类型 ====================

/**
 * ACL权限类型
 * - private: 私有（仅所有者可访问）
 * - public-read: 公共读（任何人可读）
 * - public-read-write: 公共读写（任何人可读写）
 * - authenticated-read: 认证用户读
 * - bucket-owner-read: 桶所有者读
 * - bucket-owner-full-control: 桶所有者完全控制
 * - log-delivery-write: 日志投递写
 */
export type ACLType =
  | 'private'
  | 'public-read'
  | 'public-read-write'
  | 'authenticated-read'
  | 'bucket-owner-read'
  | 'bucket-owner-full-control'
  | 'log-delivery-write';

// ==================== 文件元数据类型 ====================

/**
 * 文件元数据
 */
export interface FileMetadata {
  /** 文件大小（字节） */
  size: number;
  /** MIME类型 */
  content_type: string;
  /** ETag（MD5哈希） */
  etag: string;
  /** 最后修改时间 */
  last_modified: string;
  /** 创建时间 */
  creation_date?: string;
  /** 存储类 */
  storage_class: StorageClass;
  /** ACL权限 */
  acl: ACLType;
  /** 自定义元数据 */
  custom_metadata?: Record<string, string>;
  /** 标签 */
  tags?: Record<string, string>;
  /** 版本ID */
  version_id?: string;
  /** 是否为最新版本 */
  is_latest?: boolean;
  /** 是否为删除标记 */
  is_delete_marker?: boolean;
  /** 内容编码 */
  content_encoding?: string;
  /** 内容语言 */
  content_language?: string;
  /** 内容处置 */
  content_disposition?: string;
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
}

// ==================== 文件对象类型 ====================

/**
 * 文件对象
 */
export interface FileObject {
  /** 对象键（路径） */
  key: string;
  /** 所属桶 */
  bucket: string;
  /** 版本ID（启用版本控制时） */
  version_id?: string;
  /** 文件大小（字节） */
  size: number;
  /** MIME类型 */
  content_type: string;
  /** ETag（MD5哈希） */
  etag: string;
  /** 最后修改时间 */
  last_modified: string;
  /** 存储类 */
  storage_class: StorageClass;
  /** ACL权限 */
  acl: ACLType;
  /** 标签 */
  tags: Record<string, string>;
  /** 自定义元数据 */
  metadata: Record<string, string>;
  /** 是否为删除标记 */
  is_delete_marker?: boolean;
  /** 是否为最新版本 */
  is_latest?: boolean;
  /** 分片信息（分片上传时） */
  parts?: UploadPart[];
  /** 文件内容（Mock环境） */
  data?: Buffer | string;
  /** 预览信息 */
  preview?: FilePreview;
  /** 所有者 */
  owner?: FileOwner;
  /** 复制状态 */
  replication_status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REPLICA';
}

/**
 * 文件所有者
 */
export interface FileOwner {
  /** 所有者ID */
  id: string;
  /** 所有者名称 */
  display_name: string;
}

/**
 * 文件预览信息
 */
export interface FilePreview {
  /** 预览类型 */
  type: 'thumbnail' | 'document' | 'video' | 'audio' | 'text';
  /** 预览URL */
  url?: string;
  /** 预览数据 */
  data?: Buffer | string;
  /** 预览宽度 */
  width?: number;
  /** 预览高度 */
  height?: number;
  /** 预览时长（视频/音频） */
  duration?: number;
  /** 生成时间 */
  generated_at: string;
  /** 过期时间 */
  expires_at?: string;
}

// ==================== 上传分片类型 ====================

/**
 * 上传分片
 */
export interface UploadPart {
  /** 分片编号 */
  part_number: number;
  /** 分片大小（字节） */
  size: number;
  /** 分片ETag */
  etag: string;
  /** 上传时间 */
  uploaded_at: string;
  /** 分片数据（Mock环境） */
  data?: Buffer | string;
}

/**
 * 分片上传会话
 */
export interface MultipartUpload {
  /** 上传ID */
  upload_id: string;
  /** 桶名 */
  bucket: string;
  /** 对象键 */
  key: string;
  /** 初始化时间 */
  initiated_at: string;
  /** 存储类 */
  storage_class: StorageClass;
  /** ACL权限 */
  acl: ACLType;
  /** 元数据 */
  metadata: Record<string, string>;
  /** 已上传的分片 */
  parts: UploadPart[];
  /** 上传状态 */
  status: 'in_progress' | 'completed' | 'aborted';
  /** 所有者 */
  owner?: FileOwner;
}

// ==================== 存储桶类型 ====================

/**
 * 存储桶设置
 */
export interface BucketSettings {
  /** 版本控制 */
  versioning: boolean;
  /** 对象锁定 */
  object_lock: boolean;
  /** 服务器端加密 */
  server_side_encryption?: {
    algorithm: string;
    kms_key_id?: string;
  };
  /** CORS配置 */
  cors?: CORSConfiguration;
  /** 静态网站托管 */
  website?: WebsiteConfiguration;
  /** 日志记录 */
  logging?: LoggingConfiguration;
  /** 通知配置 */
  notification?: NotificationConfiguration;
  /** 加速配置 */
  accelerate?: boolean;
  /** 请求付费 */
  request_payment?: 'BucketOwner' | 'Requester';
}

/**
 * CORS配置
 */
export interface CORSConfiguration {
  /** CORS规则 */
  cors_rules: CORSRule[];
}

/**
 * CORS规则
 */
export interface CORSRule {
  /** 允许的来源 */
  allowed_origins: string[];
  /** 允许的方法 */
  allowed_methods: string[];
  /** 允许的头 */
  allowed_headers?: string[];
  /** 暴露的头 */
  expose_headers?: string[];
  /** 缓存时间（秒） */
  max_age_seconds?: number;
}

/**
 * 静态网站托管配置
 */
export interface WebsiteConfiguration {
  /** 索引文档 */
  index_document: { suffix: string };
  /** 错误文档 */
  error_document?: { key: string };
  /** 重定向规则 */
  redirect_rules?: RedirectRule[];
}

/**
 * 重定向规则
 */
export interface RedirectRule {
  /** 条件 */
  condition?: {
    key_prefix_equals?: string;
    http_error_code_returned_equals?: string;
  };
  /** 重定向 */
  redirect: {
    host_name?: string;
    protocol?: string;
    replace_key_prefix_with?: string;
    replace_key_with?: string;
    http_redirect_code?: string;
  };
}

/**
 * 日志记录配置
 */
export interface LoggingConfiguration {
  /** 目标桶 */
  target_bucket: string;
  /** 目标前缀 */
  target_prefix?: string;
  /** 目标授权 */
  target_grants?: Grant[];
}

/**
 * 授权
 */
export interface Grant {
  /** 被授权者 */
  grantee: {
    type: string;
    id?: string;
    uri?: string;
  };
  /** 权限 */
  permission: string;
}

/**
 * 通知配置
 */
export interface NotificationConfiguration {
  /** 主题配置 */
  topic_configurations?: TopicConfiguration[];
  /** 队列配置 */
  queue_configurations?: QueueConfiguration[];
  /** Lambda函数配置 */
  lambda_function_configurations?: LambdaFunctionConfiguration[];
}

/**
 * 主题通知配置
 */
export interface TopicConfiguration {
  id: string;
  topic_arn: string;
  events: string[];
  filter?: {
    key: {
      filter_rules: { name: string; value: string }[];
    };
  };
}

/**
 * 队列通知配置
 */
export interface QueueConfiguration {
  id: string;
  queue_arn: string;
  events: string[];
  filter?: {
    key: {
      filter_rules: { name: string; value: string }[];
    };
  };
}

/**
 * Lambda函数通知配置
 */
export interface LambdaFunctionConfiguration {
  id: string;
  lambda_function_arn: string;
  events: string[];
  filter?: {
    key: {
      filter_rules: { name: string; value: string }[];
    };
  };
}

/**
 * 存储桶
 */
export interface Bucket {
  /** 桶名（全局唯一） */
  name: string;
  /** 创建时间 */
  creation_date: string;
  /** 区域 */
  region: string;
  /** 默认存储类 */
  storage_class: StorageClass;
  /** 默认ACL */
  acl: ACLType;
  /** 版本控制 */
  versioning: boolean;
  /** 对象锁定 */
  object_lock: boolean;
  /** 标签 */
  tags: Record<string, string>;
  /** 元数据 */
  metadata: Record<string, string>;
  /** 桶设置 */
  settings: BucketSettings;
  /** 生命周期规则 */
  lifecycle_rules: any[];
  /** 复制规则 */
  replication_rules: any[];
  /** 配额 */
  quota?: BucketQuota;
  /** 对象数量 */
  object_count: number;
  /** 总大小（字节） */
  total_size: number;
  /** 所有者 */
  owner?: FileOwner;
}

/**
 * 桶配额
 */
export interface BucketQuota {
  /** 配额大小（字节） */
  size_limit: number;
  /** 对象数量限制 */
  object_count_limit?: number;
  /** 配额类型 */
  type: 'hard' | 'soft';
  /** 告警阈值（百分比） */
  alert_threshold?: number;
}

// ==================== 列表结果类型 ====================

/**
 * 桶列表结果
 */
export interface ListBucketsResult {
  /** 桶列表 */
  buckets: Bucket[];
  /** 所有者 */
  owner: FileOwner;
}

/**
 * 对象列表结果
 */
export interface ListObjectsResult {
  /** 对象列表 */
  contents: FileObject[];
  /** 桶名 */
  name: string;
  /** 前缀 */
  prefix: string;
  /** 分隔符 */
  delimiter?: string;
  /** 标记 */
  marker?: string;
  /** 下一个标记 */
  next_marker?: string;
  /** 最大键数 */
  max_keys: number;
  /** 是否被截断 */
  is_truncated: boolean;
  /** 通用前缀 */
  common_prefixes?: { prefix: string }[];
}

/**
 * 对象版本列表结果
 */
export interface ListObjectVersionsResult {
  /** 对象版本列表 */
  versions: FileObject[];
  /** 删除标记列表 */
  delete_markers: FileObject[];
  /** 桶名 */
  name: string;
  /** 前缀 */
  prefix: string;
  /** 键标记 */
  key_marker?: string;
  /** 版本ID标记 */
  version_id_marker?: string;
  /** 下一个键标记 */
  next_key_marker?: string;
  /** 下一个版本ID标记 */
  next_version_id_marker?: string;
  /** 最大键数 */
  max_keys: number;
  /** 是否被截断 */
  is_truncated: boolean;
  /** 通用前缀 */
  common_prefixes?: { prefix: string }[];
}

/**
 * 分片上传列表结果
 */
export interface ListMultipartUploadsResult {
  /** 分片上传列表 */
  uploads: MultipartUpload[];
  /** 桶名 */
  bucket: string;
  /** 前缀 */
  prefix?: string;
  /** 键标记 */
  key_marker?: string;
  /** 上传ID标记 */
  upload_id_marker?: string;
  /** 下一个键标记 */
  next_key_marker?: string;
  /** 下一个上传ID标记 */
  next_upload_id_marker?: string;
  /** 最大上传数 */
  max_uploads: number;
  /** 是否被截断 */
  is_truncated: boolean;
  /** 通用前缀 */
  common_prefixes?: { prefix: string }[];
}

/**
 * 分片列表结果
 */
export interface ListPartsResult {
  /** 分片列表 */
  parts: UploadPart[];
  /** 桶名 */
  bucket: string;
  /** 对象键 */
  key: string;
  /** 上传ID */
  upload_id: string;
  /** 存储类 */
  storage_class: StorageClass;
  /** 初始化者 */
  initiator?: FileOwner;
  /** 所有者 */
  owner?: FileOwner;
  /** 分片编号标记 */
  part_number_marker?: number;
  /** 下一个分片编号标记 */
  next_part_number_marker?: number;
  /** 最大分片数 */
  max_parts: number;
  /** 是否被截断 */
  is_truncated: boolean;
}

// ==================== 上传/下载选项类型 ====================

/**
 * 上传选项
 */
export interface UploadOptions {
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
  /** 如果不存在则上传 */
  if_none_match?: string;
  /** 如果匹配则上传 */
  if_match?: string;
  /** 元数据指令（COPY/REPLACE） */
  metadata_directive?: 'COPY' | 'REPLACE';
  /** 标签指令（COPY/REPLACE） */
  tagging_directive?: 'COPY' | 'REPLACE';
  /** 源版本ID */
  source_version_id?: string;
  /** 进度回调 */
  on_progress?: (uploaded: number, total: number) => void;
}

/**
 * 下载选项
 */
export interface DownloadOptions {
  /** 版本ID */
  version_id?: string;
  /** 范围开始 */
  range_start?: number;
  /** 范围结束 */
  range_end?: number;
  /** 如果匹配则下载 */
  if_match?: string;
  /** 如果不匹配则下载 */
  if_none_match?: string;
  /** 如果修改时间之后则下载 */
  if_modified_since?: string;
  /** 如果修改时间之前则下载 */
  if_unmodified_since?: string;
  /** 响应内容类型 */
  response_content_type?: string;
  /** 响应内容语言 */
  response_content_language?: string;
  /** 响应内容处置 */
  response_content_disposition?: string;
  /** 响应缓存控制 */
  response_cache_control?: string;
  /** 响应过期时间 */
  response_expires?: string;
  /** 进度回调 */
  on_progress?: (downloaded: number, total: number) => void;
}

/**
 * 复制选项
 */
export interface CopyOptions {
  /** 存储类 */
  storage_class?: StorageClass;
  /** ACL权限 */
  acl?: ACLType;
  /** 自定义元数据（替换源元数据） */
  metadata?: Record<string, string>;
  /** 元数据指令（COPY/REPLACE） */
  metadata_directive?: 'COPY' | 'REPLACE';
  /** 标签指令（COPY/REPLACE） */
  tagging_directive?: 'COPY' | 'REPLACE';
  /** 标签 */
  tags?: Record<string, string>;
  /** 源版本ID */
  source_version_id?: string;
  /** 如果匹配则复制 */
  if_match?: string;
  /** 如果不匹配则复制 */
  if_none_match?: string;
  /** 如果修改时间之后则复制 */
  if_modified_since?: string;
  /** 如果修改时间之前则复制 */
  if_unmodified_since?: string;
  /** 服务器端加密 */
  server_side_encryption?: string;
}

// ==================== 错误类型 ====================

/**
 * RustFS错误
 */
export interface RustFSError {
  /** 错误代码 */
  code: string;
  /** 错误消息 */
  message: string;
  /** 桶名 */
  bucket?: string;
  /** 对象键 */
  key?: string;
  /** 请求ID */
  request_id?: string;
  /** 主机ID */
  host_id?: string;
  /** 资源 */
  resource?: string;
}

/**
 * 创建桶选项
 */
export interface CreateBucketOptions {
  /** 区域 */
  region?: string;
  /** 默认存储类 */
  storage_class?: StorageClass;
  /** 默认ACL */
  acl?: ACLType;
  /** 启用版本控制 */
  versioning?: boolean;
  /** 启用对象锁定 */
  object_lock?: boolean;
  /** 标签 */
  tags?: Record<string, string>;
  /** 元数据 */
  metadata?: Record<string, string>;
  /** 配额 */
  quota?: BucketQuota;
  /** CORS配置 */
  cors?: CORSConfiguration;
}

/**
 * RustFS配置
 */
export interface RustFSConfig {
  /** 默认区域 */
  default_region?: string;
  /** 默认存储类 */
  default_storage_class?: StorageClass;
  /** 默认ACL */
  default_acl?: ACLType;
  /** 最大桶数量 */
  max_buckets?: number;
  /** 最大对象大小（字节） */
  max_object_size?: number;
  /** 最小分片大小（字节） */
  min_part_size?: number;
  /** 最大分片数量 */
  max_parts?: number;
  /** 分片上传过期时间（秒） */
  multipart_upload_expiry?: number;
  /** 预签名URL过期时间（秒） */
  presigned_url_expiry?: number;
  /** 启用缓存 */
  enable_cache?: boolean;
  /** 缓存TTL（毫秒） */
  cache_ttl?: number;
  /** 启用版本控制默认值 */
  default_versioning?: boolean;
  /** 集群名称 */
  cluster_name?: string;
  /** 节点数量 */
  node_count?: number;
  /** 复制因子 */
  replication_factor?: number;
}

/**
 * 默认RustFS配置
 */
export const DEFAULT_RUSTFS_CONFIG: Required<RustFSConfig> = {
  default_region: 'us-east-1',
  default_storage_class: 'STANDARD',
  default_acl: 'private',
  max_buckets: 1000,
  max_object_size: 5 * 1024 * 1024 * 1024, // 5TB
  min_part_size: 5 * 1024 * 1024, // 5MB
  max_parts: 10000,
  multipart_upload_expiry: 7 * 24 * 60 * 60, // 7天
  presigned_url_expiry: 3600, // 1小时
  enable_cache: true,
  cache_ttl: 60000, // 60秒
  default_versioning: false,
  cluster_name: 'rustfs-cluster',
  node_count: 1,
  replication_factor: 1,
};
