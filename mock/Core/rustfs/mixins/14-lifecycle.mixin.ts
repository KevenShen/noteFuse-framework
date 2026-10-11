/**
 * L4 扩展功能层 - 生命周期管理 Mixin
 * 
 * 提供生命周期规则配置、执行、对象锁定等功能
 */

import type { Constructor } from './mixin.types';
import type {
  LifecycleConfiguration,
  LifecycleRule,
  LifecycleExecutionResult,
  ObjectLockConfiguration,
} from '../types';

import {
  normalizePath,
  getCurrentTime,
} from '../utils';

/**
 * 生命周期管理 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithLifecycle<T extends Constructor>(Base: T) {
  return class LifecycleMixin extends Base {
    // ==================== 生命周期规则管理 ====================

    /**
     * 设置桶生命周期配置
     * 
     * @param bucket 桶名
     * @param configuration 生命周期配置
     * @returns 设置结果
     */
    putBucketLifecycle(
      bucket: string,
      configuration: LifecycleConfiguration,
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

      // 验证规则数量
      if (configuration.rules.length > 1000) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Too many lifecycle rules: ${configuration.rules.length}. Maximum is 1000.`,
        };
      }

      // 验证规则ID唯一性
      const ruleIds = new Set(configuration.rules.map((rule: any) => rule.id));
      if (ruleIds.size !== configuration.rules.length) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: 'Duplicate lifecycle rule IDs found.',
        };
      }

      // 设置生命周期配置
      bucketInfo.lifecycle_configuration = configuration;
      bucketInfo.last_modified = getCurrentTime();

      (this as any).debugLog(`Bucket lifecycle configuration set: ${bucket}, rules: ${configuration.rules.length}`);

      return { success: true };
    }

    /**
     * 获取桶生命周期配置
     * 
     * @param bucket 桶名
     * @returns 生命周期配置
     */
    getBucketLifecycle(
      bucket: string,
    ): {
      success: boolean;
      error?: string;
      configuration?: LifecycleConfiguration;
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

      if (!bucketInfo.lifecycle_configuration) {
        return {
          success: false,
          error: `No lifecycle configuration found for bucket: ${bucket}`,
        };
      }

      return {
        success: true,
        configuration: bucketInfo.lifecycle_configuration,
      };
    }

    /**
     * 删除桶生命周期配置
     * 
     * @param bucket 桶名
     * @returns 删除结果
     */
    deleteBucketLifecycle(
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

      // 删除生命周期配置
      delete bucketInfo.lifecycle_configuration;
      bucketInfo.last_modified = getCurrentTime();

      (this as any).debugLog(`Bucket lifecycle configuration deleted: ${bucket}`);

      return { success: true };
    }

    // ==================== 生命周期规则执行 ====================

    /**
     * 执行生命周期规则
     * 
     * @param bucket 桶名
     * @param options 执行选项
     * @returns 执行结果
     */
    executeLifecycleRules(
      bucket: string,
      options?: {
        rule_ids?: string[];
        dry_run?: boolean;
      },
    ): any {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Bucket not found: ${bucket}`,
          executed_at: getCurrentTime(),
          rules_executed: 0,
          objects_transitioned: 0,
          objects_expired: 0,
          details: [],
        };
      }

      // 获取桶信息
      const bucketInfo = (this as any).buckets.get(bucket);
      if (!bucketInfo || !bucketInfo.lifecycle_configuration) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `No lifecycle configuration found for bucket: ${bucket}`,
          executed_at: getCurrentTime(),
          rules_executed: 0,
          objects_transitioned: 0,
          objects_expired: 0,
          details: [],
        };
      }

      const configuration = bucketInfo.lifecycle_configuration;
      const now = new Date();
      const details: any[] = [];
      let objectsTransitioned = 0;
      let objectsExpired = 0;

      // 筛选要执行的规则
      let rulesToExecute = configuration.rules.filter((rule: any) => rule.status === 'Enabled');
      if (options?.rule_ids) {
        rulesToExecute = rulesToExecute.filter((rule: any) => options.rule_ids!.includes(rule.id));
      }

      // 获取所有对象
      const objects = (Array.from((this as any).objects.values()) as any[]).filter(
        (obj: any) => obj.bucket === bucket && obj.is_latest && !obj.is_delete_marker,
      );

      // 执行每个规则
      rulesToExecute.forEach((rule: any) => {
        const ruleDetail = {
          rule_id: rule.id,
          objects_matched: 0,
          objects_transitioned: 0,
          objects_expired: 0,
          actions: [] as string[],
        };

        // 筛选匹配的对象
        const matchedObjects = objects.filter((obj: any) => {
          // 前缀匹配
          if (rule.filter?.prefix && !obj.key.startsWith(rule.filter.prefix)) {
            return false;
          }
          // 标签匹配
          if (rule.filter?.tags) {
            const objectTags = obj.tags || {};
            const allTagsMatch = Object.entries(rule.filter.tags).every(
              ([tagKey, tagValue]) => objectTags[tagKey] === tagValue
            );
            if (!allTagsMatch) {
              return false;
            }
          }
          return true;
        });

        ruleDetail.objects_matched = matchedObjects.length;

        // 执行过期操作
        if (rule.expiration) {
          matchedObjects.forEach((obj: any) => {
            const lastModified = new Date(obj.last_modified);
            const ageInDays = (now.getTime() - lastModified.getTime()) / (1000 * 60 * 60 * 24);

            if (rule.expiration.days && ageInDays >= rule.expiration.days) {
              if (!options?.dry_run) {
                // 执行过期删除
                (this as any).deleteObject(bucket, obj.key);
              }
              ruleDetail.objects_expired++;
              objectsExpired++;
              ruleDetail.actions.push(`expired: ${obj.key}`);
            }
          });
        }

        // 执行转换操作
        if (rule.transitions && rule.transitions.length > 0) {
          matchedObjects.forEach((obj: any) => {
            const lastModified = new Date(obj.last_modified);
            const ageInDays = (now.getTime() - lastModified.getTime()) / (1000 * 60 * 60 * 24);

            rule.transitions.forEach((transition: any) => {
              if (transition.days && ageInDays >= transition.days && obj.storage_class !== transition.storage_class) {
                if (!options?.dry_run) {
                  // 执行存储类转换
                  obj.storage_class = transition.storage_class;
                  obj.last_modified = getCurrentTime();
                }
                ruleDetail.objects_transitioned++;
                objectsTransitioned++;
                ruleDetail.actions.push(`transitioned: ${obj.key} -> ${transition.storage_class}`);
              }
            });
          });
        }

        details.push(ruleDetail);
      });

      (this as any).debugLog(`Lifecycle rules executed: ${bucket}, rules: ${rulesToExecute.length}, dry_run: ${options?.dry_run ?? false}`);

      return {
        success: true,
        executed_at: getCurrentTime(),
        rules_executed: rulesToExecute.length,
        objects_transitioned: objectsTransitioned,
        objects_expired: objectsExpired,
        details,
        dry_run: options?.dry_run ?? false,
      };
    }

    // ==================== 对象锁定 ====================

    /**
     * 设置对象锁定配置
     * 
     * @param bucket 桶名
     * @param configuration 对象锁定配置
     * @returns 设置结果
     */
    putObjectLockConfiguration(
      bucket: string,
      configuration: ObjectLockConfiguration,
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

      // 设置对象锁定配置
      bucketInfo.object_lock_configuration = configuration;
      bucketInfo.object_lock_enabled = configuration.object_lock_enabled === 'Enabled';
      bucketInfo.last_modified = getCurrentTime();

      (this as any).debugLog(`Object lock configuration set: ${bucket}`);

      return { success: true };
    }

    /**
     * 获取对象锁定配置
     * 
     * @param bucket 桶名
     * @returns 对象锁定配置
     */
    getObjectLockConfiguration(
      bucket: string,
    ): {
      success: boolean;
      error?: string;
      configuration?: ObjectLockConfiguration;
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

      if (!bucketInfo.object_lock_configuration) {
        return {
          success: false,
          error: `No object lock configuration found for bucket: ${bucket}`,
        };
      }

      return {
        success: true,
        configuration: bucketInfo.object_lock_configuration,
      };
    }

    /**
     * 为对象添加保留期
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param retention 保留配置
     * @param options 选项
     * @returns 设置结果
     */
    putObjectRetention(
      bucket: string,
      key: string,
      retention: {
        mode: 'GOVERNANCE' | 'COMPLIANCE';
        retain_until_date: string;
      },
      options?: {
        version_id?: string;
        bypass_governance_retention?: boolean;
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

      // 检查是否已有COMPLIANCE保留期（COMPLIANCE模式不能被覆盖或删除）
      if (fileObject.retention?.mode === 'COMPLIANCE' && !options?.bypass_governance_retention) {
        const retainUntilDate = new Date(fileObject.retention.retain_until_date);
        if (retainUntilDate > new Date()) {
          (this as any).recordRequest(false);
          return {
            success: false,
            error: `Object is under COMPLIANCE retention until ${fileObject.retention.retain_until_date}`,
          };
        }
      }

      // 设置保留期
      fileObject.retention = { ...retention };
      fileObject.last_modified = getCurrentTime();

      (this as any).debugLog(`Object retention set: ${bucket}/${normalizedKey}, mode: ${retention.mode}, until: ${retention.retain_until_date}`);

      return { success: true };
    }

    /**
     * 获取对象保留期
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param options 选项
     * @returns 保留配置
     */
    getObjectRetention(
      bucket: string,
      key: string,
      options?: {
        version_id?: string;
      },
    ): {
      success: boolean;
      error?: string;
      retention?: {
        mode: string;
        retain_until_date: string;
      };
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

      return {
        success: true,
        retention: fileObject.retention,
      };
    }
  };
}
