/**
 * L4 扩展功能层 - 标签管理 Mixin
 * 
 * 提供对象标签、桶标签的设置、获取、删除等功能
 */

import type { Constructor } from './mixin.types';

import {
  normalizePath,
  getCurrentTime,
} from '../utils';

/**
 * 标签管理 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithTagging<T extends Constructor>(Base: T) {
  return class TaggingMixin extends Base {
    // ==================== 对象标签管理 ====================

    /**
     * 设置对象标签
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param tags 标签集合
     * @param options 选项
     * @returns 设置结果
     */
    putObjectTagging(
      bucket: string,
      key: string,
      tags: Record<string, string>,
      options?: {
        version_id?: string;
      },
    ): {
      success: boolean;
      error?: string;
    } {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${bucket}` };
      }

      const normalizedKey = normalizePath(key);

      // 获取对象版本
      const allVersions = (Array.from((this as any).objects.values()) as any[]).filter(
        (obj: any) => obj.bucket === bucket && obj.key === normalizedKey,
      );

      let fileObject: any;
      if (options?.version_id) {
        fileObject = allVersions.find((obj: any) => obj.version_id === options.version_id);
      } else {
        fileObject = allVersions.find((obj: any) => obj.is_latest) || allVersions[0];
      }

      if (!fileObject || fileObject.is_delete_marker) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Object not found: ${bucket}/${normalizedKey}`,
        };
      }

      // 验证标签数量和大小
      const tagCount = Object.keys(tags).length;
      if (tagCount > 10) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Too many tags: ${tagCount}. Maximum is 10 tags per object.`,
        };
      }

      // 验证标签键和值长度
      for (const [tagKey, tagValue] of Object.entries(tags)) {
        if (tagKey.length > 128) {
          (this as any).recordRequest(false);
          return {
            success: false,
            error: `Tag key too long: ${tagKey}. Maximum is 128 characters.`,
          };
        }
        if (tagValue.length > 256) {
          (this as any).recordRequest(false);
          return {
            success: false,
            error: `Tag value too long for key ${tagKey}. Maximum is 256 characters.`,
          };
        }
      }

      // 设置标签
      fileObject.tags = { ...tags };
      fileObject.last_modified = getCurrentTime();

      (this as any).debugLog(`Object tagging set: ${bucket}/${normalizedKey}, tags: ${JSON.stringify(tags)}`);

      return { success: true };
    }

    /**
     * 获取对象标签
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param options 选项
     * @returns 标签集合
     */
    getObjectTagging(
      bucket: string,
      key: string,
      options?: {
        version_id?: string;
      },
    ): {
      success: boolean;
      error?: string;
      tags?: Record<string, string>;
      tag_set?: Array<{ key: string; value: string }>;
    } {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${bucket}` };
      }

      const normalizedKey = normalizePath(key);

      // 获取对象版本
      const allVersions = (Array.from((this as any).objects.values()) as any[]).filter(
        (obj: any) => obj.bucket === bucket && obj.key === normalizedKey,
      );

      let fileObject: any;
      if (options?.version_id) {
        fileObject = allVersions.find((obj: any) => obj.version_id === options.version_id);
      } else {
        fileObject = allVersions.find((obj: any) => obj.is_latest) || allVersions[0];
      }

      if (!fileObject || fileObject.is_delete_marker) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Object not found: ${bucket}/${normalizedKey}`,
        };
      }

      const tags = fileObject.tags || {};
      const tagSet = Object.entries(tags).map(([tagKey, tagValue]) => ({
        key: tagKey,
        value: tagValue as string,
      }));

      return {
        success: true,
        tags,
        tag_set: tagSet,
      };
    }

    /**
     * 删除对象标签
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param options 选项
     * @returns 删除结果
     */
    deleteObjectTagging(
      bucket: string,
      key: string,
      options?: {
        version_id?: string;
      },
    ): {
      success: boolean;
      error?: string;
    } {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${bucket}` };
      }

      const normalizedKey = normalizePath(key);

      // 获取对象版本
      const allVersions = (Array.from((this as any).objects.values()) as any[]).filter(
        (obj: any) => obj.bucket === bucket && obj.key === normalizedKey,
      );

      let fileObject: any;
      if (options?.version_id) {
        fileObject = allVersions.find((obj: any) => obj.version_id === options.version_id);
      } else {
        fileObject = allVersions.find((obj: any) => obj.is_latest) || allVersions[0];
      }

      if (!fileObject || fileObject.is_delete_marker) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Object not found: ${bucket}/${normalizedKey}`,
        };
      }

      // 删除标签
      fileObject.tags = {};
      fileObject.last_modified = getCurrentTime();

      (this as any).debugLog(`Object tagging deleted: ${bucket}/${normalizedKey}`);

      return { success: true };
    }

    // ==================== 桶标签管理 ====================

    /**
     * 设置桶标签
     * 
     * @param bucket 桶名
     * @param tags 标签集合
     * @returns 设置结果
     */
    putBucketTagging(
      bucket: string,
      tags: Record<string, string>,
    ): {
      success: boolean;
      error?: string;
    } {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${bucket}` };
      }

      // 获取桶信息
      const bucketInfo = (this as any).buckets.get(bucket);
      if (!bucketInfo) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${bucket}` };
      }

      // 验证标签数量
      const tagCount = Object.keys(tags).length;
      if (tagCount > 50) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Too many tags: ${tagCount}. Maximum is 50 tags per bucket.`,
        };
      }

      // 设置标签
      bucketInfo.tags = { ...tags };
      bucketInfo.last_modified = getCurrentTime();

      (this as any).debugLog(`Bucket tagging set: ${bucket}, tags: ${JSON.stringify(tags)}`);

      return { success: true };
    }

    /**
     * 获取桶标签
     * 
     * @param bucket 桶名
     * @returns 标签集合
     */
    getBucketTagging(
      bucket: string,
    ): {
      success: boolean;
      error?: string;
      tags?: Record<string, string>;
      tag_set?: Array<{ key: string; value: string }>;
    } {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${bucket}` };
      }

      // 获取桶信息
      const bucketInfo = (this as any).buckets.get(bucket);
      if (!bucketInfo) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${bucket}` };
      }

      const tags = bucketInfo.tags || {};
      const tagSet = Object.entries(tags).map(([tagKey, tagValue]) => ({
        key: tagKey,
        value: tagValue as string,
      }));

      return {
        success: true,
        tags,
        tag_set: tagSet,
      };
    }

    /**
     * 删除桶标签
     * 
     * @param bucket 桶名
     * @returns 删除结果
     */
    deleteBucketTagging(
      bucket: string,
    ): {
      success: boolean;
      error?: string;
    } {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${bucket}` };
      }

      // 获取桶信息
      const bucketInfo = (this as any).buckets.get(bucket);
      if (!bucketInfo) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${bucket}` };
      }

      // 删除标签
      bucketInfo.tags = {};
      bucketInfo.last_modified = getCurrentTime();

      (this as any).debugLog(`Bucket tagging deleted: ${bucket}`);

      return { success: true };
    }

    // ==================== 标签筛选 ====================

    /**
     * 根据标签筛选对象
     * 
     * @param bucket 桶名
     * @param tagFilters 标签筛选条件
     * @returns 匹配的对象列表
     */
    listObjectsByTags(
      bucket: string,
      tagFilters: Array<{ key: string; value?: string; operator?: 'AND' | 'OR' }>,
    ): {
      success: boolean;
      error?: string;
      objects?: Array<{
        key: string;
        size: number;
        last_modified: string;
        tags: Record<string, string>;
      }>;
    } {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${bucket}` };
      }

      // 获取所有最新版本的对象
      const objects = (Array.from((this as any).objects.values()) as any[]).filter(
        (obj: any) => obj.bucket === bucket && obj.is_latest && !obj.is_delete_marker,
      );

      // 根据标签筛选
      const filteredObjects = objects.filter((obj: any) => {
        const objectTags = obj.tags || {};

        return tagFilters.every((filter) => {
          if (!(filter.key in objectTags)) {
            return false;
          }
          if (filter.value !== undefined && objectTags[filter.key] !== filter.value) {
            return false;
          }
          return true;
        });
      });

      return {
        success: true,
        objects: filteredObjects.map((obj: any) => ({
          key: obj.key,
          size: obj.size,
          last_modified: obj.last_modified,
          tags: obj.tags || {},
        })),
      };
    }

    /**
     * 复制对象标签
     * 
     * @param sourceBucket 源桶
     * @param sourceKey 源键
     * @param destBucket 目标桶
     * @param destKey 目标键
     * @returns 复制结果
     */
    copyObjectTags(
      sourceBucket: string,
      sourceKey: string,
      destBucket: string,
      destKey: string,
    ): {
      success: boolean;
      error?: string;
    } {
      // 获取源对象标签
      const sourceTagging = this.getObjectTagging(sourceBucket, sourceKey);
      if (!sourceTagging.success || !sourceTagging.tags) {
        return {
          success: false,
          error: sourceTagging.error || 'Failed to get source object tags',
        };
      }

      // 设置目标对象标签
      return this.putObjectTagging(destBucket, destKey, sourceTagging.tags);
    }
  };
}
