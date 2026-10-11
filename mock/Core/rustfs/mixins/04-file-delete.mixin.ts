/**
 * L1 基础层 - 文件删除 Mixin
 * 
 * 提供文件删除、批量删除、版本删除、恢复等功能
 */

import type { Constructor } from './mixin.types';
import type {
  FileObject,
} from '../types';

import {
  generateUUID,
  getCurrentTime,
  normalizePath,
} from '../utils';

/**
 * 文件删除 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithFileDelete<T extends Constructor>(Base: T) {
  return class FileDeleteMixin extends Base {
    // ==================== 文件删除 ====================

    /**
     * 删除对象
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @returns 删除结果
     */
    deleteObject(
      bucket: string,
      key: string,
    ): {
      success: boolean;
      deleteMarker?: boolean;
      versionId?: string;
      error?: string;
    } {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Bucket not found: ${bucket}`,
        };
      }

      const normalizedKey = normalizePath(key);
      const bucketInfo = (this as any).getBucket(bucket);

      // 获取所有版本
      const allVersions = (Array.from((this as any).objects.values()) as any[]).filter(
        (obj: any) => obj.bucket === bucket && obj.key === normalizedKey,
      );

      if (allVersions.length === 0) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Object not found: ${bucket}/${normalizedKey}`,
        };
      }

      // 记录删除统计
      (this as any).recordDelete();

      if (bucketInfo?.versioning) {
        // 启用版本控制：创建删除标记
        const deleteMarkerVersionId = generateUUID();
        const deleteMarker: FileObject = {
          key: normalizedKey,
          bucket,
          version_id: deleteMarkerVersionId,
          size: 0,
          content_type: 'application/x-directory',
          etag: generateUUID(),
          last_modified: getCurrentTime(),
          storage_class: bucketInfo.storage_class,
          acl: bucketInfo.acl,
          tags: {},
          metadata: {},
          is_delete_marker: true,
          is_latest: true,
          owner: bucketInfo.owner,
        };

        // 将旧版本标记为非最新
        allVersions.forEach((obj: any) => {
          obj.is_latest = false;
        });

        // 存储删除标记
        const objectKey = (this as any).generateObjectKey(bucket, normalizedKey, deleteMarkerVersionId);
        (this as any).objects.set(objectKey, deleteMarker);

        // 清除相关缓存
        this.clearObjectCache(bucket, normalizedKey);

        (this as any).debugLog(`Delete marker created: ${bucket}/${normalizedKey}`, {
          versionId: deleteMarkerVersionId,
        });

        return {
          success: true,
          deleteMarker: true,
          versionId: deleteMarkerVersionId,
        };
      } else {
        // 未启用版本控制：永久删除
        const objectKey = (this as any).generateObjectKey(bucket, normalizedKey);
        const deletedObject = (this as any).objects.get(objectKey);

        if (deletedObject) {
          // 更新桶统计
          (this as any).updateBucketStats(bucket, -deletedObject.size, -1);
          (this as any).objects.delete(objectKey);
        }

        // 清除相关缓存
        this.clearObjectCache(bucket, normalizedKey);

        (this as any).debugLog(`Object permanently deleted: ${bucket}/${normalizedKey}`);

        return {
          success: true,
          deleteMarker: false,
        };
      }
    }

    /**
     * 批量删除对象
     * 
     * @param bucket 桶名
     * @param keys 对象键列表
     * @returns 批量删除结果
     */
    deleteObjects(
      bucket: string,
      keys: string[],
    ): {
      success: boolean;
      deleted: Array<{ key: string; versionId?: string; deleteMarker?: boolean }>;
      errors: Array<{ key: string; error: string }>;
    } {
      const deleted: Array<{ key: string; versionId?: string; deleteMarker?: boolean }> = [];
      const errors: Array<{ key: string; error: string }> = [];

      for (const key of keys) {
        const result = this.deleteObject(bucket, key);
        if (result.success) {
          deleted.push({
            key,
            versionId: result.versionId,
            deleteMarker: result.deleteMarker,
          });
        } else {
          errors.push({
            key,
            error: result.error || 'Unknown error',
          });
        }
      }

      return {
        success: errors.length === 0,
        deleted,
        errors,
      };
    }

    /**
     * 移除对象（别名）
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @returns 删除结果
     */
    removeObject(
      bucket: string,
      key: string,
    ): {
      success: boolean;
      error?: string;
    } {
      const result = this.deleteObject(bucket, key);
      return {
        success: result.success,
        error: result.error,
      };
    }

    // ==================== 版本删除 ====================

    /**
     * 删除特定版本的对象
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
    } {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${bucket}` };
      }

      const normalizedKey = normalizePath(key);
      const objectKey = (this as any).generateObjectKey(bucket, normalizedKey, versionId);
      const fileObject = (this as any).objects.get(objectKey);

      if (!fileObject) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Object version not found: ${bucket}/${normalizedKey}?versionId=${versionId}`,
        };
      }

      // 如果删除的是最新版本，需要将上一个版本标记为最新
      if (fileObject.is_latest) {
        const allVersions = Array.from((this as any).objects.values())
          .filter((obj: any) => obj.bucket === bucket && obj.key === normalizedKey && obj.version_id !== versionId)
          .sort((a: any, b: any) => new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime());

        if (allVersions.length > 0) {
          (allVersions[0] as any).is_latest = true;
        }
      }

      // 更新桶统计（如果不是删除标记）
      if (!fileObject.is_delete_marker) {
        (this as any).updateBucketStats(bucket, -fileObject.size, -1);
      }

      // 删除对象
      (this as any).objects.delete(objectKey);
      (this as any).recordDelete();

      // 清除相关缓存
      this.clearObjectCache(bucket, normalizedKey);

      (this as any).debugLog(`Object version deleted: ${bucket}/${normalizedKey}?versionId=${versionId}`);

      return { success: true };
    }

    /**
     * 永久删除对象（包括所有版本）
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @returns 删除结果
     */
    purgeObject(
      bucket: string,
      key: string,
    ): {
      success: boolean;
      deletedVersions: number;
      error?: string;
    } {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return { success: false, deletedVersions: 0, error: `Bucket not found: ${bucket}` };
      }

      const normalizedKey = normalizePath(key);

      // 获取所有版本
      const allVersions = (Array.from((this as any).objects.values()) as any[]).filter(
        (obj: any) => obj.bucket === bucket && obj.key === normalizedKey,
      );

      if (allVersions.length === 0) {
        (this as any).recordRequest(false);
        return {
          success: false,
          deletedVersions: 0,
          error: `Object not found: ${bucket}/${normalizedKey}`,
        };
      }

      // 计算总大小（非删除标记）
      const totalSize = allVersions
        .filter((obj: any) => !obj.is_delete_marker)
        .reduce((sum: number, obj: any) => sum + obj.size, 0);
      const objectCount = allVersions.filter((obj: any) => !obj.is_delete_marker).length;

      // 删除所有版本
      for (const obj of allVersions) {
        const objectKey = (this as any).generateObjectKey(bucket, normalizedKey, obj.version_id);
        (this as any).objects.delete(objectKey);
      }

      // 更新桶统计
      (this as any).updateBucketStats(bucket, -totalSize, -objectCount);
      (this as any).recordDelete();

      // 清除相关缓存
      this.clearObjectCache(bucket, normalizedKey);

      (this as any).debugLog(`Object purged: ${bucket}/${normalizedKey}`, {
        deletedVersions: allVersions.length,
      });

      return {
        success: true,
        deletedVersions: allVersions.length,
      };
    }

    // ==================== 对象恢复 ====================

    /**
     * 恢复已删除的对象
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param versionId 版本ID（可选，不指定则恢复最新版本）
     * @returns 恢复结果
     */
    restoreObject(
      bucket: string,
      key: string,
      versionId?: string,
    ): {
      success: boolean;
      object?: FileObject;
      error?: string;
    } {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${bucket}` };
      }

      const normalizedKey = normalizePath(key);

      // 获取所有版本（包括删除标记）
      const allVersions = Array.from((this as any).objects.values())
        .filter((obj: any) => obj.bucket === bucket && obj.key === normalizedKey)
        .sort((a: any, b: any) => new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime());

      if (allVersions.length === 0) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Object not found: ${bucket}/${normalizedKey}`,
        };
      }

      // 检查最新版本是否为删除标记
      const latestVersion = allVersions[0] as any;
      if (!latestVersion.is_delete_marker) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Object is not deleted: ${bucket}/${normalizedKey}`,
        };
      }

      // 删除删除标记
      const deleteMarkerKey = (this as any).generateObjectKey(bucket, normalizedKey, latestVersion.version_id);
      (this as any).objects.delete(deleteMarkerKey);

      // 找到要恢复的版本
      let versionToRestore: FileObject | null = null;
      if (versionId) {
        versionToRestore = (allVersions.find((obj: any) => obj.version_id === versionId && !obj.is_delete_marker) as any) || null;
      } else {
        // 恢复最新的非删除标记版本
        versionToRestore = (allVersions.find((obj: any) => !obj.is_delete_marker) as any) || null;
      }

      if (!versionToRestore) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `No restorable version found: ${bucket}/${normalizedKey}`,
        };
      }

      // 标记为最新版本
      versionToRestore.is_latest = true;

      // 更新桶统计
      (this as any).updateBucketStats(bucket, versionToRestore.size, 1);

      // 清除相关缓存
      this.clearObjectCache(bucket, normalizedKey);

      (this as any).debugLog(`Object restored: ${bucket}/${normalizedKey}`, {
        versionId: versionToRestore.version_id,
      });

      return {
        success: true,
        object: versionToRestore,
      };
    }

    // ==================== 内部工具方法 ====================

    /**
     * 清除对象相关的缓存
     * 
     * @param bucket 桶名
     * @param key 对象键
     */
    private clearObjectCache(bucket: string, key: string): void {
      const cacheKeysToDelete: string[] = [];
      for (const cacheKey of (this as any).queryCache.keys()) {
        if (cacheKey.includes(`bucket:${bucket}`) && cacheKey.includes(`key:${key}`)) {
          cacheKeysToDelete.push(cacheKey);
        }
      }
      cacheKeysToDelete.forEach(cacheKey => (this as any).queryCache.delete(cacheKey));
    }
  };
}
