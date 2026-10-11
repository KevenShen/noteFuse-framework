/**
 * L2 操作层 - 批量操作 Mixin
 * 
 * 提供批量上传、批量下载、批量删除、批量复制等操作
 */

import type { Constructor } from './mixin.types';
import type {
  FileObject,
  BulkUploadResult,
  BulkDownloadResult,
  BulkDeleteResult,
  BulkCopyResult,
} from '../types';

import {
  getCurrentTime,
  normalizePath,
  calculateETag,
  getMimeType,
} from '../utils';

/**
 * 批量操作 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithBulkOperation<T extends Constructor>(Base: T) {
  return class BulkOperationMixin extends Base {
    // ==================== 批量上传 ====================

    /**
     * 批量上传对象
     * 
     * @param bucket 桶名
     * @param files 文件列表
     * @param options 上传选项
     * @returns 批量上传结果
     */
    bulkUpload(
      bucket: string,
      files: Array<{
        key: string;
        data: string | Buffer;
        content_type?: string;
        metadata?: Record<string, string>;
        tags?: Record<string, string>;
        storage_class?: string;
        acl?: string;
      }>,
      options?: {
        concurrency?: number;
        storage_class?: string;
        acl?: string;
        on_progress?: (uploaded: number, total: number, current_file?: string) => void;
      },
    ): BulkUploadResult {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Bucket not found: ${bucket}`,
          uploaded: [],
          failed: [],
          total: files.length,
          success_count: 0,
          failed_count: 0,
        };
      }

      const uploaded: Array<{
        key: string;
        etag: string;
        size: number;
        last_modified: string;
      }> = [];
      const failed: Array<{
        key: string;
        error: string;
      }> = [];

      const now = getCurrentTime();

      files.forEach((file, index) => {
        try {
          const normalizedKey = normalizePath(file.key);

          // 计算文件大小和ETag
          const size = typeof file.data === 'string'
            ? (Buffer as any).byteLength(file.data, 'utf8')
            : file.data.length;
          const etag = calculateETag(file.data);

          // 创建版本ID
          const versionId = `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${index}`;
          const objectKey = (this as any).generateObjectKey(bucket, normalizedKey, versionId);

          // 将旧版本标记为非最新
          const oldVersions = (Array.from((this as any).objects.values()) as any[]).filter(
            (obj: any) => obj.bucket === bucket && obj.key === normalizedKey && obj.is_latest,
          );
          oldVersions.forEach((obj: any) => {
            obj.is_latest = false;
          });

          // 创建新对象
          const fileObject: FileObject = {
            bucket,
            key: normalizedKey,
            version_id: versionId,
            is_latest: true,
            is_delete_marker: false,
            data: file.data,
            size,
            content_type: file.content_type || getMimeType(normalizedKey),
            etag,
            last_modified: now,
            storage_class: (file.storage_class || options?.storage_class || 'STANDARD') as any,
            acl: (file.acl || options?.acl || 'private') as any,
            metadata: file.metadata || {},
            tags: file.tags || {},
          };

          (this as any).objects.set(objectKey, fileObject);

          // 更新桶统计
          (this as any).updateBucketStats(bucket, size, 1);

          uploaded.push({
            key: normalizedKey,
            etag,
            size,
            last_modified: now,
          });

          // 调用进度回调
          if (options?.on_progress) {
            options.on_progress(uploaded.length + failed.length, files.length, normalizedKey);
          }
        } catch (error: any) {
          failed.push({
            key: file.key,
            error: error.message || 'Unknown error',
          });
        }
      });

      (this as any).debugLog(`Bulk upload completed: ${uploaded.length} success, ${failed.length} failed`);

      return {
        success: failed.length === 0,
        uploaded,
        failed,
        total: files.length,
        success_count: uploaded.length,
        failed_count: failed.length,
      };
    }

    // ==================== 批量下载 ====================

    /**
     * 批量下载对象
     * 
     * @param bucket 桶名
     * @param keys 对象键列表
     * @param options 下载选项
     * @returns 批量下载结果
     */
    bulkDownload(
      bucket: string,
      keys: string[],
      options?: {
        version_ids?: Record<string, string>;
        on_progress?: (downloaded: number, total: number, current_key?: string) => void;
      },
    ): BulkDownloadResult {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Bucket not found: ${bucket}`,
          downloaded: [],
          failed: [],
          total: keys.length,
          success_count: 0,
          failed_count: 0,
          total_size: 0,
        };
      }

      const downloaded: Array<{
        key: string;
        data: string | Buffer;
        size: number;
        content_type: string;
        etag: string;
        last_modified: string;
      }> = [];
      const failed: Array<{
        key: string;
        error: string;
      }> = [];

      keys.forEach((key, index) => {
        try {
          const normalizedKey = normalizePath(key);

          // 获取对象
          const allVersions = (Array.from((this as any).objects.values()) as any[]).filter(
            (obj: any) => obj.bucket === bucket && obj.key === normalizedKey,
          );

          let fileObject: any;
          const versionId = options?.version_ids?.[key];
          if (versionId) {
            fileObject = allVersions.find((obj: any) => obj.version_id === versionId);
          } else {
            fileObject = allVersions.find((obj: any) => obj.is_latest) || allVersions[0];
          }

          if (!fileObject || fileObject.is_delete_marker) {
            throw new Error(`Object not found: ${normalizedKey}`);
          }

          downloaded.push({
            key: normalizedKey,
            data: fileObject.data,
            size: fileObject.size,
            content_type: fileObject.content_type,
            etag: fileObject.etag,
            last_modified: fileObject.last_modified,
          });

          // 调用进度回调
          if (options?.on_progress) {
            options.on_progress(downloaded.length + failed.length, keys.length, normalizedKey);
          }
        } catch (error: any) {
          failed.push({
            key,
            error: error.message || 'Unknown error',
          });
        }
      });

      (this as any).debugLog(`Bulk download completed: ${downloaded.length} success, ${failed.length} failed`);

      return {
        success: failed.length === 0,
        downloaded,
        failed,
        total: keys.length,
        success_count: downloaded.length,
        failed_count: failed.length,
        total_size: downloaded.reduce((sum, item) => sum + item.size, 0),
      };
    }

    // ==================== 批量删除 ====================

    /**
     * 批量删除对象
     * 
     * @param bucket 桶名
     * @param keys 对象键列表
     * @param options 删除选项
     * @returns 批量删除结果
     */
    bulkDelete(
      bucket: string,
      keys: string[],
      options?: {
        version_ids?: Record<string, string>;
        permanent?: boolean;
      },
    ): BulkDeleteResult {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Bucket not found: ${bucket}`,
          deleted: [],
          failed: [],
          total: keys.length,
          success_count: 0,
          failed_count: 0,
          deleted_size: 0,
        };
      }

      const deleted: string[] = [];
      const failed: Array<{
        key: string;
        error: string;
      }> = [];

      let totalSizeDeleted = 0;

      keys.forEach((key) => {
        try {
          const normalizedKey = normalizePath(key);

          // 获取所有版本
          const allVersions = (Array.from((this as any).objects.values()) as any[]).filter(
            (obj: any) => obj.bucket === bucket && obj.key === normalizedKey,
          );

          if (allVersions.length === 0) {
            throw new Error(`Object not found: ${normalizedKey}`);
          }

          if (options?.permanent) {
            // 永久删除所有版本
            allVersions.forEach((obj: any) => {
              const objectKey = (this as any).generateObjectKey(bucket, normalizedKey, obj.version_id);
              (this as any).objects.delete(objectKey);
              if (!obj.is_delete_marker) {
                totalSizeDeleted += obj.size;
              }
            });
          } else if (options?.version_ids?.[key]) {
            // 删除指定版本
            const versionId = options.version_ids[key];
            const versionToDelete = allVersions.find((obj: any) => obj.version_id === versionId);
            if (versionToDelete) {
              const objectKey = (this as any).generateObjectKey(bucket, normalizedKey, versionToDelete.version_id);
              (this as any).objects.delete(objectKey);
              if (!versionToDelete.is_delete_marker) {
                totalSizeDeleted += versionToDelete.size;
              }
            }
          } else {
            // 创建删除标记（软删除）
            const now = getCurrentTime();
            const deleteMarkerVersionId = `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const deleteMarkerKey = (this as any).generateObjectKey(bucket, normalizedKey, deleteMarkerVersionId);

            // 将旧版本标记为非最新
            allVersions.forEach((obj: any) => {
              obj.is_latest = false;
            });

            const deleteMarker = {
              bucket,
              key: normalizedKey,
              version_id: deleteMarkerVersionId,
              is_latest: true,
              is_delete_marker: true,
              data: null,
              size: 0,
              content_type: 'application/x-delete-marker',
              etag: '',
              last_modified: now,
              storage_class: 'STANDARD',
              acl: 'private',
              metadata: {},
              tags: {},
            };

            (this as any).objects.set(deleteMarkerKey, deleteMarker);
            totalSizeDeleted += 0; // 删除标记不占用空间
          }

          deleted.push(normalizedKey);
        } catch (error: any) {
          failed.push({
            key,
            error: error.message || 'Unknown error',
          });
        }
      });

      // 更新桶统计
      if (totalSizeDeleted > 0) {
        (this as any).updateBucketStats(bucket, -totalSizeDeleted, -deleted.length);
      }

      (this as any).debugLog(`Bulk delete completed: ${deleted.length} success, ${failed.length} failed`);

      return {
        success: failed.length === 0,
        deleted,
        failed,
        total: keys.length,
        success_count: deleted.length,
        failed_count: failed.length,
        deleted_size: totalSizeDeleted,
      };
    }

    // ==================== 批量复制 ====================

    /**
     * 批量复制对象
     * 
     * @param sourceBucket 源桶
     * @param destBucket 目标桶
     * @param keys 对象键列表（可以是键数组，也可以是源键到目标键的映射）
     * @param options 复制选项
     * @returns 批量复制结果
     */
    bulkCopy(
      sourceBucket: string,
      destBucket: string,
      keys: string[] | Array<{ source: string; destination: string }>,
      options?: {
        storage_class?: string;
        acl?: string;
        metadata_directive?: 'COPY' | 'REPLACE';
        on_progress?: (copied: number, total: number, current_key?: string) => void;
      },
    ): BulkCopyResult {
      (this as any).recordRequest(true);

      // 检查源桶是否存在
      if (!(this as any).bucketExists(sourceBucket)) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Source bucket not found: ${sourceBucket}`,
          copied: [],
          failed: [],
          total: Array.isArray(keys) ? keys.length : 0,
          success_count: 0,
          failed_count: 0,
        };
      }

      // 检查目标桶是否存在
      if (!(this as any).bucketExists(destBucket)) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Destination bucket not found: ${destBucket}`,
          copied: [],
          failed: [],
          total: Array.isArray(keys) ? keys.length : 0,
          success_count: 0,
          failed_count: 0,
        };
      }

      // 标准化键列表
      const copyPairs = keys.map((item) => {
        if (typeof item === 'string') {
          return { source: item, destination: item };
        }
        return item;
      });

      const copied: Array<{
        source: string;
        destination: string;
        etag: string;
        last_modified: string;
      }> = [];
      const failed: Array<{
        source: string;
        error: string;
      }> = [];

      copyPairs.forEach((pair, index) => {
        try {
          const result = (this as any).copyObject(
            sourceBucket,
            pair.source,
            destBucket,
            pair.destination,
            {
              storage_class: options?.storage_class,
              acl: options?.acl,
              metadata_directive: options?.metadata_directive,
            },
          );

          if (!result.success) {
            throw new Error(result.error || 'Copy failed');
          }

          copied.push({
            source: pair.source,
            destination: pair.destination,
            etag: result.etag,
            last_modified: result.last_modified,
          });

          // 调用进度回调
          if (options?.on_progress) {
            options.on_progress(copied.length + failed.length, copyPairs.length, pair.source);
          }
        } catch (error: any) {
          failed.push({
            source: pair.source,
            error: error.message || 'Unknown error',
          });
        }
      });

      (this as any).debugLog(`Bulk copy completed: ${copied.length} success, ${failed.length} failed`);

      return {
        success: failed.length === 0,
        copied,
        failed,
        total: copyPairs.length,
        success_count: copied.length,
        failed_count: failed.length,
      };
    }

    // ==================== 批量移动 ====================

    /**
     * 批量移动对象
     * 
     * @param sourceBucket 源桶
     * @param destBucket 目标桶
     * @param keys 对象键列表
     * @param options 移动选项
     * @returns 批量移动结果
     */
    bulkMove(
      sourceBucket: string,
      destBucket: string,
      keys: string[] | Array<{ source: string; destination: string }>,
      options?: {
        storage_class?: string;
        acl?: string;
        on_progress?: (moved: number, total: number, current_key?: string) => void;
      },
    ): {
      success: boolean;
      error?: string;
      moved: Array<{ source: string; destination: string }>;
      failed: Array<{ source: string; error: string }>;
      total: number;
      success_count: number;
      failed_count: number;
    } {
      (this as any).recordRequest(true);

      // 先批量复制
      const copyResult = this.bulkCopy(sourceBucket, destBucket, keys, options);

      if (!copyResult.success && copyResult.copied.length === 0) {
        return {
          success: false,
          error: copyResult.error,
          moved: [],
          failed: copyResult.failed,
          total: copyResult.total,
          success_count: 0,
          failed_count: copyResult.failed_count,
        };
      }

      // 删除源对象（只删除成功复制的）
      const sourceKeysToDelete = copyResult.copied.map((item: any) => item.source);
      const deleteResult = this.bulkDelete(sourceBucket, sourceKeysToDelete, { permanent: true });

      const moved = copyResult.copied.map((item: any) => ({
        source: item.source,
        destination: item.destination,
      }));

      (this as any).debugLog(`Bulk move completed: ${moved.length} success, ${copyResult.failed.length} failed`);

      return {
        success: copyResult.failed.length === 0 && deleteResult.success,
        moved,
        failed: copyResult.failed,
        total: copyResult.total,
        success_count: moved.length,
        failed_count: copyResult.failed_count,
      };
    }
  };
}
