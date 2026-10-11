/**
 * RustFS Mock 主类
 * 
 * 通过Mixin组合模式，组合所有功能Mixin
 * 
 * 使用方式：
 * const rustfs = new MockRustFS();
 * rustfs.createBucket('my-bucket');
 * rustfs.upload('my-bucket', 'file.txt', 'Hello World');
 * const result = rustfs.download('my-bucket', 'file.txt');
 */

import { MockRustFSBase } from './MockRustFSBase';
import { applyMixins } from './mixins/mixin.utils';
import type { RustFSConfig } from './types';

// 导入所有功能Mixin
import { WithBucketManagement } from './mixins/01-bucket-management.mixin';
import { WithFileUpload } from './mixins/02-file-upload.mixin';
import { WithFileDownload } from './mixins/03-file-download.mixin';
import { WithFileDelete } from './mixins/04-file-delete.mixin';
import { WithFileMetadata } from './mixins/05-file-metadata.mixin';
// L2 操作层
import { WithFileOperation } from './mixins/06-file-operation.mixin';
import { WithDirectory } from './mixins/07-directory.mixin';
import { WithBulkOperation } from './mixins/08-bulk-operation.mixin';
// L3 高级功能层
import { WithVersioning } from './mixins/09-versioning.mixin';
import { WithMultipartUpload } from './mixins/10-multipart-upload.mixin';
import { WithFilePreview } from './mixins/11-file-preview.mixin';
// L4 扩展功能层
import { WithPermission } from './mixins/12-permission.mixin';
import { WithTagging } from './mixins/13-tagging.mixin';
import { WithLifecycle } from './mixins/14-lifecycle.mixin';
import { WithReplication } from './mixins/15-replication.mixin';
// L5 运维管理层
import { WithStorageStats } from './mixins/16-storage-stats.mixin';
import { WithQuota } from './mixins/17-quota.mixin';
import { WithCluster } from './mixins/18-cluster.mixin';
// L5 运维管理层（待实现）
// import { WithStorageStats } from './mixins/16-storage-stats.mixin';
// import { WithQuota } from './mixins/17-quota.mixin';
// import { WithCluster } from './mixins/18-cluster.mixin';

/**
 * 基础类（包含所有共享属性和构造函数）
 */
class MockRustFSBaseClass<T extends Record<string, any> = Record<string, any>> extends MockRustFSBase {
  // 可以在这里添加特定的方法
}

/**
 * 组合所有 Mixin
 * 
 * 注意：Mixin的应用顺序很重要，后应用的Mixin会覆盖先应用的同名方法
 * 按 L1→L2→L3→L4→L5 的顺序应用
 */
const EnhancedMockRustFS = applyMixins(
  MockRustFSBaseClass,
  // L1 基础层
  WithBucketManagement,
  WithFileUpload,
  WithFileDownload,
  WithFileDelete,
  WithFileMetadata,
  // L2 操作层
  WithFileOperation,
  WithDirectory,
  WithBulkOperation,
  // L3 高级功能层
  WithVersioning,
  WithMultipartUpload,
  WithFilePreview,
  // L4 扩展功能层
  WithPermission,
  WithTagging,
  WithLifecycle,
  WithReplication,
  // L5 运维管理层
  WithStorageStats,
  WithQuota,
  WithCluster,
  // L5 运维管理层
  // WithStorageStats,
  // WithQuota,
  // WithCluster,
);

/**
 * MockRustFS 接口类型声明
 *
 * 【设计说明】
 * 由于 MockRustFS 类通过 18 层 Mixin 组合模式构建，继承自 any 类型的基类，
 * TypeScript 无法自动推断其方法类型。
 *
 * 使用 TypeScript 声明合并（declaration merging）特性：
 * - interface MockRustFS 与 class MockRustFS 自动合并
 * - 为所有公共方法提供完整的类型声明
 *
 * 【方法分组】（5组，按基础到高级递进）
 * L1 基础层（存储桶管理/文件上传/文件下载/文件删除/文件元数据）
 * L2 操作层（文件操作/目录操作/批量操作）
 * L3 高级功能层（版本管理/分片上传/文件预览）
 * L4 扩展功能层（权限管理/标签管理/生命周期/跨桶复制）
 * L5 运维管理层（存储统计/配额管理/集群管理）
 */
export interface MockRustFS {
  // ==================== L1 基础层 ====================
  // 存储桶管理
  createBucket(name: string, options?: any): any;
  deleteBucket(name: string): any;
  listBuckets(prefix?: string, marker?: string, maxKeys?: number): any;
  bucketExists(name: string): boolean;
  getBucket(name: string): any;
  getBucketLocation(name: string): string;
  getBucketACL(name: string): any;
  setBucketACL(name: string, acl: any): any;
  getBucketPolicy(name: string): any;
  setBucketPolicy(name: string, policy: any): any;
  deleteBucketPolicy(name: string): any;
  getBucketCORS(name: string): any;
  setBucketCORS(name: string, cors: any): any;
  deleteBucketCORS(name: string): any;
  getBucketVersioning(name: string): any;
  setBucketVersioning(name: string, status: 'Enabled' | 'Suspended'): any;
  getBucketEncryption(name: string): any;
  setBucketEncryption(name: string, config: any): any;
  deleteBucketEncryption(name: string): any;

