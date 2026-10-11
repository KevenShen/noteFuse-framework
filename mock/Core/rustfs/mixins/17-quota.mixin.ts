/**
 * L5 运维管理层 - 配额管理 Mixin
 * 
 * 提供存储配额、对象数量配额、用户配额等功能
 */

import type { Constructor } from './mixin.types';
import type {
  QuotaUsage,
  UserQuota,
} from '../types';

import {
  getCurrentTime,
} from '../utils';

/**
 * 配额管理 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithQuota<T extends Constructor>(Base: T) {
  return class QuotaMixin extends Base {
    // ==================== 桶配额管理 ====================

    /**
     * 设置桶存储配额
     * 
     * @param bucket 桶名
     * @param quota 配额配置
     * @returns 设置结果
     */
    setBucketQuota(
      bucket: string,
      quota: {
        storage_limit?: number; // 字节
        object_count_limit?: number;
        version_count_limit?: number;
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

      // 获取桶信息
      const bucketInfo = (this as any).buckets.get(bucket);
      if (!bucketInfo) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${bucket}` };
      }

      // 设置配额
      bucketInfo.quota = {
        storage_limit: quota.storage_limit,
        object_count_limit: quota.object_count_limit,
        version_count_limit: quota.version_count_limit,
        updated_at: getCurrentTime(),
      };
      bucketInfo.last_modified = getCurrentTime();

      (this as any).debugLog(`Bucket quota set: ${bucket}, storage: ${quota.storage_limit}, objects: ${quota.object_count_limit}`);

      return { success: true };
    }

    /**
     * 获取桶存储配额
     * 
     * @param bucket 桶名
     * @returns 配额配置
     */
    getBucketQuota(
      bucket: string,
    ): {
      success: boolean;
      error?: string;
      quota?: {
        storage_limit?: number;
        object_count_limit?: number;
        version_count_limit?: number;
        updated_at?: string;
      };
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

      return {
        success: true,
        quota: bucketInfo.quota,
      };
    }

    /**
     * 删除桶存储配额
     * 
     * @param bucket 桶名
     * @returns 删除结果
     */
    deleteBucketQuota(
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

      // 删除配额
      delete bucketInfo.quota;
      bucketInfo.last_modified = getCurrentTime();

      (this as any).debugLog(`Bucket quota deleted: ${bucket}`);

      return { success: true };
    }

    // ==================== 配额使用情况 ====================

    /**
     * 获取桶配额使用情况
     * 
     * @param bucket 桶名
     * @returns 配额使用情况
     */
    getBucketQuotaUsage(
      bucket: string,
    ): {
      success: boolean;
      error?: string;
      usage?: any;
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

      // 获取桶内所有对象
      const allObjects = (Array.from((this as any).objects.values()) as any[]).filter(
        (obj: any) => obj.bucket === bucket,
      );

      // 获取最新版本的对象
      const latestObjects = allObjects.filter(
        (obj: any) => obj.is_latest && !obj.is_delete_marker,
      );

      // 计算使用量
      const usedStorage = latestObjects.reduce((sum: number, obj: any) => sum + obj.size, 0);
      const usedObjectCount = latestObjects.length;
      const usedVersionCount = allObjects.length;

      // 获取配额限制
      const quota = bucketInfo.quota || {};
      const storageLimit = quota.storage_limit;
      const objectCountLimit = quota.object_count_limit;
      const versionCountLimit = quota.version_count_limit;

      // 计算使用率
      const storageUsagePercentage = storageLimit ? (usedStorage / storageLimit) * 100 : 0;
      const objectCountUsagePercentage = objectCountLimit ? (usedObjectCount / objectCountLimit) * 100 : 0;
      const versionCountUsagePercentage = versionCountLimit ? (usedVersionCount / versionCountLimit) * 100 : 0;

      // 检查是否超出配额
      const isStorageExceeded = storageLimit ? usedStorage >= storageLimit : false;
      const isObjectCountExceeded = objectCountLimit ? usedObjectCount >= objectCountLimit : false;
      const isVersionCountExceeded = versionCountLimit ? usedVersionCount >= versionCountLimit : false;
      const isExceeded = isStorageExceeded || isObjectCountExceeded || isVersionCountExceeded;

      return {
        success: true,
        usage: {
          bucket,
          used_storage: usedStorage,
          storage_limit: storageLimit,
          storage_usage_percentage: storageUsagePercentage,
          is_storage_exceeded: isStorageExceeded,
          used_object_count: usedObjectCount,
          object_count_limit: objectCountLimit,
          object_count_usage_percentage: objectCountUsagePercentage,
          is_object_count_exceeded: isObjectCountExceeded,
          used_version_count: usedVersionCount,
          version_count_limit: versionCountLimit,
          version_count_usage_percentage: versionCountUsagePercentage,
          is_version_count_exceeded: isVersionCountExceeded,
          is_exceeded: isExceeded,
          calculated_at: getCurrentTime(),
        },
      };
    }

    // ==================== 用户配额管理 ====================

    /**
     * 设置用户配额
     * 
     * @param userId 用户ID
     * @param quota 配额配置
     * @returns 设置结果
     */
    setUserQuota(
      userId: string,
      quota: UserQuota,
    ): {
      success: boolean;
      error?: string;
    } {
      (this as any).recordRequest(true);

      // 初始化用户配额存储
      if (!(this as any).userQuotas) {
        (this as any).userQuotas = new Map();
      }

      // 设置用户配额
      (this as any).userQuotas.set(userId, {
        ...quota,
        user_id: userId,
        updated_at: getCurrentTime(),
      });

      (this as any).debugLog(`User quota set: ${userId}`);

      return { success: true };
    }

    /**
     * 获取用户配额
     * 
     * @param userId 用户ID
     * @returns 用户配额
     */
    getUserQuota(
      userId: string,
    ): {
      success: boolean;
      error?: string;
      quota?: any;
    } {
      (this as any).recordRequest(true);

      // 检查用户配额是否存在
      if (!(this as any).userQuotas || !(this as any).userQuotas.has(userId)) {
        return {
          success: false,
          error: `User quota not found: ${userId}`,
        };
      }

      return {
        success: true,
        quota: (this as any).userQuotas.get(userId),
      };
    }

    /**
     * 获取用户配额使用情况
     * 
     * @param userId 用户ID
     * @returns 用户配额使用情况
     */
    getUserQuotaUsage(
      userId: string,
    ): {
      success: boolean;
      error?: string;
      usage?: {
        user_id: string;
        total_storage: number;
        storage_limit?: number;
        storage_usage_percentage: number;
        total_buckets: number;
        bucket_limit?: number;
        total_objects: number;
        object_limit?: number;
        is_exceeded: boolean;
        calculated_at: string;
      };
    } {
      (this as any).recordRequest(true);

      // 获取用户配额
      const quotaResult = this.getUserQuota(userId);
      const quota = quotaResult.quota;

      // 获取用户拥有的桶（模拟：所有桶）
      const buckets = Array.from((this as any).buckets.values());
      const userBuckets = buckets; // 简化：假设所有桶都属于该用户

      // 计算总存储和对象数
      let totalStorage = 0;
      let totalObjects = 0;

      userBuckets.forEach((bucket: any) => {
        const usageResult = this.getBucketQuotaUsage(bucket.name);
        if (usageResult.success && usageResult.usage) {
          totalStorage += usageResult.usage.used_storage;
          totalObjects += usageResult.usage.used_object_count;
        }
      });

      // 计算使用率
      const storageUsagePercentage = quota?.storage_limit
        ? (totalStorage / quota.storage_limit) * 100
        : 0;

      // 检查是否超出配额
      const isStorageExceeded = quota?.storage_limit
        ? totalStorage >= quota.storage_limit
        : false;
      const isBucketExceeded = quota?.bucket_limit
        ? userBuckets.length >= quota.bucket_limit
        : false;
      const isObjectExceeded = quota?.object_limit
        ? totalObjects >= quota.object_limit
        : false;
      const isExceeded = isStorageExceeded || isBucketExceeded || isObjectExceeded;

      return {
        success: true,
        usage: {
          user_id: userId,
          total_storage: totalStorage,
          storage_limit: quota?.storage_limit,
          storage_usage_percentage: storageUsagePercentage,
          total_buckets: userBuckets.length,
          bucket_limit: quota?.bucket_limit,
          total_objects: totalObjects,
          object_limit: quota?.object_limit,
          is_exceeded: isExceeded,
          calculated_at: getCurrentTime(),
        },
      };
    }

    // ==================== 配额检查 ====================

    /**
     * 检查是否可以上传对象（配额检查）
     * 
     * @param bucket 桶名
     * @param size 对象大小
     * @returns 检查结果
     */
    checkUploadQuota(
      bucket: string,
      size: number,
    ): {
      allowed: boolean;
      reason?: string;
      current_usage?: any;
    } {
      // 获取桶配额使用情况
      const usageResult = this.getBucketQuotaUsage(bucket);

      if (!usageResult.success || !usageResult.usage) {
        return {
          allowed: false,
          reason: usageResult.error || 'Failed to get quota usage',
        };
      }

      const usage = usageResult.usage;

      // 检查存储配额
      if (usage.storage_limit) {
        const projectedStorage = usage.used_storage + size;
        if (projectedStorage > usage.storage_limit) {
          return {
            allowed: false,
            reason: `Storage quota exceeded. Current: ${usage.used_storage}, Projected: ${projectedStorage}, Limit: ${usage.storage_limit}`,
            current_usage: usage,
          };
        }
      }

      // 检查对象数量配额
      if (usage.object_count_limit) {
        const projectedObjectCount = usage.used_object_count + 1;
        if (projectedObjectCount > usage.object_count_limit) {
          return {
            allowed: false,
            reason: `Object count quota exceeded. Current: ${usage.used_object_count}, Projected: ${projectedObjectCount}, Limit: ${usage.object_count_limit}`,
            current_usage: usage,
          };
        }
      }

      return {
        allowed: true,
        current_usage: usage,
      };
    }

    /**
     * 获取所有桶的配额使用情况
     * 
     * @returns 所有桶的配额使用情况
     */
    getAllBucketsQuotaUsage(): {
      success: boolean;
      usages: Array<QuotaUsage>;
    } {
      (this as any).recordRequest(true);

      // 获取所有桶
      const buckets = Array.from((this as any).buckets.values());

      // 获取每个桶的配额使用情况
      const usages: QuotaUsage[] = [];
      buckets.forEach((bucket: any) => {
        const usageResult = this.getBucketQuotaUsage(bucket.name);
        if (usageResult.success && usageResult.usage) {
          usages.push(usageResult.usage);
        }
      });

      return {
        success: true,
        usages,
      };
    }
  };
}
