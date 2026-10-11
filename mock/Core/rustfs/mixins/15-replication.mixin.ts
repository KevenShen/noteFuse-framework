/**
 * L4 扩展功能层 - 跨桶复制 Mixin
 * 
 * 提供跨桶复制配置、执行、状态监控等功能
 */

import type { Constructor } from './mixin.types';
import type {
  ReplicationConfiguration,
  ReplicationRule,
  ReplicationProgress,
  ReplicationMetrics,
} from '../types';

import {
  normalizePath,
  getCurrentTime,
} from '../utils';

/**
 * 跨桶复制 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithReplication<T extends Constructor>(Base: T) {
  return class ReplicationMixin extends Base {
    // ==================== 复制配置管理 ====================

    /**
     * 设置桶复制配置
     * 
     * @param bucket 源桶名
     * @param configuration 复制配置
     * @returns 设置结果
     */
    putBucketReplication(
      bucket: string,
      configuration: ReplicationConfiguration,
    ): {
      success: boolean;
      error?: string;
    } {
      (this as any).recordRequest(true);

      // 检查源桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return { success: false, error: `Source bucket not found: ${bucket}` };
      }

      // 检查目标桶是否存在
      for (const rule of configuration.rules) {
        if (!(this as any).bucketExists(rule.destination.bucket)) {
          (this as any).recordRequest(false);
          return {
            success: false,
            error: `Destination bucket not found: ${rule.destination.bucket}`,
          };
        }
      }

      // 验证规则数量
      if (configuration.rules.length > 1000) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Too many replication rules: ${configuration.rules.length}. Maximum is 1000.`,
        };
      }

      // 获取源桶信息
      const bucketInfo = (this as any).buckets.get(bucket);
      if (!bucketInfo) {
        (this as any).recordRequest(false);
        return { success: false, error: `Source bucket not found: ${bucket}` };
      }

      // 设置复制配置
      bucketInfo.replication_configuration = configuration;
      bucketInfo.replication_role = configuration.role;
      bucketInfo.last_modified = getCurrentTime();

      // 初始化复制进度
      if (!bucketInfo.replication_progress) {
        bucketInfo.replication_progress = {};
      }

      (this as any).debugLog(`Bucket replication configuration set: ${bucket}, rules: ${configuration.rules.length}`);

      return { success: true };
    }

    /**
     * 获取桶复制配置
     * 
     * @param bucket 源桶名
     * @returns 复制配置
     */
    getBucketReplication(
      bucket: string,
    ): {
      success: boolean;
      error?: string;
      configuration?: ReplicationConfiguration;
    } {
      (this as any).recordRequest(true);

      // 检查源桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return { success: false, error: `Source bucket not found: ${bucket}` };
      }

      // 获取源桶信息
      const bucketInfo = (this as any).buckets.get(bucket);
      if (!bucketInfo) {
        (this as any).recordRequest(false);
        return { success: false, error: `Source bucket not found: ${bucket}` };
      }

      if (!bucketInfo.replication_configuration) {
        return {
          success: false,
          error: `No replication configuration found for bucket: ${bucket}`,
        };
      }

      return {
        success: true,
        configuration: bucketInfo.replication_configuration,
      };
    }

    /**
     * 删除桶复制配置
     * 
     * @param bucket 源桶名
     * @returns 删除结果
     */
    deleteBucketReplication(
      bucket: string,
    ): {
      success: boolean;
      error?: string;
    } {
      (this as any).recordRequest(true);

      // 检查源桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return { success: false, error: `Source bucket not found: ${bucket}` };
      }

      // 获取源桶信息
      const bucketInfo = (this as any).buckets.get(bucket);
      if (!bucketInfo) {
        (this as any).recordRequest(false);
        return { success: false, error: `Source bucket not found: ${bucket}` };
      }

      // 删除复制配置
      delete bucketInfo.replication_configuration;
      delete bucketInfo.replication_role;
      bucketInfo.last_modified = getCurrentTime();

      (this as any).debugLog(`Bucket replication configuration deleted: ${bucket}`);

      return { success: true };
    }

    // ==================== 复制执行 ====================

    /**
     * 执行复制规则
     * 
     * @param sourceBucket 源桶名
     * @param options 执行选项
     * @returns 执行结果
     */
    executeReplication(
      sourceBucket: string,
      options?: {
        rule_ids?: string[];
        prefix?: string;
        max_objects?: number;
        dry_run?: boolean;
      },
    ): {
      success: boolean;
      error?: string;
      executed_at: string;
      rules_executed: number;
      objects_replicated: number;
      objects_failed: number;
      details: Array<{
        rule_id: string;
        destination_bucket: string;
        objects_matched: number;
        objects_replicated: number;
        objects_failed: number;
      }>;
    } {
      (this as any).recordRequest(true);

      // 检查源桶是否存在
      if (!(this as any).bucketExists(sourceBucket)) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Source bucket not found: ${sourceBucket}`,
          executed_at: getCurrentTime(),
          rules_executed: 0,
          objects_replicated: 0,
          objects_failed: 0,
          details: [],
        };
      }

      // 获取源桶信息
      const bucketInfo = (this as any).buckets.get(sourceBucket);
      if (!bucketInfo || !bucketInfo.replication_configuration) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `No replication configuration found for bucket: ${sourceBucket}`,
          executed_at: getCurrentTime(),
          rules_executed: 0,
          objects_replicated: 0,
          objects_failed: 0,
          details: [],
        };
      }

      const configuration = bucketInfo.replication_configuration;
      const details: any[] = [];
      let totalObjectsReplicated = 0;
      let totalObjectsFailed = 0;

      // 筛选要执行的规则
      let rulesToExecute = configuration.rules.filter((rule: any) => rule.status === 'Enabled');
      if (options?.rule_ids) {
        rulesToExecute = rulesToExecute.filter((rule: any) => options.rule_ids!.includes(rule.id));
      }

      // 获取所有对象
      let objects = (Array.from((this as any).objects.values()) as any[]).filter(
        (obj: any) => obj.bucket === sourceBucket && obj.is_latest && !obj.is_delete_marker,
      );

      // 前缀筛选
      if (options?.prefix) {
        objects = objects.filter((obj: any) => obj.key.startsWith(options.prefix));
      }

      // 限制数量
      const maxObjects = options?.max_objects ?? 1000;
      objects = objects.slice(0, maxObjects);

      // 执行每个规则
      rulesToExecute.forEach((rule: any) => {
        const ruleDetail = {
          rule_id: rule.id,
          destination_bucket: rule.destination.bucket,
          objects_matched: 0,
          objects_replicated: 0,
          objects_failed: 0,
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

        // 执行复制
        matchedObjects.forEach((obj: any) => {
          try {
            if (!options?.dry_run) {
              // 执行复制
              const result = (this as any).copyObject(
                sourceBucket,
                obj.key,
                rule.destination.bucket,
                obj.key,
                {
                  storage_class: rule.destination.storage_class,
                  metadata_directive: 'COPY',
                },
              );

              if (!result.success) {
                throw new Error(result.error || 'Copy failed');
              }

              // 更新复制进度
              if (!bucketInfo.replication_progress) {
                bucketInfo.replication_progress = {};
              }
              bucketInfo.replication_progress[obj.key] = {
                rule_id: rule.id,
                destination_bucket: rule.destination.bucket,
                status: 'COMPLETED',
                last_replicated_at: getCurrentTime(),
                replication_timestamp: getCurrentTime(),
              };
            }
            ruleDetail.objects_replicated++;
            totalObjectsReplicated++;
          } catch (error: any) {
            ruleDetail.objects_failed++;
            totalObjectsFailed++;

            // 更新复制进度为失败
            if (!bucketInfo.replication_progress) {
              bucketInfo.replication_progress = {};
            }
            bucketInfo.replication_progress[obj.key] = {
              rule_id: rule.id,
              destination_bucket: rule.destination.bucket,
              status: 'FAILED',
              last_replicated_at: getCurrentTime(),
              error_message: error.message,
            };
          }
        });

        details.push(ruleDetail);
      });

      (this as any).debugLog(`Replication executed: ${sourceBucket}, rules: ${rulesToExecute.length}, replicated: ${totalObjectsReplicated}, failed: ${totalObjectsFailed}`);

      return {
        success: true,
        executed_at: getCurrentTime(),
        rules_executed: rulesToExecute.length,
        objects_replicated: totalObjectsReplicated,
        objects_failed: totalObjectsFailed,
        details,
      };
    }

    // ==================== 复制进度查询 ====================

    /**
     * 获取对象复制进度
     * 
     * @param bucket 源桶名
     * @param key 对象键
     * @returns 复制进度
     */
    getObjectReplicationProgress(
      bucket: string,
      key: string,
    ): {
      success: boolean;
      error?: string;
      progress?: ReplicationProgress;
    } {
      (this as any).recordRequest(true);

      // 检查源桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return { success: false, error: `Source bucket not found: ${bucket}` };
      }

      // 获取源桶信息
      const bucketInfo = (this as any).buckets.get(bucket);
      if (!bucketInfo) {
        (this as any).recordRequest(false);
        return { success: false, error: `Source bucket not found: ${bucket}` };
      }

      const normalizedKey = normalizePath(key);
      const progress = bucketInfo.replication_progress?.[normalizedKey];

      if (!progress) {
        return {
          success: false,
          error: `No replication progress found for object: ${bucket}/${normalizedKey}`,
        };
      }

      return {
        success: true,
        progress,
      };
    }

    /**
     * 获取桶复制指标
     * 
     * @param bucket 源桶名
     * @returns 复制指标
     */
    getBucketReplicationMetrics(
      bucket: string,
    ): {
      success: boolean;
      error?: string;
      metrics?: any;
    } {
      (this as any).recordRequest(true);

      // 检查源桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return { success: false, error: `Source bucket not found: ${bucket}` };
      }

      // 获取源桶信息
      const bucketInfo = (this as any).buckets.get(bucket);
      if (!bucketInfo) {
        (this as any).recordRequest(false);
        return { success: false, error: `Source bucket not found: ${bucket}` };
      }

      const progress = bucketInfo.replication_progress || {};
      const progressEntries = Object.values(progress);

      const metrics: any = {
        total_objects: progressEntries.length,
        replicated_objects: progressEntries.filter((p: any) => p.status === 'COMPLETED').length,
        failed_objects: progressEntries.filter((p: any) => p.status === 'FAILED').length,
        pending_objects: progressEntries.filter((p: any) => p.status === 'PENDING').length,
        replication_ratio: progressEntries.length > 0
          ? progressEntries.filter((p: any) => p.status === 'COMPLETED').length / progressEntries.length
          : 0,
        last_replication_time: progressEntries.length > 0
          ? (progressEntries as any[]).reduce((latest: string, p: any) =>
              !latest || (p.last_replicated_at && p.last_replicated_at > latest)
                ? p.last_replicated_at
                : latest,
              ''
            )
          : undefined,
      };

      return {
        success: true,
        metrics,
      };
    }

    // ==================== 复制时间点查询 ====================

    /**
     * 获取对象复制时间点
     * 
     * @param bucket 源桶名
     * @param key 对象键
     * @returns 复制时间点
     */
    getObjectReplicationTime(
      bucket: string,
      key: string,
    ): {
      success: boolean;
      error?: string;
      replication_time?: string;
      destination_bucket?: string;
    } {
      const progressResult = this.getObjectReplicationProgress(bucket, key);

      if (!progressResult.success || !progressResult.progress) {
        return {
          success: false,
          error: progressResult.error || 'Replication progress not found',
        };
      }

      return {
        success: true,
        replication_time: (progressResult.progress as any).replication_timestamp,
        destination_bucket: progressResult.progress.destination_bucket,
      };
    }
  };
}
