/**
 * L1 基础层 - 存储桶管理 Mixin
 * 
 * 提供存储桶的创建、删除、列表、存在性检查、配置管理等功能
 */

import type { Constructor } from './mixin.types';
import type {
  Bucket,
  CreateBucketOptions,
  ListBucketsResult,
  StorageClass,
  ACLType,
  BucketQuota,
  CORSConfiguration,
} from '../types';

import {
  generateUUID,
  getCurrentTime,
  isValidBucketName,
  normalizePath,
} from '../utils';

/**
 * 存储桶管理 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithBucketManagement<T extends Constructor>(Base: T) {
  return class BucketManagementMixin extends Base {
    // ==================== 存储桶创建 ====================

    /**
     * 创建存储桶
     * 
     * @param name 桶名
     * @param options 创建选项
     * @returns 创建结果
     */
    createBucket(name: string, options: CreateBucketOptions = {}): {
      success: boolean;
      bucket?: Bucket;
      error?: string;
    } {
      (this as any).recordRequest(true);

      // 验证桶名
      if (!isValidBucketName(name)) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Invalid bucket name: ${name}. Bucket name must be 3-63 characters, lowercase letters, numbers, dots, and hyphens.`,
        };
      }

      // 检查桶是否已存在
      if ((this as any).buckets.has(name)) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Bucket already exists: ${name}`,
        };
      }

      // 检查桶数量限制
      const config = (this as any).config;
      if ((this as any).buckets.size >= config.max_buckets) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Too many buckets. Maximum is ${config.max_buckets}.`,
        };
      }

      // 创建桶
      const bucket: Bucket = {
        name,
        creation_date: getCurrentTime(),
        region: options.region || config.default_region,
        storage_class: options.storage_class || config.default_storage_class,
        acl: options.acl || config.default_acl,
        versioning: options.versioning || config.default_versioning || false,
        object_lock: options.object_lock || false,
        tags: options.tags || {},
        metadata: options.metadata || {},
        settings: {
          versioning: options.versioning || config.default_versioning || false,
          object_lock: options.object_lock || false,
          cors: options.cors,
        },
        lifecycle_rules: [],
        replication_rules: [],
        quota: options.quota,
        object_count: 0,
        total_size: 0,
        owner: {
          id: generateUUID(),
          display_name: 'mock-owner',
        },
      };

      (this as any).buckets.set(name, bucket);
      (this as any).debugLog(`Bucket created: ${name}`, bucket);

      return {
        success: true,
        bucket,
      };
    }

    // ==================== 存储桶删除 ====================

    /**
     * 删除存储桶
     * 
     * @param name 桶名
     * @returns 删除结果
     */
    deleteBucket(name: string): {
      success: boolean;
      error?: string;
    } {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      const bucket = (this as any).buckets.get(name);
      if (!bucket) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Bucket not found: ${name}`,
        };
      }

      // 检查桶是否为空（只有空桶可以删除）
      const objectsInBucket = (Array.from((this as any).objects.values()) as any[]).filter(
        (obj: any) => obj.bucket === name && !obj.is_delete_marker,
      );
      if (objectsInBucket.length > 0) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Bucket not empty: ${name}. Contains ${objectsInBucket.length} objects.`,
        };
      }

      // 删除桶
      (this as any).buckets.delete(name);

      // 清除该桶的缓存
      const cacheKeysToDelete: string[] = [];
      for (const key of (this as any).queryCache.keys()) {
        if (key.includes(`bucket:${name}`)) {
          cacheKeysToDelete.push(key);
        }
      }
      cacheKeysToDelete.forEach(key => (this as any).queryCache.delete(key));

      (this as any).debugLog(`Bucket deleted: ${name}`);

      return {
        success: true,
      };
    }

    // ==================== 存储桶列表 ====================

    /**
     * 列出存储桶
     * 
     * @param prefix 前缀筛选（可选）
     * @param marker 标记（可选，用于分页）
     * @param maxKeys 最大数量（可选，默认1000）
     * @returns 桶列表结果
     */
    listBuckets(
      prefix?: string,
      marker?: string,
      maxKeys: number = 1000,
    ): ListBucketsResult {
      (this as any).recordRequest(true);

      let buckets = Array.from((this as any).buckets.values()) as Bucket[];

      // 前缀筛选
      if (prefix) {
        buckets = buckets.filter(bucket => bucket.name.startsWith(prefix));
      }

      // 标记筛选（分页）
      if (marker) {
        const markerIndex = buckets.findIndex(bucket => bucket.name === marker);
        if (markerIndex !== -1) {
          buckets = buckets.slice(markerIndex + 1);
        }
      }

      // 按名称排序
      buckets.sort((a, b) => a.name.localeCompare(b.name));

      // 限制数量
      buckets = buckets.slice(0, maxKeys);

      return {
        buckets,
        owner: {
          id: generateUUID(),
          display_name: 'mock-owner',
        },
      };
    }

    // ==================== 存储桶存在性检查 ====================

    /**
     * 检查存储桶是否存在
     * 
     * @param name 桶名
     * @returns 是否存在
     */
    bucketExists(name: string): boolean {
      return (this as any).buckets.has(name);
    }

    // ==================== 存储桶信息获取 ====================

    /**
     * 获取存储桶信息
     * 
     * @param name 桶名
     * @returns 桶信息
     */
    getBucket(name: string): Bucket | null {
      (this as any).recordRequest(true);
      const bucket = (this as any).buckets.get(name);
      if (!bucket) {
        (this as any).recordRequest(false);
        return null;
      }
      return bucket;
    }

    /**
     * 获取存储桶区域
     * 
     * @param name 桶名
     * @returns 区域
     */
    getBucketLocation(name: string): string | null {
      const bucket = this.getBucket(name);
      return bucket ? bucket.region : null;
    }

    // ==================== 存储桶配置管理 ====================

    /**
     * 设置存储桶ACL
     * 
     * @param name 桶名
     * @param acl ACL权限
     * @returns 设置结果
     */
    setBucketACL(name: string, acl: ACLType): {
      success: boolean;
      error?: string;
    } {
      (this as any).recordRequest(true);
      const bucket = (this as any).buckets.get(name);
      if (!bucket) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${name}` };
      }
      bucket.acl = acl;
      bucket.settings.versioning = bucket.versioning;
      (this as any).debugLog(`Bucket ACL set: ${name} -> ${acl}`);
      return { success: true };
    }

    /**
     * 获取存储桶ACL
     * 
     * @param name 桶名
     * @returns ACL权限
     */
    getBucketACL(name: string): ACLType | null {
      const bucket = this.getBucket(name);
      return bucket ? bucket.acl : null;
    }

    /**
     * 设置存储桶标签
     * 
     * @param name 桶名
     * @param tags 标签
     * @returns 设置结果
     */
    setBucketTags(name: string, tags: Record<string, string>): {
      success: boolean;
      error?: string;
    } {
      (this as any).recordRequest(true);
      const bucket = (this as any).buckets.get(name);
      if (!bucket) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${name}` };
      }
      bucket.tags = { ...tags };
      (this as any).debugLog(`Bucket tags set: ${name}`, tags);
      return { success: true };
    }

    /**
     * 获取存储桶标签
     * 
     * @param name 桶名
     * @returns 标签
     */
    getBucketTags(name: string): Record<string, string> | null {
      const bucket = this.getBucket(name);
      return bucket ? bucket.tags : null;
    }

    /**
     * 删除存储桶标签
     * 
     * @param name 桶名
     * @returns 删除结果
     */
    deleteBucketTags(name: string): {
      success: boolean;
      error?: string;
    } {
      (this as any).recordRequest(true);
      const bucket = (this as any).buckets.get(name);
      if (!bucket) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${name}` };
      }
      bucket.tags = {};
      (this as any).debugLog(`Bucket tags deleted: ${name}`);
      return { success: true };
    }

    /**
     * 设置存储桶CORS配置
     * 
     * @param name 桶名
     * @param cors CORS配置
     * @returns 设置结果
     */
    setBucketCORS(name: string, cors: CORSConfiguration): {
      success: boolean;
      error?: string;
    } {
      (this as any).recordRequest(true);
      const bucket = (this as any).buckets.get(name);
      if (!bucket) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${name}` };
      }
      bucket.settings.cors = cors;
      (this as any).debugLog(`Bucket CORS set: ${name}`);
      return { success: true };
    }

    /**
     * 获取存储桶CORS配置
     * 
     * @param name 桶名
     * @returns CORS配置
     */
    getBucketCORS(name: string): CORSConfiguration | null {
      const bucket = this.getBucket(name);
      return bucket?.settings.cors || null;
    }

    /**
     * 设置存储桶配额
     * 
     * @param name 桶名
     * @param quota 配额
     * @returns 设置结果
     */
    setBucketQuota(name: string, quota: BucketQuota): {
      success: boolean;
      error?: string;
    } {
      (this as any).recordRequest(true);
      const bucket = (this as any).buckets.get(name);
      if (!bucket) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${name}` };
      }
      bucket.quota = quota;
      (this as any).debugLog(`Bucket quota set: ${name}`, quota);
      return { success: true };
    }

    /**
     * 获取存储桶配额
     * 
     * @param name 桶名
     * @returns 配额
     */
    getBucketQuota(name: string): BucketQuota | null {
      const bucket = this.getBucket(name);
      return bucket?.quota || null;
    }

    /**
     * 删除存储桶配额
     * 
     * @param name 桶名
     * @returns 删除结果
     */
    deleteBucketQuota(name: string): {
      success: boolean;
      error?: string;
    } {
      (this as any).recordRequest(true);
      const bucket = (this as any).buckets.get(name);
      if (!bucket) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${name}` };
      }
      bucket.quota = undefined;
      (this as any).debugLog(`Bucket quota deleted: ${name}`);
      return { success: true };
    }

    // ==================== 存储桶版本控制 ====================

    /**
     * 启用存储桶版本控制
     * 
     * @param name 桶名
     * @returns 启用结果
     */
    enableBucketVersioning(name: string): {
      success: boolean;
      error?: string;
    } {
      (this as any).recordRequest(true);
      const bucket = (this as any).buckets.get(name);
      if (!bucket) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${name}` };
      }
      bucket.versioning = true;
      bucket.settings.versioning = true;
      (this as any).debugLog(`Bucket versioning enabled: ${name}`);
      return { success: true };
    }

    /**
     * 暂停存储桶版本控制
     * 
     * @param name 桶名
     * @returns 暂停结果
     */
    suspendBucketVersioning(name: string): {
      success: boolean;
      error?: string;
    } {
      (this as any).recordRequest(true);
      const bucket = (this as any).buckets.get(name);
      if (!bucket) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${name}` };
      }
      bucket.versioning = false;
      bucket.settings.versioning = false;
      (this as any).debugLog(`Bucket versioning suspended: ${name}`);
      return { success: true };
    }

    /**
     * 获取存储桶版本控制状态
     * 
     * @param name 桶名
     * @returns 是否启用版本控制
     */
    getBucketVersioningStatus(name: string): boolean | null {
      const bucket = this.getBucket(name);
      return bucket ? bucket.versioning : null;
    }

    // ==================== 存储桶统计更新 ====================

    /**
     * 更新存储桶统计（内部方法）
     * 
     * @param name 桶名
     * @param sizeChange 大小变化（正为增加，负为减少）
     * @param countChange 数量变化
     */
    protected updateBucketStats(name: string, sizeChange: number, countChange: number): void {
      const bucket = (this as any).buckets.get(name);
      if (bucket) {
        bucket.total_size = Math.max(0, bucket.total_size + sizeChange);
        bucket.object_count = Math.max(0, bucket.object_count + countChange);
      }
    }
  };
}
