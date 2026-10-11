/**
 * L2 操作层 - 文件操作 Mixin
 * 
 * 提供文件移动、复制、重命名、截断、追加等高级操作
 */

import type { Constructor } from './mixin.types';
import type {
  FileObject,
  CopyResult,
  MoveResult,
} from '../types';

import {
  getCurrentTime,
  normalizePath,
  getFileName,
  getDirectoryPath,
  calculateETag,
} from '../utils';

/**
 * 文件操作 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithFileOperation<T extends Constructor>(Base: T) {
  return class FileOperationMixin extends Base {
    // ==================== 文件复制 ====================

    /**
     * 复制对象
     * 
     * @param sourceBucket 源桶
     * @param sourceKey 源键
     * @param destBucket 目标桶
     * @param destKey 目标键
     * @param options 复制选项
     * @returns 复制结果
     */
    copyObject(
      sourceBucket: string,
      sourceKey: string,
      destBucket: string,
      destKey: string,
      options?: {
        storage_class?: string;
        acl?: string;
        metadata?: Record<string, string>;
        metadata_directive?: 'COPY' | 'REPLACE';
        tagging_directive?: 'COPY' | 'REPLACE';
        tags?: Record<string, string>;
      },
    ): CopyResult {
      (this as any).recordRequest(true);

      // 检查源桶是否存在
      if (!(this as any).bucketExists(sourceBucket)) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Source bucket not found: ${sourceBucket}`,
        };
      }

      // 检查目标桶是否存在
      if (!(this as any).bucketExists(destBucket)) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Destination bucket not found: ${destBucket}`,
        };
      }

      const normalizedSourceKey = normalizePath(sourceKey);
      const normalizedDestKey = normalizePath(destKey);

      // 获取源对象
      const sourceVersions = (Array.from((this as any).objects.values()) as any[]).filter(
        (obj: any) => obj.bucket === sourceBucket && obj.key === normalizedSourceKey,
      );
      const sourceLatest = sourceVersions.find((obj: any) => obj.is_latest);
      const sourceObject = sourceLatest || sourceVersions[0];

      if (!sourceObject || sourceObject.is_delete_marker) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Source object not found: ${sourceBucket}/${normalizedSourceKey}`,
        };
      }

      // 处理元数据指令
      let metadata = sourceObject.metadata;
      if (options?.metadata_directive === 'REPLACE' && options.metadata) {
        metadata = { ...options.metadata };
      } else if (options?.metadata) {
        metadata = { ...metadata, ...options.metadata };
      }

      // 处理标签指令
      let tags = sourceObject.tags;
      if (options?.tagging_directive === 'REPLACE' && options.tags) {
        tags = { ...options.tags };
      } else if (options?.tags) {
        tags = { ...tags, ...options.tags };
      }

      // 创建目标对象
      const now = getCurrentTime();
      const versionId = `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const destObjectKey = (this as any).generateObjectKey(destBucket, normalizedDestKey, versionId);

      const destObject: FileObject = {
        bucket: destBucket,
        key: normalizedDestKey,
        version_id: versionId,
        is_latest: true,
        is_delete_marker: false,
        data: sourceObject.data,
        size: sourceObject.size,
        content_type: sourceObject.content_type,
        etag: sourceObject.etag,
        last_modified: now,
        storage_class: options?.storage_class || sourceObject.storage_class,
        acl: options?.acl || sourceObject.acl,
        metadata,
        tags,
      };

      // 将目标桶中的旧版本标记为非最新
      const oldDestVersions = (Array.from((this as any).objects.values()) as any[]).filter(
        (obj: any) => obj.bucket === destBucket && obj.key === normalizedDestKey && obj.is_latest,
      );
      oldDestVersions.forEach((obj: any) => {
        obj.is_latest = false;
      });

      // 保存目标对象
      (this as any).objects.set(destObjectKey, destObject);

      // 更新目标桶统计
      (this as any).updateBucketStats(destBucket, destObject.size, 1);

      // 清除相关缓存
      const cacheKeysToDelete: string[] = [];
      for (const cacheKey of (this as any).queryCache.keys()) {
        if (cacheKey.includes(`bucket:${destBucket}`) && cacheKey.includes(`key:${normalizedDestKey}`)) {
          cacheKeysToDelete.push(cacheKey);
        }
      }
      cacheKeysToDelete.forEach(cacheKey => (this as any).queryCache.delete(cacheKey));

      (this as any).debugLog(`Object copied: ${sourceBucket}/${normalizedSourceKey} -> ${destBucket}/${normalizedDestKey}`);

      return {
        success: true,
        source: { bucket: sourceBucket, key: normalizedSourceKey },
        destination: { bucket: destBucket, key: normalizedDestKey },
        etag: destObject.etag,
        last_modified: destObject.last_modified,
        version_id: destObject.version_id,
      };
    }

    // ==================== 文件移动 ====================

    /**
     * 移动对象（复制 + 删除源对象）
     * 
     * @param sourceBucket 源桶
     * @param sourceKey 源键
     * @param destBucket 目标桶
     * @param destKey 目标键
     * @param options 移动选项
     * @returns 移动结果
     */
    moveObject(
      sourceBucket: string,
      sourceKey: string,
      destBucket: string,
      destKey: string,
      options?: {
        storage_class?: string;
        acl?: string;
      },
    ): MoveResult {
      (this as any).recordRequest(true);

      // 先复制对象
      const copyResult = this.copyObject(sourceBucket, sourceKey, destBucket, destKey, options);

      if (!copyResult.success) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: copyResult.error,
        };
      }

      // 删除源对象（所有版本）
      const sourceVersions = (Array.from((this as any).objects.values()) as any[]).filter(
        (obj: any) => obj.bucket === sourceBucket && obj.key === normalizePath(sourceKey),
      );

      let totalSizeDeleted = 0;
      sourceVersions.forEach((obj: any) => {
        const objectKey = (this as any).generateObjectKey(sourceBucket, obj.key, obj.version_id);
        (this as any).objects.delete(objectKey);
        if (!obj.is_delete_marker) {
          totalSizeDeleted += obj.size;
        }
      });

      // 更新源桶统计
      (this as any).updateBucketStats(sourceBucket, -totalSizeDeleted, -sourceVersions.filter((o: any) => !o.is_delete_marker).length);

      (this as any).debugLog(`Object moved: ${sourceBucket}/${sourceKey} -> ${destBucket}/${destKey}`);

      return {
        success: true,
        source: { bucket: sourceBucket, key: normalizePath(sourceKey) },
        destination: { bucket: destBucket, key: normalizePath(destKey) },
      };
    }

    // ==================== 文件重命名 ====================

    /**
     * 重命名对象
     * 
     * @param bucket 桶名
     * @param oldKey 旧键
     * @param newKey 新键
     * @returns 重命名结果
     */
    renameObject(
      bucket: string,
      oldKey: string,
      newKey: string,
    ): MoveResult {
      return this.moveObject(bucket, oldKey, bucket, newKey);
    }

    // ==================== 文件截断 ====================

    /**
     * 截断对象（保留前N字节）
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param size 保留的字节数
     * @returns 截断结果
     */
    truncateObject(
      bucket: string,
      key: string,
      size: number,
    ): {
      success: boolean;
      error?: string;
      new_size?: number;
      new_etag?: string;
    } {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${bucket}` };
      }

      const normalizedKey = normalizePath(key);

      // 获取最新版本
      const allVersions = (Array.from((this as any).objects.values()) as any[]).filter(
        (obj: any) => obj.bucket === bucket && obj.key === normalizedKey,
      );
      const latestVersion = allVersions.find((obj: any) => obj.is_latest);
      const fileObject = latestVersion || allVersions[0];

      if (!fileObject || fileObject.is_delete_marker) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Object not found: ${bucket}/${normalizedKey}`,
        };
      }

      // 截断数据
      let newData: string | Buffer;
      if (typeof fileObject.data === 'string') {
        newData = fileObject.data.substring(0, size);
      } else {
        newData = (fileObject.data as Buffer).subarray(0, size);
      }

      const newSize = typeof newData === 'string' ? (Buffer as any).byteLength(newData, 'utf8') : newData.length;
      const newETag = calculateETag(newData);

      // 创建新版本
      const now = getCurrentTime();
      const versionId = `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const objectKey = (this as any).generateObjectKey(bucket, normalizedKey, versionId);

      // 将旧版本标记为非最新
      allVersions.forEach((obj: any) => {
        obj.is_latest = false;
      });

      const newObject: FileObject = {
        ...fileObject,
        version_id: versionId,
        is_latest: true,
        data: newData,
        size: newSize,
        etag: newETag,
        last_modified: now,
      };

      (this as any).objects.set(objectKey, newObject);

      // 更新桶统计
      (this as any).updateBucketStats(bucket, newSize - fileObject.size, 0);

      (this as any).debugLog(`Object truncated: ${bucket}/${normalizedKey}, new size: ${newSize}`);

      return {
        success: true,
        new_size: newSize,
        new_etag: newETag,
      };
    }

    // ==================== 追加内容 ====================

    /**
     * 追加内容到对象末尾
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param data 要追加的数据
     * @returns 追加结果
     */
    appendToObject(
      bucket: string,
      key: string,
      data: string | Buffer,
    ): {
      success: boolean;
      error?: string;
      new_size?: number;
      new_etag?: string;
    } {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${bucket}` };
      }

      const normalizedKey = normalizePath(key);

      // 获取最新版本
      const allVersions = (Array.from((this as any).objects.values()) as any[]).filter(
        (obj: any) => obj.bucket === bucket && obj.key === normalizedKey,
      );
      const latestVersion = allVersions.find((obj: any) => obj.is_latest);
      const fileObject = latestVersion || allVersions[0];

      if (!fileObject || fileObject.is_delete_marker) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Object not found: ${bucket}/${normalizedKey}`,
        };
      }

      // 合并数据
      let newData: string | Buffer;
      if (typeof fileObject.data === 'string' && typeof data === 'string') {
        newData = fileObject.data + data;
      } else {
        // 转换为Buffer进行合并
        const oldBuffer = typeof fileObject.data === 'string'
          ? (Buffer as any).from(fileObject.data, 'utf8')
          : fileObject.data;
        const newBuffer = typeof data === 'string'
          ? (Buffer as any).from(data, 'utf8')
          : data;
        newData = (Buffer as any).concat([oldBuffer, newBuffer]);
      }

      const newSize = typeof newData === 'string' ? (Buffer as any).byteLength(newData, 'utf8') : newData.length;
      const newETag = calculateETag(newData);

      // 创建新版本
      const now = getCurrentTime();
      const versionId = `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const objectKey = (this as any).generateObjectKey(bucket, normalizedKey, versionId);

      // 将旧版本标记为非最新
      allVersions.forEach((obj: any) => {
        obj.is_latest = false;
      });

      const newObject: FileObject = {
        ...fileObject,
        version_id: versionId,
        is_latest: true,
        data: newData,
        size: newSize,
        etag: newETag,
        last_modified: now,
      };

      (this as any).objects.set(objectKey, newObject);

      // 更新桶统计
      (this as any).updateBucketStats(bucket, newSize - fileObject.size, 0);

      (this as any).debugLog(`Content appended to object: ${bucket}/${normalizedKey}, new size: ${newSize}`);

      return {
        success: true,
        new_size: newSize,
        new_etag: newETag,
      };
    }

    // ==================== 获取文件信息 ====================

    /**
     * 获取文件详细信息
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @returns 文件详细信息
     */
    getFileInfo(
      bucket: string,
      key: string,
    ): {
      success: boolean;
      error?: string;
      file?: {
        bucket: string;
        key: string;
        file_name: string;
        directory: string;
        size: number;
        content_type: string;
        etag: string;
        last_modified: string;
        storage_class: string;
        acl: string;
        version_count: number;
        is_latest: boolean;
        is_delete_marker: boolean;
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
      const latestVersion = allVersions.find((obj: any) => obj.is_latest);
      const fileObject = latestVersion || allVersions[0];

      if (!fileObject) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Object not found: ${bucket}/${normalizedKey}`,
        };
      }

      return {
        success: true,
        file: {
          bucket: fileObject.bucket,
          key: fileObject.key,
          file_name: getFileName(fileObject.key),
          directory: getDirectoryPath(fileObject.key),
          size: fileObject.size,
          content_type: fileObject.content_type,
          etag: fileObject.etag,
          last_modified: fileObject.last_modified,
          storage_class: fileObject.storage_class,
          acl: fileObject.acl,
          version_count: allVersions.length,
          is_latest: fileObject.is_latest,
          is_delete_marker: fileObject.is_delete_marker,
        },
      };
    }
  };
}
