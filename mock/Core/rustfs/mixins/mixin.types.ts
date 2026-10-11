/**
 * RustFS Mixin 类型定义
 * 
 * 包含Mixin组合所需的类型定义和接口
 */

import type { MockRustFSBase } from '../MockRustFSBase';

/**
 * 构造函数类型
 */
export type Constructor<T = {}> = new (...args: any[]) => T;

/**
 * IMockRustFSBase 接口
 * 
 * 声明基类中所有Mixin需要访问的属性和方法
 * 用于Mixin中的类型检查
 */
export interface IMockRustFSBase {
  // 核心配置
  config: Required<import('../types').RustFSConfig>;

  // 数据存储
  buckets: Map<string, import('../types').Bucket>;
  objects: Map<string, import('../types').FileObject>;
  multipartUploads: Map<string, import('../types').MultipartUpload>;

  // 缓存
  queryCache: Map<string, import('../types').CacheEntry>;
  cacheHitCount: number;
  cacheMissCount: number;
  cacheEvictionCount: number;
  cacheConfig: import('../types').CacheConfig;

  // 集群状态
  clusterName: string;
  clusterUUID: string;
  clusterStateVersion: number;
  nodes: Map<string, any>;

  // 统计
  totalUploads: number;
  totalDownloads: number;
  totalDeletes: number;
  totalUploadedBytes: number;
  totalDownloadedBytes: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;

  // 其他
  pendingTasks: any[];
  debug: boolean;

  // 方法
  generateObjectKey(bucket: string, key: string, versionId?: string): string;
  parseObjectKey(internalKey: string): { bucket: string; key: string; versionId: string };
  recordRequest(success: boolean): void;
  recordUpload(size: number): void;
  recordDownload(size: number): void;
  recordDelete(): void;
  debugLog(message: string, data?: any): void;
  enableDebug(): void;
  disableDebug(): void;
  getConfig(): Required<import('../types').RustFSConfig>;
  reset(): void;
}

/**
 * Mixin 基础类型
 */
export type MixinBase = Constructor<IMockRustFSBase>;

/**
 * L1 基础层 Mixin 接口
 */
export interface IL1BasicMixin {
  // 存储桶管理
  createBucket(name: string, options?: any): any;
  deleteBucket(name: string): any;
  listBuckets(prefix?: string, marker?: string, maxKeys?: number): any;
  bucketExists(name: string): boolean;
  getBucket(name: string): any;
  getBucketLocation(name: string): string;

  // 文件上传
  upload(bucket: string, key: string, data: any, options?: any): any;
  putObject(bucket: string, key: string, data: any, options?: any): any;

  // 文件下载
  download(bucket: string, key: string, options?: any): any;
  getObject(bucket: string, key: string, options?: any): any;
  headObject(bucket: string, key: string): any;

  // 文件删除
  deleteObject(bucket: string, key: string): any;
  deleteObjects(bucket: string, keys: string[]): any;

  // 文件元数据
  getObjectMetadata(bucket: string, key: string): any;
  setObjectMetadata(bucket: string, key: string, metadata: Record<string, string>): any;
  objectExists(bucket: string, key: string): boolean;
  listObjects(bucket: string, prefix?: string, delimiter?: string, marker?: string, maxKeys?: number): any;
}

/**
 * L2 操作层 Mixin 接口
 */
export interface IL2OperationMixin {
  // 文件操作
  copyObject(sourceBucket: string, sourceKey: string, destBucket: string, destKey: string, options?: any): any;
  moveObject(sourceBucket: string, sourceKey: string, destBucket: string, destKey: string): any;
  renameObject(bucket: string, oldKey: string, newKey: string): any;

  // 目录操作
  createDirectory(bucket: string, path: string): any;
  listDirectory(bucket: string, path: string, recursive?: boolean): any;
  directoryExists(bucket: string, path: string): boolean;
  getDirectorySize(bucket: string, path: string): number;
  deleteDirectory(bucket: string, path: string, recursive?: boolean): any;

  // 批量操作
  bulkUpload(bucket: string, files: any[]): any;
  bulkDownload(bucket: string, keys: string[]): any;
  bulkDelete(bucket: string, keys: string[]): any;
}