  // 文件上传
  upload(bucket: string, key: string, data: any, options?: any): any;
  putObject(bucket: string, key: string, data: any, options?: any): any;
  appendObject(bucket: string, key: string, data: any, options?: any): any;
  presignPutObject(bucket: string, key: string, expiresIn?: number, options?: any): string;
  getUploadUrl(bucket: string, key: string, expiresIn?: number): string;

  // 文件下载
  download(bucket: string, key: string, options?: any): any;
  getObject(bucket: string, key: string, options?: any): any;
  headObject(bucket: string, key: string): any;
  getObjectRange(bucket: string, key: string, rangeStart: number, rangeEnd: number): any;
  downloadStream(bucket: string, key: string, options?: any): any;
  getDownloadUrl(bucket: string, key: string, expiresIn?: number): string;
  presignGetObject(bucket: string, key: string, expiresIn?: number): string;

  // 文件删除
  deleteObject(bucket: string, key: string): any;
  deleteObjects(bucket: string, keys: string[]): any;
  restoreObject(bucket: string, key: string, days?: number): any;

  // 文件元数据
  getObjectMetadata(bucket: string, key: string): any;
  setObjectMetadata(bucket: string, key: string, metadata: Record<string, string>): any;
  objectExists(bucket: string, key: string): boolean;
  listObjects(bucket: string, prefix?: string, delimiter?: string, marker?: string, maxKeys?: number): any;
  listObjectsV2(bucket: string, options?: any): any;
  getObjectACL(bucket: string, key: string): any;
  setObjectACL(bucket: string, key: string, acl: any): any;
  getObjectStorageClass(bucket: string, key: string): any;
  setObjectStorageClass(bucket: string, key: string, storageClass: any): any;

  // ==================== L2 操作层 ====================
  // 文件操作
  copyObject(sourceBucket: string, sourceKey: string, destBucket: string, destKey: string, options?: any): any;
  moveObject(sourceBucket: string, sourceKey: string, destBucket: string, destKey: string): any;
  renameObject(bucket: string, oldKey: string, newKey: string): any;
  truncateObject(bucket: string, key: string, size: number): any;
  getFileInfo(bucket: string, key: string): any;
  calculateETag(data: any): string;
  generatePresignedUrl(bucket: string, key: string, method: string, expiresIn?: number, options?: any): string;

  // 目录操作
  createDirectory(bucket: string, path: string): any;
  listDirectory(bucket: string, path: string, recursive?: boolean): any;
  directoryExists(bucket: string, path: string): boolean;
  getDirectorySize(bucket: string, path: string): number;
  deleteDirectory(bucket: string, path: string, recursive?: boolean): any;
  moveDirectory(sourceBucket: string, sourcePath: string, destBucket: string, destPath: string): any;
  copyDirectory(sourceBucket: string, sourcePath: string, destBucket: string, destPath: string): any;

  // 批量操作
  bulkUpload(bucket: string, files: any[]): any;
  bulkDownload(bucket: string, keys: string[]): any;
  bulkDelete(bucket: string, keys: string[]): any;
  bulkCopy(sourceBucket: string, sourceKeys: string[], destBucket: string, destPrefix?: string): any;
  bulkMove(sourceBucket: string, sourceKeys: string[], destBucket: string, destPrefix?: string): any;

  // ==================== L3 高级功能层 ====================
  // 版本管理
  enableVersioning(bucket: string): any;
  suspendVersioning(bucket: string): any;
  getVersioningStatus(bucket: string): boolean;
  listObjectVersions(bucket: string, prefix?: string, options?: any): any;
  getObjectVersion(bucket: string, key: string, versionId: string): any;
  deleteObjectVersion(bucket: string, key: string, versionId: string): any;
  restoreObjectVersion(bucket: string, key: string, versionId: string): any;
  getObjectVersionStats(bucket: string, key: string): any;

  // 分片上传
  createMultipartUpload(bucket: string, key: string, options?: any): any;
  uploadPart(bucket: string, key: string, uploadId: string, partNumber: number, data: any): any;
  completeMultipartUpload(bucket: string, key: string, uploadId: string, parts: any[]): any;
  abortMultipartUpload(bucket: string, key: string, uploadId: string): any;
  listMultipartUploads(bucket: string, prefix?: string): any;
  listParts(bucket: string, key: string, uploadId: string): any;
  uploadPartCopy(sourceBucket: string, sourceKey: string, destBucket: string, destKey: string, uploadId: string, partNumber: number, options?: any): any;

  // 文件预览
  generateThumbnail(bucket: string, key: string, width: number, height: number, options?: any): any;
  getPreviewUrl(bucket: string, key: string, expiresIn?: number): string;
  supportsPreview(contentType: string): boolean;
  getSupportedPreviewTypes(): string[];
  convertDocument(bucket: string, key: string, targetFormat: string, options?: any): any;

