/**
 * L1 基础层 - 文件下载 Mixin
 * 
 * 提供文件下载、流式下载、范围下载、预签名URL等功能
 */

import type { Constructor } from './mixin.types';
import type {
  FileObject,
  DownloadOptions,
} from '../types';

import {
  generateUUID,
  normalizePath,
} from '../utils';

/**
 * 文件下载 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithFileDownload<T extends Constructor>(Base: T) {
  return class FileDownloadMixin extends Base {
    // ==================== 文件下载 ====================

    /**
     * 下载文件
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param options 下载选项
     * @returns 下载结果
     */
    download(
      bucket: string,
      key: string,
      options: DownloadOptions = {},
    ): {
      success: boolean;
      data?: Buffer | string;
      metadata?: FileObject;
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

      // 获取对象
      let fileObject: FileObject | null = null;

      if (options.version_id) {
        // 获取特定版本
        const objectKey = (this as any).generateObjectKey(bucket, normalizedKey, options.version_id);
        fileObject = (this as any).objects.get(objectKey) || null;
      } else {
        // 获取最新版本
        const allVersions = (Array.from((this as any).objects.values()) as any[]).filter(
          (obj: any) => obj.bucket === bucket && obj.key === normalizedKey,
        );
        const latestVersion = allVersions.find((obj: any) => obj.is_latest);
        fileObject = latestVersion || allVersions[0] || null;
      }

      if (!fileObject) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Object not found: ${bucket}/${normalizedKey}`,
        };
      }

      // 检查是否为删除标记
      if (fileObject.is_delete_marker) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Object is deleted: ${bucket}/${normalizedKey}`,
        };
      }

      // 处理范围下载
      let data = fileObject.data || '';
      if (options.range_start !== undefined || options.range_end !== undefined) {
        data = this.extractRange(data, options.range_start, options.range_end);
      }

      // 记录下载统计
      const size = typeof data === 'string' ? (Buffer as any).byteLength(data, 'utf8') : (data as Buffer).length;
      (this as any).recordDownload(size);

      // 调用进度回调
      if (options.on_progress) {
        options.on_progress(size, size);
      }

      (this as any).debugLog(`File downloaded: ${bucket}/${normalizedKey}`, {
        size,
        versionId: fileObject.version_id,
        range: options.range_start !== undefined ? `${options.range_start}-${options.range_end}` : undefined,
      });

      return {
        success: true,
        data,
        metadata: fileObject,
      };
    }

    /**
     * 获取对象（S3兼容API）
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param options 下载选项
     * @returns 对象数据和元数据
     */
    getObject(
      bucket: string,
      key: string,
      options?: DownloadOptions,
    ): {
      success: boolean;
      body?: Buffer | string;
      contentType?: string;
      contentLength?: number;
      etag?: string;
      lastModified?: string;
      metadata?: Record<string, string>;
      error?: string;
    } {
      const result = this.download(bucket, key, options);
      if (!result.success) {
        return { success: false, error: result.error };
      }
      return {
        success: true,
        body: result.data,
        contentType: result.metadata?.content_type,
        contentLength: result.metadata?.size,
        etag: result.metadata?.etag,
        lastModified: result.metadata?.last_modified,
        metadata: result.metadata?.metadata,
      };
    }

    /**
     * 获取对象元数据（不下载内容，HEAD请求）
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @returns 对象元数据
     */
    headObject(
      bucket: string,
      key: string,
    ): {
      success: boolean;
      metadata?: FileObject;
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

      // 获取最新版本
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

      // 检查是否为删除标记
      if (fileObject.is_delete_marker) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Object is deleted: ${bucket}/${normalizedKey}`,
        };
      }

      return {
        success: true,
        metadata: fileObject,
      };
    }

    /**
     * 范围下载（Range请求）
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param start 起始位置
     * @param end 结束位置
     * @returns 范围数据
     */
    getObjectRange(
      bucket: string,
      key: string,
      start: number,
      end: number,
    ): {
      success: boolean;
      data?: Buffer | string;
      contentRange?: string;
      error?: string;
    } {
      const result = this.download(bucket, key, {
        range_start: start,
        range_end: end,
      });

      if (!result.success) {
        return { success: false, error: result.error };
      }

      const totalSize = result.metadata?.size || 0;
      const actualEnd = Math.min(end, totalSize - 1);

      return {
        success: true,
        data: result.data,
        contentRange: `bytes ${start}-${actualEnd}/${totalSize}`,
      };
    }

    /**
     * 流式下载
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param options 下载选项
     * @returns 可读流（模拟）
     */
    downloadStream(
      bucket: string,
      key: string,
      options?: DownloadOptions,
    ): NodeJS.ReadableStream | null {
      const result = this.download(bucket, key, options);
      if (!result.success || !result.data) {
        return null;
      }

      // 模拟可读流
      const data = result.data;
      let position = 0;
      const totalSize = typeof data === 'string' ? (Buffer as any).byteLength(data, 'utf8') : (data as Buffer).length;

      const stream = {
        on(event: string, callback: (...args: any[]) => void) {
          if (event === 'data') {
            // 模拟分块发送
            const chunkSize = 64 * 1024; // 64KB
            const sendChunk = () => {
              if (position < totalSize) {
                const end = Math.min(position + chunkSize, totalSize);
                const chunk = typeof data === 'string'
                  ? Buffer.from(data.substring(position, end), 'utf8')
                  : (data as Buffer).subarray(position, end);
                position = end;
                callback(chunk);
                if (options?.on_progress) {
                  options.on_progress(position, totalSize);
                }
                setImmediate(sendChunk);
              }
            };
            setImmediate(sendChunk);
          } else if (event === 'end') {
            // 模拟结束
            const checkEnd = () => {
              if (position >= totalSize) {
                callback();
              } else {
                setImmediate(checkEnd);
              }
            };
            setImmediate(checkEnd);
          }
          return stream;
        },
        pipe(dest: any) {
          return dest;
        },
      } as any;

      return stream;
    }

    /**
     * 获取下载URL（预签名下载URL）
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param expiresIn 过期时间（秒）
     * @returns 下载URL
     */
    getDownloadUrl(bucket: string, key: string, expiresIn: number = 3600): string {
      const normalizedKey = normalizePath(key);
      const timestamp = Date.now();
      const signature = generateUUID(); // 模拟签名
      return `https://${bucket}.rustfs.mock/${normalizedKey}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=mock-access-key/20240101/us-east-1/s3/aws4_request&X-Amz-Date=${new Date(timestamp).toISOString().replace(/[-:]/g, '').split('.')[0]}Z&X-Amz-Expires=${expiresIn}&X-Amz-SignedHeaders=host&X-Amz-Signature=${signature}`;
    }

    /**
     * 预签名GET请求
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param expiresIn 过期时间（秒）
     * @returns 预签名URL
     */
    presignGetObject(bucket: string, key: string, expiresIn: number = 3600): string {
      return this.getDownloadUrl(bucket, key, expiresIn);
    }

    // ==================== 内部工具方法 ====================

    /**
     * 提取数据范围
     * 
     * @param data 原始数据
     * @param start 起始位置
     * @param end 结束位置
     * @returns 范围数据
     */
    private extractRange(
      data: Buffer | string,
      start?: number,
      end?: number,
    ): Buffer | string {
      if (start === undefined && end === undefined) {
        return data;
      }

      const buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
      const actualStart = start || 0;
      const actualEnd = end !== undefined ? Math.min(end + 1, buffer.length) : buffer.length;

      return buffer.subarray(actualStart, actualEnd);
    }
  };
}
