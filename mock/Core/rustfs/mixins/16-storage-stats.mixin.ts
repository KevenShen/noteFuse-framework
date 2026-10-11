/**
 * L5 运维管理层 - 存储统计 Mixin
 * 
 * 提供存储统计、使用量分析、对象分布等功能
 */

import type { Constructor } from './mixin.types';
import type {
  TotalStats,
  BucketStats,
  FileSizeDistribution,
} from '../types';

import {
  getCurrentTime,
} from '../utils';

/**
 * 存储统计 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithStorageStats<T extends Constructor>(Base: T) {
  return class StorageStatsMixin extends Base {
    // ==================== 全局存储统计 ====================

    /**
     * 获取全局存储统计
     * 
     * @returns 全局存储统计
     */
    getTotalStats(): any {
      (this as any).recordRequest(true);

      // 获取所有桶
      const buckets = Array.from((this as any).buckets.values());

      // 获取所有对象
      const allObjects = (Array.from((this as any).objects.values()) as any[]).filter(
        (obj: any) => obj.is_latest && !obj.is_delete_marker,
      );

      // 计算总大小
      const totalSize = allObjects.reduce((sum: number, obj: any) => sum + obj.size, 0);

      // 计算总对象数
      const totalObjects = allObjects.length;

      // 计算总删除标记数
      const totalDeleteMarkers = (Array.from((this as any).objects.values()) as any[]).filter(
        (obj: any) => obj.is_delete_marker,
      ).length;

      // 计算总版本数
      const totalVersions = (Array.from((this as any).objects.values()) as any[]).length;

      // 计算平均对象大小
      const averageObjectSize = totalObjects > 0 ? totalSize / totalObjects : 0;

      // 计算最大对象大小
      const maxObjectSize = allObjects.length > 0
        ? Math.max(...allObjects.map((obj: any) => obj.size))
        : 0;

      // 计算最小对象大小
      const minObjectSize = allObjects.length > 0
        ? Math.min(...allObjects.map((obj: any) => obj.size))
        : 0;

      return {
        total_buckets: buckets.length,
        total_objects: totalObjects,
        total_versions: totalVersions,
        total_delete_markers: totalDeleteMarkers,
        total_size: totalSize,
        total_size_human: this.formatSize(totalSize),
        average_object_size: averageObjectSize,
        max_object_size: maxObjectSize,
        min_object_size: minObjectSize,
        calculated_at: getCurrentTime(),
      };
    }

    // ==================== 桶存储统计 ====================

    /**
     * 获取桶存储统计
     * 
     * @param bucket 桶名
     * @returns 桶存储统计
     */
    getBucketStats(bucket: string): {
      success: boolean;
      error?: string;
      stats?: any;
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

      // 计算总大小
      const totalSize = latestObjects.reduce((sum: number, obj: any) => sum + obj.size, 0);

      // 计算对象数
      const objectCount = latestObjects.length;

      // 计算版本数
      const versionCount = allObjects.length;

      // 计算删除标记数
      const deleteMarkerCount = allObjects.filter((obj: any) => obj.is_delete_marker).length;

      // 计算平均对象大小
      const averageObjectSize = objectCount > 0 ? totalSize / objectCount : 0;

      // 计算最大对象大小
      const maxObjectSize = latestObjects.length > 0
        ? Math.max(...latestObjects.map((obj: any) => obj.size))
        : 0;

      // 计算最小对象大小
      const minObjectSize = latestObjects.length > 0
        ? Math.min(...latestObjects.map((obj: any) => obj.size))
        : 0;

      // 按存储类统计
      const storageClassStats: Record<string, { count: number; size: number }> = {};
      latestObjects.forEach((obj: any) => {
        const storageClass = obj.storage_class || 'STANDARD';
        if (!storageClassStats[storageClass]) {
          storageClassStats[storageClass] = { count: 0, size: 0 };
        }
        storageClassStats[storageClass].count++;
        storageClassStats[storageClass].size += obj.size;
      });

      // 按内容类型统计
      const contentTypeStats: Record<string, number> = {};
      latestObjects.forEach((obj: any) => {
        const contentType = obj.content_type || 'application/octet-stream';
        contentTypeStats[contentType] = (contentTypeStats[contentType] || 0) + 1;
      });

      return {
        success: true,
        stats: {
          bucket,
          object_count: objectCount,
          version_count: versionCount,
          delete_marker_count: deleteMarkerCount,
          total_size: totalSize,
          total_size_human: this.formatSize(totalSize),
          average_object_size: averageObjectSize,
          max_object_size: maxObjectSize,
          min_object_size: minObjectSize,
          storage_class_stats: storageClassStats,
          content_type_stats: contentTypeStats,
          created_at: bucketInfo.created_at,
          last_modified: bucketInfo.last_modified,
          calculated_at: getCurrentTime(),
        },
      };
    }

    // ==================== 文件大小分布 ====================

    /**
     * 获取文件大小分布
     * 
     * @param bucket 桶名（可选，不传则统计所有桶）
     * @returns 文件大小分布
     */
    getFileSizeDistribution(bucket?: string): any {
      (this as any).recordRequest(true);

      // 获取对象
      let objects = (Array.from((this as any).objects.values()) as any[]).filter(
        (obj: any) => obj.is_latest && !obj.is_delete_marker,
      );

      // 按桶筛选
      if (bucket) {
        objects = objects.filter((obj: any) => obj.bucket === bucket);
      }

      // 定义大小区间
      const ranges = [
        { label: '< 1KB', min: 0, max: 1024, count: 0, size: 0 },
        { label: '1KB - 10KB', min: 1024, max: 10240, count: 0, size: 0 },
        { label: '10KB - 100KB', min: 10240, max: 102400, count: 0, size: 0 },
        { label: '100KB - 1MB', min: 102400, max: 1048576, count: 0, size: 0 },
        { label: '1MB - 10MB', min: 1048576, max: 10485760, count: 0, size: 0 },
        { label: '10MB - 100MB', min: 10485760, max: 104857600, count: 0, size: 0 },
        { label: '100MB - 1GB', min: 104857600, max: 1073741824, count: 0, size: 0 },
        { label: '> 1GB', min: 1073741824, max: Infinity, count: 0, size: 0 },
      ];

      // 统计每个区间
      objects.forEach((obj: any) => {
        const range = ranges.find((r) => obj.size >= r.min && obj.size < r.max);
        if (range) {
          range.count++;
          range.size += obj.size;
        }
      });

      // 计算总数和总大小
      const totalCount = objects.length;
      const totalSize = objects.reduce((sum: number, obj: any) => sum + obj.size, 0);

      return {
        ranges: ranges.map((r) => ({
          label: r.label,
          count: r.count,
          size: r.size,
          percentage: totalCount > 0 ? (r.count / totalCount) * 100 : 0,
        })),
        total_count: totalCount,
        total_size: totalSize,
        calculated_at: getCurrentTime(),
      };
    }

    // ==================== 存储类统计 ====================

    /**
     * 获取存储类统计
     * 
     * @param bucket 桶名（可选，不传则统计所有桶）
     * @returns 存储类统计
     */
    getStorageClassStats(bucket?: string): any {
      (this as any).recordRequest(true);

      // 获取对象
      let objects = (Array.from((this as any).objects.values()) as any[]).filter(
        (obj: any) => obj.is_latest && !obj.is_delete_marker,
      );

      // 按桶筛选
      if (bucket) {
        objects = objects.filter((obj: any) => obj.bucket === bucket);
      }

      // 按存储类统计
      const storageClasses: Record<string, { count: number; size: number; percentage: number }> = {};
      const totalCount = objects.length;
      const totalSize = objects.reduce((sum: number, obj: any) => sum + obj.size, 0);

      objects.forEach((obj: any) => {
        const storageClass = obj.storage_class || 'STANDARD';
        if (!storageClasses[storageClass]) {
          storageClasses[storageClass] = { count: 0, size: 0, percentage: 0 };
        }
        storageClasses[storageClass].count++;
        storageClasses[storageClass].size += obj.size;
      });

      // 计算百分比
      Object.keys(storageClasses).forEach((key) => {
        storageClasses[key].percentage = totalCount > 0
          ? (storageClasses[key].count / totalCount) * 100
          : 0;
      });

      return {
        storage_classes: storageClasses,
        total_count: totalCount,
        total_size: totalSize,
        calculated_at: getCurrentTime(),
      };
    }

    // ==================== 工具方法 ====================

    /**
     * 格式化文件大小
     * 
     * @param bytes 字节数
     * @returns 格式化后的大小字符串
     */
    private formatSize(bytes: number): string {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 获取存储使用趋势（模拟）
     * 
     * @param bucket 桶名
     * @param days 天数
     * @returns 存储使用趋势
     */
    getStorageUsageTrend(
      bucket: string,
      days: number = 7,
    ): {
      success: boolean;
      error?: string;
      trend?: Array<{
        date: string;
        object_count: number;
        total_size: number;
      }>;
    } {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${bucket}` };
      }

      // 获取当前统计
      const currentStats = this.getBucketStats(bucket);
      if (!currentStats.success || !currentStats.stats) {
        return {
          success: false,
          error: currentStats.error || 'Failed to get bucket stats',
        };
      }

      // 生成模拟的历史趋势数据
      const trend: Array<{
        date: string;
        object_count: number;
        total_size: number;
      }> = [];

      const now = new Date();
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        // 模拟历史数据（在当前数据基础上随机波动）
        const factor = 0.8 + Math.random() * 0.4; // 80% - 120%
        trend.push({
          date: dateStr,
          object_count: Math.floor(currentStats.stats.object_count * factor),
          total_size: Math.floor(currentStats.stats.total_size * factor),
        });
      }

      // 最后一天使用当前数据
      trend[trend.length - 1] = {
        date: now.toISOString().split('T')[0],
        object_count: currentStats.stats.object_count,
        total_size: currentStats.stats.total_size,
      };

      return {
        success: true,
        trend,
      };
    }
  };
}