  // ==================== L4 扩展功能层 ====================
  // 权限管理
  getBucketACLFull(bucket: string): any;
  setBucketACLFull(bucket: string, acl: any): any;
  getObjectACLFull(bucket: string, key: string): any;
  setObjectACLFull(bucket: string, key: string, acl: any): any;
  getBucketPolicyFull(bucket: string): any;
  setBucketPolicyFull(bucket: string, policy: any): any;
  deleteBucketPolicyFull(bucket: string): any;
  generatePresignedUrlWithPolicy(bucket: string, key: string, method: string, policy: any, expiresIn?: number): string;
  verifyPresignedUrl(url: string): any;

  // 标签管理
  putObjectTagging(bucket: string, key: string, tags: Record<string, string>, options?: any): any;
  getObjectTagging(bucket: string, key: string, options?: any): any;
  deleteObjectTagging(bucket: string, key: string, options?: any): any;
  putBucketTagging(bucket: string, tags: Record<string, string>): any;
  getBucketTagging(bucket: string): any;
  deleteBucketTagging(bucket: string): any;
  listObjectsByTags(bucket: string, tags: Array<{ key: string; value?: string }>): any;
  copyObjectTags(sourceBucket: string, sourceKey: string, destBucket: string, destKey: string): any;

  // 生命周期管理
  putBucketLifecycle(bucket: string, configuration: any): any;
  getBucketLifecycle(bucket: string): any;
  deleteBucketLifecycle(bucket: string): any;
  executeLifecycleRules(bucket: string, options?: any): any;
  putObjectLockConfiguration(bucket: string, configuration: any): any;
  getObjectLockConfiguration(bucket: string): any;
  putObjectRetention(bucket: string, key: string, retention: any, options?: any): any;
  getObjectRetention(bucket: string, key: string, options?: any): any;

  // 跨桶复制
  putBucketReplication(bucket: string, configuration: any): any;
  getBucketReplication(bucket: string): any;
  deleteBucketReplication(bucket: string): any;
  getReplicationStatus(bucket: string, key: string): any;
  replicateObject(sourceBucket: string, sourceKey: string, destBucket: string, destKey?: string): any;

  // ==================== L5 运维管理层 ====================
  // 存储统计
  getTotalStats(): any;
  getBucketStats(bucket: string): any;
  getFileSizeDistribution(bucket?: string): any;
  getStorageClassStats(bucket?: string): any;
  getStorageUsageTrend(bucket: string, days?: number): any;
  getRequestStats(bucket?: string): any;
  getBandwidthStats(bucket?: string): any;

  // 配额管理
  setBucketQuota(bucket: string, quota: any): any;
  getBucketQuota(bucket: string): any;
  deleteBucketQuota(bucket: string): any;
  getBucketQuotaUsage(bucket: string): any;
  setUserQuota(userId: string, quota: any): any;
  getUserQuota(userId: string): any;
  getUserQuotaUsage(userId: string): any;
  checkUploadQuota(bucket: string, size: number, userId?: string): any;
  getAllBucketsQuotaUsage(): any;

  // 集群管理
  getClusterHealth(): any;
  getClusterState(): any;
  getClusterStats(): any;
  getNodeInfo(nodeId?: string): any;
  getNodeStats(nodeId?: string): any;
  listNodes(): any;
  addNode(node: any): any;
  removeNode(nodeId: string): any;
  getClusterSettings(): any;
  updateClusterSettings(settings: any): any;

  // 工具方法
  getVersion(): string;
  getSupportedFeatures(): string[];
  getConfig(): any;
  reset(): void;
  enableDebug(): void;
  disableDebug(): void;
}

/**
 * RustFS Mock 主类
 *
 * 完整的对象存储模拟实现，支持：
 * - 存储桶管理
 * - 文件上传/下载/删除
 * - 文件元数据管理
 * - 目录操作
 * - 批量操作
 * - 版本管理
 * - 分片上传/断点续传
 * - 文件预览/缩略图
 * - 权限管理（ACL/策略/预签名URL）
 * - 标签管理
 * - 生命周期管理
 * - 跨桶复制
 * - 存储统计
 * - 配额管理
 * - 集群管理
 * - 缓存管理
 */
export class MockRustFS extends EnhancedMockRustFS {
  /**
   * 构造函数
   * 
   * @param config 配置
   */
  constructor(config?: RustFSConfig) {
    super(config);
  }

  /**
   * 获取版本信息
   * 
   * @returns 版本信息
   */
  public getVersion(): string {
    return 'RustFS Mock v1.0.0';
  }

  /**
   * 获取支持的功能列表
   * 
   * @returns 功能列表
   */
  public getSupportedFeatures(): string[] {
    return [
      'bucket-management',
      'file-upload',
      'file-download',
      'file-delete',
      'file-metadata',
      'file-operation',
      'directory',
      'bulk-operation',
      'versioning',
      'multipart-upload',
      'file-preview',
      'permission',
      'tagging',
      'lifecycle',
      'replication',
      'storage-stats',
      'quota',
      'cluster',
      'cache',
    ];
  }
}