/**
 * L3 高级功能层 Mixin 接口
 */
export interface IL3AdvancedMixin {
  // 版本管理
  enableVersioning(bucket: string): any;
  suspendVersioning(bucket: string): any;
  getVersioningStatus(bucket: string): boolean;
  listObjectVersions(bucket: string, prefix?: string): any;
  getObjectVersion(bucket: string, key: string, versionId: string): any;
  deleteObjectVersion(bucket: string, key: string, versionId: string): any;
  restoreObjectVersion(bucket: string, key: string, versionId: string): any;

  // 分片上传
  createMultipartUpload(bucket: string, key: string, options?: any): any;
  uploadPart(bucket: string, key: string, uploadId: string, partNumber: number, data: any): any;
  completeMultipartUpload(bucket: string, key: string, uploadId: string, parts: any[]): any;
  abortMultipartUpload(bucket: string, key: string, uploadId: string): any;
  listMultipartUploads(bucket: string, prefix?: string): any;
  listParts(bucket: string, key: string, uploadId: string): any;

  // 文件预览
  generateThumbnail(bucket: string, key: string, width: number, height: number, options?: any): any;
  getPreviewUrl(bucket: string, key: string, expiresIn?: number): string;
  supportsPreview(contentType: string): boolean;
}

/**
 * L4 扩展功能层 Mixin 接口
 */
export interface IL4ExtensionMixin {
  // 权限管理
  setObjectACL(bucket: string, key: string, acl: string): any;
  getObjectACL(bucket: string, key: string): any;
  setBucketPolicy(bucket: string, policy: any): any;
  getBucketPolicy(bucket: string): any;
  generatePresignedUrl(bucket: string, key: string, method: string, expiresIn?: number): any;

  // 标签管理
  putObjectTagging(bucket: string, key: string, tags: Record<string, string>): any;
  getObjectTagging(bucket: string, key: string): Record<string, string>;
  deleteObjectTagging(bucket: string, key: string): any;
  listObjectsByTag(bucket: string, tagKey: string, tagValue?: string): any[];

  // 生命周期管理
  putLifecycleConfiguration(bucket: string, rules: any[]): any;
  getLifecycleConfiguration(bucket: string): any[];
  deleteLifecycleConfiguration(bucket: string): any;
  executeLifecycleRules(bucket: string): any;

  // 复制管理
  putReplicationConfiguration(bucket: string, rules: any[]): any;
  getReplicationConfiguration(bucket: string): any[];
  deleteReplicationConfiguration(bucket: string): any;
  triggerReplication(sourceBucket: string, sourceKey: string): any;
}

/**
 * L5 运维管理层 Mixin 接口
 */
export interface IL5OperationMixin {
  // 存储统计
  getBucketStats(bucket: string): any;
  getTotalStats(): any;
  getObjectCount(bucket: string, prefix?: string): number;
  getTotalSize(bucket: string, prefix?: string): number;
  getStorageClassDistribution(bucket: string): any;
  getContentTypeDistribution(bucket: string): any;

  // 配额管理
  setBucketQuota(bucket: string, quota: any): any;
  getBucketQuota(bucket: string): any;
  deleteBucketQuota(bucket: string): any;
  checkBucketQuota(bucket: string, size: number): boolean;
  getQuotaUsage(bucket: string): any;

  // 集群管理
  getClusterStatus(): any;
  getClusterHealth(): any;
  listNodes(): any[];
  getNodeInfo(nodeId: string): any;
  getNodeStats(nodeId: string): any;
  getPerformanceMetrics(): any;
  getSystemInfo(): any;

  // 缓存管理
  getCacheStats(): any;
  clearCache(bucket?: string, key?: string): void;
  setCacheConfig(config: Partial<any>): void;
  getCacheConfig(): any;
}

/**
 * 完整的 MockRustFS 接口（所有Mixin组合）
 */
export interface IMockRustFS
  extends IMockRustFSBase,
    IL1BasicMixin,
    IL2OperationMixin,
    IL3AdvancedMixin,
    IL4ExtensionMixin,
    IL5OperationMixin {}
