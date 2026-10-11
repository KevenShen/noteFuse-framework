/**
 * L2 操作层 - 目录操作 Mixin
 * 
 * 提供目录创建、列出、删除、重命名等操作
 * 注意：对象存储中没有真正的目录，目录是通过对象键的前缀模拟的
 */

import type { Constructor } from './mixin.types';
import type {
  DirectoryInfo,
  ListDirectoryResult,
} from '../types';

import {
  normalizePath,
  getDirectoryPath,
  getFileName,
} from '../utils';

/**
 * 目录操作 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithDirectory<T extends Constructor>(Base: T) {
  return class DirectoryMixin extends Base {
    // ==================== 目录创建 ====================

    /**
     * 创建目录（通过创建一个以 / 结尾的空对象来模拟）
     * 
     * @param bucket 桶名
     * @param directoryPath 目录路径
     * @returns 创建结果
     */
    createDirectory(
      bucket: string,
      directoryPath: string,
    ): {
      success: boolean;
      error?: string;
      directory?: string;
      message?: string;
    } {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${bucket}` };
      }

      // 规范化目录路径，确保以 / 结尾
      let normalizedPath = normalizePath(directoryPath);
      if (!normalizedPath.endsWith('/')) {
        normalizedPath += '/';
      }

      // 检查目录是否已存在
      const existingObject = (this as any).objectExists(bucket, normalizedPath);
      if (existingObject) {
        return {
          success: true,
          directory: normalizedPath,
          message: 'Directory already exists',
        };
      }

      // 创建目录标记对象（空对象，以 / 结尾）
      const now = new Date().toISOString();
      const versionId = `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const objectKey = (this as any).generateObjectKey(bucket, normalizedPath, versionId);

      const directoryObject = {
        bucket,
        key: normalizedPath,
        version_id: versionId,
        is_latest: true,
        is_delete_marker: false,
        data: '',
        size: 0,
        content_type: 'application/x-directory',
        etag: 'd41d8cd98f00b204e9800998ecf8427e', // 空字符串的MD5
        last_modified: now,
        storage_class: 'STANDARD',
        acl: 'private',
        metadata: {
          'x-amz-meta-directory': 'true',
        },
        tags: {},
      };

      (this as any).objects.set(objectKey, directoryObject);

      (this as any).debugLog(`Directory created: ${bucket}/${normalizedPath}`);

      return {
        success: true,
        directory: normalizedPath,
      };
    }

    // ==================== 目录列出 ====================

    /**
     * 列出目录内容
     * 
     * @param bucket 桶名
     * @param directoryPath 目录路径
     * @param options 列出选项
     * @returns 目录内容列表
     */
    listDirectory(
      bucket: string,
      directoryPath: string = '',
      options?: {
        recursive?: boolean;
        include_files?: boolean;
        include_directories?: boolean;
        max_keys?: number;
        marker?: string;
      },
    ): {
      directories: Array<{
        name: string;
        path: string;
        last_modified: string;
        size: number;
      }>;
      files: any[];
      directory: string;
      prefix?: string;
      marker?: string;
      next_marker?: string;
      max_keys: number;
      is_truncated: boolean;
      total_count?: number;
    } {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return {
          directories: [],
          files: [],
          directory: directoryPath,
          max_keys: options?.max_keys ?? 1000,
          is_truncated: false,
        };
      }

      const recursive = options?.recursive ?? false;
      const includeFiles = options?.include_files ?? true;
      const includeDirectories = options?.include_directories ?? true;
      const maxKeys = options?.max_keys ?? 1000;

      // 规范化目录路径
      let prefix = normalizePath(directoryPath);
      if (prefix && !prefix.endsWith('/')) {
        prefix += '/';
      }

      // 获取所有对象
      let objects = (Array.from((this as any).objects.values()) as any[]).filter(
        (obj: any) => obj.bucket === bucket && obj.is_latest && !obj.is_delete_marker,
      );

      // 前缀筛选
      if (prefix) {
        objects = objects.filter((obj: any) => obj.key.startsWith(prefix));
      }

      // 标记筛选（分页）
      if (options?.marker) {
        const markerIndex = objects.findIndex((obj: any) => obj.key === options.marker);
        if (markerIndex !== -1) {
          objects = objects.slice(markerIndex + 1);
        }
      }

      // 按键排序
      objects.sort((a: any, b: any) => a.key.localeCompare(b.key));

      // 提取目录和文件
      const directories = new Set<string>();
      const files: any[] = [];

      objects.forEach((obj: any) => {
        const relativeKey = prefix ? obj.key.substring(prefix.length) : obj.key;

        if (!relativeKey) return;

        const slashIndex = relativeKey.indexOf('/');

        if (slashIndex === -1) {
          // 这是一个文件
          if (includeFiles) {
            files.push(obj);
          }
        } else {
          // 这是一个子目录
          if (includeDirectories) {
            const dirName = relativeKey.substring(0, slashIndex + 1);
            directories.add(dirName);
          }

          // 如果递归，继续处理子目录中的文件
          if (recursive && includeFiles) {
            files.push(obj);
          }
        }
      });

      // 限制数量
      const totalItems = directories.size + files.length;
      const isTruncated = totalItems > maxKeys;
      const nextMarker = isTruncated ? objects[maxKeys - 1]?.key : undefined;

      // 转换目录集合为数组
      const directoryArray = Array.from(directories).map(dirName => ({
        name: dirName,
        path: prefix + dirName,
        last_modified: '', // 目录没有修改时间
        size: 0,
      }));

      return {
        directories: directoryArray.slice(0, maxKeys),
        files: files.slice(0, maxKeys),
        directory: directoryPath,
        prefix,
        marker: options?.marker,
        next_marker: nextMarker,
        max_keys: maxKeys,
        is_truncated: isTruncated,
        total_count: totalItems,
      };
    }

    // ==================== 目录信息 ====================

    /**
     * 获取目录信息
     * 
     * @param bucket 桶名
     * @param directoryPath 目录路径
     * @returns 目录信息
     */
    getDirectoryInfo(
      bucket: string,
      directoryPath: string,
    ): {
      success: boolean;
      error?: string;
      directory?: {
        name: string;
        path: string;
        file_count: number;
        subdirectory_count: number;
        total_size: number;
        last_modified: string;
        exists: boolean;
      };
    } {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${bucket}` };
      }

      // 规范化目录路径
      let prefix = normalizePath(directoryPath);
      if (!prefix.endsWith('/')) {
        prefix += '/';
      }

      // 获取目录下的所有对象
      const objects = (Array.from((this as any).objects.values()) as any[]).filter(
        (obj: any) => obj.bucket === bucket && obj.key.startsWith(prefix) && obj.is_latest && !obj.is_delete_marker,
      );

      // 计算统计信息
      let totalSize = 0;
      let fileCount = 0;
      const subdirectories = new Set<string>();
      let lastModified = '';

      objects.forEach((obj: any) => {
        const relativeKey = obj.key.substring(prefix.length);
        const slashIndex = relativeKey.indexOf('/');

        if (slashIndex === -1) {
          // 这是一个文件
          fileCount++;
          totalSize += obj.size;
          if (!lastModified || obj.last_modified > lastModified) {
            lastModified = obj.last_modified;
          }
        } else {
          // 这是一个子目录
          const dirName = relativeKey.substring(0, slashIndex + 1);
          subdirectories.add(dirName);
        }
      });

      return {
        success: true,
        directory: {
          name: getFileName(prefix) || prefix,
          path: prefix,
          file_count: fileCount,
          subdirectory_count: subdirectories.size,
          total_size: totalSize,
          last_modified: lastModified,
          exists: objects.length > 0 || prefix === '/',
        },
      };
    }

    // ==================== 目录删除 ====================

    /**
     * 删除目录（递归删除目录下的所有对象）
     * 
     * @param bucket 桶名
     * @param directoryPath 目录路径
     * @param options 删除选项
     * @returns 删除结果
     */
    deleteDirectory(
      bucket: string,
      directoryPath: string,
      options?: {
        recursive?: boolean;
        force?: boolean;
      },
    ): {
      success: boolean;
      error?: string;
      deleted_count?: number;
      deleted_size?: number;
    } {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${bucket}` };
      }

      const recursive = options?.recursive ?? false;
      const force = options?.force ?? false;

      // 规范化目录路径
      let prefix = normalizePath(directoryPath);
      if (!prefix.endsWith('/')) {
        prefix += '/';
      }

      // 获取目录下的所有对象
      const objects = (Array.from((this as any).objects.values()) as any[]).filter(
        (obj: any) => obj.bucket === bucket && obj.key.startsWith(prefix),
      );

      // 如果不是递归删除，检查目录是否为空
      if (!recursive && !force) {
        const hasFiles = objects.some((obj: any) => {
          const relativeKey = obj.key.substring(prefix.length);
          return relativeKey && !relativeKey.endsWith('/');
        });

        if (hasFiles) {
          (this as any).recordRequest(false);
          return {
            success: false,
            error: `Directory not empty: ${prefix}. Use recursive: true to delete recursively.`,
          };
        }
      }

      // 删除所有对象
      let deletedCount = 0;
      let deletedSize = 0;

      objects.forEach((obj: any) => {
        const objectKey = (this as any).generateObjectKey(bucket, obj.key, obj.version_id);
        (this as any).objects.delete(objectKey);
        if (!obj.is_delete_marker) {
          deletedCount++;
          deletedSize += obj.size;
        }
      });

      // 更新桶统计
      (this as any).updateBucketStats(bucket, -deletedSize, -deletedCount);

      (this as any).debugLog(`Directory deleted: ${bucket}/${prefix}, deleted ${deletedCount} objects, ${deletedSize} bytes`);

      return {
        success: true,
        deleted_count: deletedCount,
        deleted_size: deletedSize,
      };
    }

    // ==================== 目录重命名 ====================

    /**
     * 重命名目录（递归移动目录下的所有对象）
     * 
     * @param bucket 桶名
     * @param oldPath 旧路径
     * @param newPath 新路径
     * @returns 重命名结果
     */
    renameDirectory(
      bucket: string,
      oldPath: string,
      newPath: string,
    ): {
      success: boolean;
      error?: string;
      moved_count?: number;
    } {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${bucket}` };
      }

      // 规范化路径
      let oldPrefix = normalizePath(oldPath);
      if (!oldPrefix.endsWith('/')) {
        oldPrefix += '/';
      }

      let newPrefix = normalizePath(newPath);
      if (!newPrefix.endsWith('/')) {
        newPrefix += '/';
      }

      // 获取目录下的所有对象
      const objects = (Array.from((this as any).objects.values()) as any[]).filter(
        (obj: any) => obj.bucket === bucket && obj.key.startsWith(oldPrefix),
      );

      if (objects.length === 0) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Directory not found: ${oldPrefix}`,
        };
      }

      // 移动所有对象
      let movedCount = 0;
      const now = new Date().toISOString();

      objects.forEach((obj: any) => {
        const relativeKey = obj.key.substring(oldPrefix.length);
        const newKey = newPrefix + relativeKey;

        // 创建新对象
        const newVersionId = `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newObjectKey = (this as any).generateObjectKey(bucket, newKey, newVersionId);

        const newObject = {
          ...obj,
          key: newKey,
          version_id: newVersionId,
          last_modified: now,
        };

        (this as any).objects.set(newObjectKey, newObject);

        // 删除旧对象
        const oldObjectKey = (this as any).generateObjectKey(bucket, obj.key, obj.version_id);
        (this as any).objects.delete(oldObjectKey);

        movedCount++;
      });

      (this as any).debugLog(`Directory renamed: ${bucket}/${oldPrefix} -> ${bucket}/${newPrefix}, moved ${movedCount} objects`);

      return {
        success: true,
        moved_count: movedCount,
      };
    }

    // ==================== 目录存在性检查 ====================

    /**
     * 检查目录是否存在
     * 
     * @param bucket 桶名
     * @param directoryPath 目录路径
     * @returns 是否存在
     */
    directoryExists(bucket: string, directoryPath: string): boolean {
      // 规范化路径
      let prefix = normalizePath(directoryPath);
      if (!prefix.endsWith('/')) {
        prefix += '/';
      }

      // 检查是否有对象以该前缀开头
      const objects = (Array.from((this as any).objects.values()) as any[]).filter(
        (obj: any) => obj.bucket === bucket && obj.key.startsWith(prefix) && obj.is_latest && !obj.is_delete_marker,
      );

      return objects.length > 0;
    }
  };
}
