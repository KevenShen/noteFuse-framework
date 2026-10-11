/**
 * L3 高级功能层 - 版本管理 Mixin
 * 
 * 提供对象版本管理、版本列表、版本恢复、版本删除等功能
 */

import type { Constructor } from './mixin.types';
import type {
  FileObject,
} from '../types';

import {
  getCurrentTime,
  normalizePath,
} from '../utils';

/**
 * 版本管理 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithVersioning<T extends Constructor>(Base: T) {
  return class VersioningMixin extends Base {
    // ==================== 版本列表 ====================

    /**
     * 列出对象的所有版本
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param options 列出选项
     * @returns 版本列表结果
     */
    listObjectVersions(
      bucket: string,
      key: string,
      options?: {
        max_versions?: number;
        version_id_marker?: string;
      },
    ): any {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return {
          versions: [],
          delete_markers: [],
          name: bucket,
          prefix: key,
          max_keys: options?.max_versions ?? 1000,
          is_truncated: false,
        };
      }

      const normalizedKey = normalizePath(key);

      // 获取所有版本
      let versions = (Array.from((this as any).objects.values()) as any[]).filter(
        (obj: any) => obj.bucket === bucket && obj.key === normalizedKey,
      );

      // 按最后修改时间降序排序
      versions.sort((a: any, b: any) =>
        new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime()
      );

      // 版本标记筛选（分页）
      if (options?.version_id_marker) {
        const markerIndex = versions.findIndex(
          (obj: any) => obj.version_id === options.version_id_marker,
        );
        if (markerIndex !== -1) {
          versions = versions.slice(markerIndex + 1);
        }
      }

      // 限制数量
      const maxVersions = options?.max_versions ?? 1000;
      const isTruncated = versions.length > maxVersions;
      const nextVersionIdMarker = isTruncated ? versions[maxVersions - 1]?.version_id : undefined;
      versions = versions.slice(0, maxVersions);

      // 分离版本和删除标记
      const objectVersions = versions.filter((obj: any) => !obj.is_delete_marker);
      const deleteMarkers = versions.filter((obj: any) => obj.is_delete_marker);

      return {
        versions: objectVersions,
        delete_markers: deleteMarkers,
        name: bucket,
        prefix: normalizedKey,
        max_keys: maxVersions,
        is_truncated: isTruncated,
        next_version_id_marker: nextVersionIdMarker,
        version_id_marker: options?.version_id_marker,
      };
    }

    // ==================== 版本信息 ====================

    /**
     * 获取对象版本信息
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param versionId 版本ID（可选，默认获取最新版本）
     * @returns 版本信息
     */
    getObjectVersion(
      bucket: string,
      key: string,
      versionId?: string,
    ): {
      success: boolean;
      error?: string;
      version?: any;
    } {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${bucket}` };
      }

      const normalizedKey = normalizePath(key);

      // 获取所有版本
      const allVersions = (Array.from((this as any).objects.values()) as any[]).filter(
        (obj: any) => obj.bucket === bucket && obj.key === normalizedKey,
      );

      let fileObject: any;
      if (versionId) {
        fileObject = allVersions.find((obj: any) => obj.version_id === versionId);
      } else {
        fileObject = allVersions.find((obj: any) => obj.is_latest) || allVersions[0];
      }

      if (!fileObject) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Version not found: ${bucket}/${normalizedKey}${versionId ? `?versionId=${versionId}` : ''}`,
        };
      }

      return {
        success: true,
        version: {
          bucket: fileObject.bucket,
          key: fileObject.key,
          version_id: fileObject.version_id,
          is_latest: fileObject.is_latest,
          is_delete_marker: fileObject.is_delete_marker,
          size: fileObject.size,
          content_type: fileObject.content_type,
          etag: fileObject.etag,
          last_modified: fileObject.last_modified,
          storage_class: fileObject.storage_class,
          acl: fileObject.acl,
        },
      };
    }

    // ==================== 版本恢复 ====================

    /**
     * 恢复对象到指定版本
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param versionId 要恢复的版本ID
     * @returns 恢复结果
     */
    restoreObjectVersion(
      bucket: string,
      key: string,
      versionId: string,
    ): {
      success: boolean;
      error?: string;
      restored_version_id?: string;
      last_modified?: string;
    } {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${bucket}` };
      }

      const normalizedKey = normalizePath(key);

      // 获取所有版本
      const allVersions = (Array.from((this as any).objects.values()) as any[]).filter(
        (obj: any) => obj.bucket === bucket && obj.key === normalizedKey,
      );

      // 找到要恢复的版本
      const versionToRestore = allVersions.find((obj: any) => obj.version_id === versionId);

      if (!versionToRestore || versionToRestore.is_delete_marker) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Version not found or is delete marker: ${versionId}`,
        };
      }

      // 创建新版本（复制要恢复的版本内容）
      const now = getCurrentTime();
      const newVersionId = `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newObjectKey = (this as any).generateObjectKey(bucket, normalizedKey, newVersionId);

      // 将所有旧版本标记为非最新
      allVersions.forEach((obj: any) => {
        obj.is_latest = false;
      });

      // 创建新版本
      const newObject: FileObject = {
        ...versionToRestore,
        version_id: newVersionId,
        is_latest: true,
        last_modified: now,
        metadata: {
          ...versionToRestore.metadata,
          'x-amz-meta-restored-from': versionId,
        },
      };

      (this as any).objects.set(newObjectKey, newObject);

      // 清除相关缓存
      const cacheKeysToDelete: string[] = [];
      for (const cacheKey of (this as any).queryCache.keys()) {
        if (cacheKey.includes(`bucket:${bucket}`) && cacheKey.includes(`key:${normalizedKey}`)) {
          cacheKeysToDelete.push(cacheKey);
        }
      }
      cacheKeysToDelete.forEach(cacheKey => (this as any).queryCache.delete(cacheKey));

      (this as any).debugLog(`Object version restored: ${bucket}/${normalizedKey}, from ${versionId} to ${newVersionId}`);

      return {
        success: true,
        restored_version_id: newVersionId,
        last_modified: now,
      };
    }

    // ==================== 版本删除 ====================

    /**
     * 删除对象的指定版本
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param versionId 版本ID
     * @returns 删除结果
     */
    deleteObjectVersion(
      bucket: string,
      key: string,
      versionId: string,
    ): {
      success: boolean;
      error?: string;
      deleted_version_id?: string;
    } {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${bucket}` };
      }

      const normalizedKey = normalizePath(key);

      // 找到要删除的版本
      const objectKey = (this as any).generateObjectKey(bucket, normalizedKey, versionId);
      const versionToDelete = (this as any).objects.get(objectKey);

      if (!versionToDelete) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Version not found: ${versionId}`,
        };
      }

      // 如果删除的是最新版本，需要将上一个版本标记为最新
      if (versionToDelete.is_latest) {
        const allVersions = (Array.from((this as any).objects.values()) as any[]).filter(
          (obj: any) => obj.bucket === bucket && obj.key === normalizedKey && obj.version_id !== versionId,
        );

        // 按最后修改时间降序排序
        allVersions.sort((a: any, b: any) =>
          new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime()
        );

        // 将上一个版本标记为最新
        if (allVersions.length > 0) {
          allVersions[0].is_latest = true;
        }
      }

      // 删除版本
      const deletedSize = versionToDelete.is_delete_marker ? 0 : versionToDelete.size;
      (this as any).objects.delete(objectKey);

      // 更新桶统计
      if (!versionToDelete.is_delete_marker) {
        (this as any).updateBucketStats(bucket, -deletedSize, -1);
      }

      (this as any).debugLog(`Object version deleted: ${bucket}/${normalizedKey}, version: ${versionId}`);

      return {
        success: true,
        deleted_version_id: versionId,
      };
    }

    // ==================== 版本统计 ====================

    /**
     * 获取对象版本统计信息
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @returns 版本统计信息
     */
    getObjectVersionStats(
      bucket: string,
      key: string,
    ): {
      success: boolean;
      error?: string;
      stats?: {
        total_versions: number;
        current_version_id?: string;
        latest_version_id?: string;
        oldest_version_id?: string;
        total_size: number;
        delete_marker_count: number;
        version_count: number;
      };
    } {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${bucket}` };
      }

      const normalizedKey = normalizePath(key);

      // 获取所有版本
      const allVersions = (Array.from((this as any).objects.values()) as any[]).filter(
        (obj: any) => obj.bucket === bucket && obj.key === normalizedKey,
      );

      if (allVersions.length === 0) {
        return {
          success: true,
          stats: {
            total_versions: 0,
            total_size: 0,
            delete_marker_count: 0,
            version_count: 0,
          },
        };
      }

      // 按最后修改时间排序
      allVersions.sort((a: any, b: any) =>
        new Date(a.last_modified).getTime() - new Date(b.last_modified).getTime()
      );

      const latestVersion = allVersions[allVersions.length - 1];
      const oldestVersion = allVersions[0];
      const currentVersion = allVersions.find((obj: any) => obj.is_latest);
      const deleteMarkers = allVersions.filter((obj: any) => obj.is_delete_marker);
      const objectVersions = allVersions.filter((obj: any) => !obj.is_delete_marker);
      const totalSize = objectVersions.reduce((sum: number, obj: any) => sum + obj.size, 0);

      return {
        success: true,
        stats: {
          total_versions: allVersions.length,
          current_version_id: currentVersion?.version_id,
          latest_version_id: latestVersion.version_id,
          oldest_version_id: oldestVersion.version_id,
          total_size: totalSize,
          delete_marker_count: deleteMarkers.length,
          version_count: objectVersions.length,
        },
      };
    }
  };
}
