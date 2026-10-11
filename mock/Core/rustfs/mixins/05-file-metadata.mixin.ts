/**
 * L1 基础层 - 文件元数据 Mixin
 * 
 * 提供文件元数据获取/设置、存在性检查、对象列表等功能
 */

import type { Constructor } from './mixin.types';
import type {
  FileObject,
  ListObjectsResult,
  ListObjectVersionsResult,
  FileMetadata,
} from '../types';

import {
  getCurrentTime,
  normalizePath,
  extractDirectories,
  filterObjectsByPrefix,
} from '../utils';

/**
 * 文件元数据 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithFileMetadata<T extends Constructor>(Base: T) {
  return class FileMetadataMixin extends Base {
    // ==================== 文件元数据获取/设置 ====================

    /**
     * 获取对象元数据
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @returns 对象元数据
     */
    getObjectMetadata(
      bucket: string,
      key: string,
    ): FileMetadata | null {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return null;
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
        return null;
      }

      return {
        size: fileObject.size,
        content_type: fileObject.content_type,
        etag: fileObject.etag,
        last_modified: fileObject.last_modified,
        creation_date: fileObject.last_modified, // 简化处理
        storage_class: fileObject.storage_class,
        acl: fileObject.acl,
        custom_metadata: fileObject.metadata,
        tags: fileObject.tags,
        version_id: fileObject.version_id,
        is_latest: fileObject.is_latest,
      };
    }

    /**
     * 设置对象元数据
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param metadata 自定义元数据
     * @returns 设置结果
     */
    setObjectMetadata(
      bucket: string,
      key: string,
      metadata: Record<string, string>,
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

      // 更新元数据
      fileObject.metadata = { ...metadata };
      fileObject.last_modified = getCurrentTime();

      // 清除相关缓存
      const cacheKeysToDelete: string[] = [];
      for (const cacheKey of (this as any).queryCache.keys()) {
        if (cacheKey.includes(`bucket:${bucket}`) && cacheKey.includes(`key:${normalizedKey}`)) {
          cacheKeysToDelete.push(cacheKey);
        }
      }
      cacheKeysToDelete.forEach(cacheKey => (this as any).queryCache.delete(cacheKey));

      (this as any).debugLog(`Object metadata updated: ${bucket}/${normalizedKey}`, metadata);

      return { success: true };
    }

    // ==================== 对象存在性检查 ====================

    /**
     * 检查对象是否存在
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @returns 是否存在
     */
    objectExists(bucket: string, key: string): boolean {
      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        return false;
      }

      const normalizedKey = normalizePath(key);

      // 获取所有版本
      const allVersions = (Array.from((this as any).objects.values()) as any[]).filter(
        (obj: any) => obj.bucket === bucket && obj.key === normalizedKey,
      );
      const latestVersion = allVersions.find((obj: any) => obj.is_latest);

      return !!latestVersion && !latestVersion.is_delete_marker;
    }

    /**
     * 获取对象大小
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @returns 对象大小（字节）
     */
    getObjectSize(bucket: string, key: string): number | null {
      const metadata = this.getObjectMetadata(bucket, key);
      return metadata ? metadata.size : null;
    }

    /**
     * 获取对象MIME类型
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @returns MIME类型
     */
    getObjectContentType(bucket: string, key: string): string | null {
      const metadata = this.getObjectMetadata(bucket, key);
      return metadata ? metadata.content_type : null;
    }

    /**
     * 获取对象ETag
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @returns ETag
     */
    getObjectETag(bucket: string, key: string): string | null {
      const metadata = this.getObjectMetadata(bucket, key);
      return metadata ? metadata.etag : null;
    }

    /**
     * 获取对象最后修改时间
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @returns 最后修改时间
     */
    getObjectLastModified(bucket: string, key: string): string | null {
      const metadata = this.getObjectMetadata(bucket, key);
      return metadata ? metadata.last_modified : null;
    }

    // ==================== 对象列表 ====================

    /**
     * 列出对象
     * 
     * @param bucket 桶名
     * @param prefix 前缀筛选（可选）
     * @param delimiter 分隔符（可选，用于分组）
     * @param marker 标记（可选，用于分页）
     * @param maxKeys 最大数量（可选，默认1000）
     * @returns 对象列表结果
     */
    listObjects(
      bucket: string,
      prefix: string = '',
      delimiter: string = '',
      marker: string = '',
      maxKeys: number = 1000,
    ): ListObjectsResult {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return {
          contents: [],
          name: bucket,
          prefix,
          delimiter,
          max_keys: maxKeys,
          is_truncated: false,
        };
      }

      // 获取所有对象（最新版本，非删除标记）
      let objects = (Array.from((this as any).objects.values()) as any[]).filter(
        (obj: any) => obj.bucket === bucket && obj.is_latest && !obj.is_delete_marker,
      );

      // 前缀筛选
      if (prefix) {
        objects = objects.filter((obj: any) => obj.key.startsWith(prefix));
      }

      // 标记筛选（分页）
      if (marker) {
        const markerIndex = objects.findIndex((obj: any) => obj.key === marker);
        if (markerIndex !== -1) {
          objects = objects.slice(markerIndex + 1);
        }
      }

      // 按键排序
      objects.sort((a: any, b: any) => a.key.localeCompare(b.key));

      // 提取通用前缀（如果指定了分隔符）
      let commonPrefixes: { prefix: string }[] | undefined;
      if (delimiter) {
        commonPrefixes = extractDirectories(objects, prefix, delimiter).map(dir => ({
          prefix: prefix + dir,
        }));
        // 只保留当前目录下的对象（不包含子目录中的对象）
        objects = objects.filter((obj: any) => {
          const relativeKey = obj.key.substring(prefix.length);
          return !relativeKey.includes(delimiter);
        });
      }

      // 限制数量
      const isTruncated = objects.length > maxKeys;
      const nextMarker = isTruncated ? objects[maxKeys - 1]?.key : undefined;
      objects = objects.slice(0, maxKeys);

      return {
        contents: objects,
        name: bucket,
        prefix,
        delimiter: delimiter || undefined,
        marker: marker || undefined,
        next_marker: nextMarker,
        max_keys: maxKeys,
        is_truncated: isTruncated,
        common_prefixes: commonPrefixes,
      };
    }

    /**
     * 列出对象版本
     * 
     * @param bucket 桶名
     * @param prefix 前缀筛选（可选）
     * @param keyMarker 键标记（可选，用于分页）
     * @param versionIdMarker 版本ID标记（可选）
     * @param maxKeys 最大数量（可选，默认1000）
     * @returns 对象版本列表结果
     */
    listObjectVersions(
      bucket: string,
      prefix: string = '',
      keyMarker: string = '',
      versionIdMarker: string = '',
      maxKeys: number = 1000,
    ): ListObjectVersionsResult {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return {
          versions: [],
          delete_markers: [],
          name: bucket,
          prefix,
          max_keys: maxKeys,
          is_truncated: false,
        };
      }

      // 获取所有对象（包括删除标记）
      let allObjects = (Array.from((this as any).objects.values()) as any[]).filter(
        (obj: any) => obj.bucket === bucket,
      );

      // 前缀筛选
      if (prefix) {
        allObjects = allObjects.filter((obj: any) => obj.key.startsWith(prefix));
      }

      // 按键和版本排序
      allObjects.sort((a: any, b: any) => {
        const keyCompare = a.key.localeCompare(b.key);
        if (keyCompare !== 0) return keyCompare;
        return new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime();
      });

      // 标记筛选（分页）
      if (keyMarker) {
        const markerIndex = allObjects.findIndex(
          (obj: any) => obj.key === keyMarker && (!versionIdMarker || obj.version_id === versionIdMarker),
        );
        if (markerIndex !== -1) {
          allObjects = allObjects.slice(markerIndex + 1);
        }
      }

      // 分离版本和删除标记
      const versions = allObjects.filter((obj: any) => !obj.is_delete_marker);
      const deleteMarkers = allObjects.filter((obj: any) => obj.is_delete_marker);

      // 限制数量
      const isTruncated = allObjects.length > maxKeys;
      const nextKeyMarker = isTruncated ? allObjects[maxKeys - 1]?.key : undefined;
      const nextVersionIdMarker = isTruncated ? allObjects[maxKeys - 1]?.version_id : undefined;

      return {
        versions: versions.slice(0, maxKeys),
        delete_markers: deleteMarkers.slice(0, maxKeys),
        name: bucket,
        prefix,
        key_marker: keyMarker || undefined,
        version_id_marker: versionIdMarker || undefined,
        next_key_marker: nextKeyMarker,
        next_version_id_marker: nextVersionIdMarker,
        max_keys: maxKeys,
        is_truncated: isTruncated,
      };
    }

    // ==================== 缓存相关 ====================

    /**
     * 获取缓存的对象列表（如果存在）
     * 
     * @param bucket 桶名
     * @param prefix 前缀
     * @returns 缓存的对象列表或null
     */
    getCachedObjectList(bucket: string, prefix: string): FileObject[] | null {
      if (!(this as any).cacheConfig.enabled) {
        return null;
      }

      const cacheKey = `object-list:bucket:${bucket}:prefix:${prefix}`;
      const cachedEntry = (this as any).queryCache.get(cacheKey);

      if (!cachedEntry) {
        (this as any).cacheMissCount++;
        return null;
      }

      // 检查是否过期
      if (Date.now() > cachedEntry.expires_at) {
        (this as any).queryCache.delete(cacheKey);
        (this as any).cacheMissCount++;
        return null;
      }

      cachedEntry.last_accessed_at = Date.now();
      cachedEntry.access_count++;
      (this as any).cacheHitCount++;

      return cachedEntry.value;
    }

    /**
     * 缓存对象列表
     * 
     * @param bucket 桶名
     * @param prefix 前缀
     * @param objects 对象列表
     */
    cacheObjectList(bucket: string, prefix: string, objects: FileObject[]): void {
      if (!(this as any).cacheConfig.enabled) {
        return;
      }

      const cacheKey = `object-list:bucket:${bucket}:prefix:${prefix}`;
      const now = Date.now();
      const size = objects.reduce((sum, obj) => sum + obj.size, 0);

      (this as any).queryCache.set(cacheKey, {
        key: cacheKey,
        value: objects,
        created_at: now,
        last_accessed_at: now,
        access_count: 0,
        expires_at: now + (this as any).cacheConfig.ttl,
        size,
      });

      // 检查缓存大小，如果超过限制则驱逐
      if ((this as any).queryCache.size > (this as any).cacheConfig.max_entries) {
        // 简单的LRU驱逐
        let oldestKey: string | null = null;
        let oldestTime = Infinity;
        for (const [key, entry] of (this as any).queryCache.entries()) {
          if (entry.last_accessed_at < oldestTime) {
            oldestTime = entry.last_accessed_at;
            oldestKey = key;
          }
        }
        if (oldestKey) {
          (this as any).queryCache.delete(oldestKey);
          (this as any).cacheEvictionCount++;
        }
      }
    }
  };
}
