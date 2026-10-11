/**
 * L1 基础层 - 文件上传 Mixin
 * 
 * 提供文件上传、流式上传、上传进度等功能
 */

import type { Constructor } from './mixin.types';
import type {
  FileObject,
  UploadOptions,
  StorageClass,
  ACLType,
} from '../types';

import {
  generateUUID,
  getCurrentTime,
  getMimeType,
  calculateETag,
  isValidObjectKey,
  normalizePath,
} from '../utils';

/**
 * 文件上传 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithFileUpload<T extends Constructor>(Base: T) {
  return class FileUploadMixin extends Base {
    // ==================== 文件上传 ====================

    /**
     * 上传文件
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param data 文件数据
     * @param options 上传选项
     * @returns 上传结果
     */
    upload(
      bucket: string,
      key: string,
      data: Buffer | string,
      options: UploadOptions = {},
    ): {
      success: boolean;
      object?: FileObject;
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

      // 验证对象键
      const normalizedKey = normalizePath(key);
      if (!isValidObjectKey(normalizedKey)) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Invalid object key: ${key}`,
        };
      }

      // 检查配额
      const bucketInfo = (this as any).getBucket(bucket);
      if (bucketInfo?.quota) {
        const size = typeof data === 'string' ? (Buffer as any).byteLength(data, 'utf8') : data.length;
        if (bucketInfo.total_size + size > bucketInfo.quota.size_limit && bucketInfo.quota.type === 'hard') {
          (this as any).recordRequest(false);
          return {
            success: false,
            error: `Quota exceeded. Bucket: ${bucket}, Current: ${bucketInfo.total_size}, Adding: ${size}, Limit: ${bucketInfo.quota.size_limit}`,
          };
        }
      }

      // 计算文件大小和ETag
      const size = typeof data === 'string' ? (Buffer as any).byteLength(data, 'utf8') : data.length;
      const etag = calculateETag(data);

      // 获取桶配置
      const config = (this as any).config;

      // 创建文件对象
      const versionId = bucketInfo?.versioning ? generateUUID() : undefined;
      const fileObject: FileObject = {
        key: normalizedKey,
        bucket,
        version_id: versionId,
        size,
        content_type: options.content_type || getMimeType(normalizedKey),
        etag,
        last_modified: getCurrentTime(),
        storage_class: options.storage_class || bucketInfo?.storage_class || config.default_storage_class,
        acl: options.acl || bucketInfo?.acl || config.default_acl,
        tags: options.tags || {},
        metadata: options.metadata || {},
        is_latest: true,
        data,
        owner: bucketInfo?.owner,
      };

      // 如果启用了版本控制，需要将旧版本标记为非最新
      if (bucketInfo?.versioning) {
        const oldVersions = (Array.from((this as any).objects.values()) as any[]).filter(
          (obj: any) => obj.bucket === bucket && obj.key === normalizedKey && obj.is_latest,
        );
        oldVersions.forEach((obj: any) => {
          obj.is_latest = false;
        });
      } else {
        // 如果没有启用版本控制，删除旧版本
        const oldKey = (this as any).generateObjectKey(bucket, normalizedKey);
        if ((this as any).objects.has(oldKey)) {
          (this as any).objects.delete(oldKey);
        }
      }

      // 存储文件对象
      const objectKey = (this as any).generateObjectKey(bucket, normalizedKey, versionId);
      (this as any).objects.set(objectKey, fileObject);

      // 更新桶统计
      (this as any).updateBucketStats(bucket, size, 1);

      // 记录上传统计
      (this as any).recordUpload(size);

      // 清除相关缓存
      const cacheKeysToDelete: string[] = [];
      for (const cacheKey of (this as any).queryCache.keys()) {
        if (cacheKey.includes(`bucket:${bucket}`) && cacheKey.includes(`key:${normalizedKey}`)) {
          cacheKeysToDelete.push(cacheKey);
        }
      }
      cacheKeysToDelete.forEach(cacheKey => (this as any).queryCache.delete(cacheKey));

      // 调用进度回调
      if (options.on_progress) {
        options.on_progress(size, size);
      }

      (this as any).debugLog(`File uploaded: ${bucket}/${normalizedKey}`, {
        size,
        etag,
        versionId,
      });

      return {
        success: true,
        object: fileObject,
      };
    }

    /**
     * 写入对象（S3兼容API）
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param data 文件数据
     * @param options 上传选项
     * @returns 上传结果
     */
    putObject(
      bucket: string,
      key: string,
      data: Buffer | string,
      options?: UploadOptions,
    ): {
      success: boolean;
      etag?: string;
      versionId?: string;
      error?: string;
    } {
      const result = this.upload(bucket, key, data, options);
      if (!result.success) {
        return { success: false, error: result.error };
      }
      return {
        success: true,
        etag: result.object?.etag,
        versionId: result.object?.version_id,
      };
    }

    /**
     * 流式上传
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param stream 数据流（模拟）
     * @param options 上传选项
     * @returns 上传结果
     */
    uploadStream(
      bucket: string,
      key: string,
      stream: NodeJS.ReadableStream | any,
      options: UploadOptions = {},
    ): Promise<{
      success: boolean;
      object?: FileObject;
      error?: string;
    }> {
      return new Promise((resolve, reject) => {
        // 模拟流式上传，收集所有数据
        const chunks: Buffer[] = [];
        let totalSize = 0;

        if (stream.on) {
          stream.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
            totalSize += chunk.length;
            if (options.on_progress) {
              options.on_progress(totalSize, totalSize); // 模拟总大小等于已上传大小
            }
          });

          stream.on('end', () => {
            const data = (Buffer as any).concat(chunks);
            const result = this.upload(bucket, key, data, options);
            resolve(result);
          });

          stream.on('error', (error: Error) => {
            (this as any).recordRequest(false);
            reject({
              success: false,
              error: error.message,
            });
          });
        } else {
          // 如果不是流，直接作为数据处理
          const result = this.upload(bucket, key, stream, options);
          resolve(result);
        }
      });
    }

    /**
     * 带进度的上传
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param data 文件数据
     * @param onProgress 进度回调
     * @returns 上传结果
     */
    uploadWithProgress(
      bucket: string,
      key: string,
      data: Buffer | string,
      onProgress?: (uploaded: number, total: number) => void,
    ): {
      success: boolean;
      object?: FileObject;
      error?: string;
    } {
      return this.upload(bucket, key, data, { on_progress: onProgress });
    }

    /**
     * 追加写入对象
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param data 要追加的数据
     * @param position 追加位置（可选，默认追加到末尾）
     * @returns 追加结果
     */
    appendObject(
      bucket: string,
      key: string,
      data: Buffer | string,
      position?: number,
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

      // 获取现有对象
      const existingObject = (this as any).getObject(bucket, normalizedKey);
      let combinedData: Buffer | string;

      if (existingObject && existingObject.data) {
        const existingData = existingObject.data;
        const appendData = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
        const existingBuffer = typeof existingData === 'string' ? Buffer.from(existingData, 'utf8') : existingData;

        if (position !== undefined && position >= 0 && position <= existingBuffer.length) {
          // 在指定位置插入
          const before = existingBuffer.slice(0, position);
          const after = existingBuffer.slice(position);
          combinedData = (Buffer as any).concat([before, appendData, after]);
        } else {
          // 追加到末尾
          combinedData = (Buffer as any).concat([existingBuffer, appendData]);
        }
      } else {
        // 对象不存在，创建新对象
        combinedData = data;
      }

      // 重新上传
      return this.upload(bucket, normalizedKey, combinedData);
    }

    /**
     * 复制对象（从源对象复制到目标对象）
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
      options: UploadOptions = {},
    ): {
      success: boolean;
      object?: FileObject;
      error?: string;
    } {
      (this as any).recordRequest(true);

      // 获取源对象
      const sourceObject = (this as any).getObject(sourceBucket, sourceKey);
      if (!sourceObject) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Source object not found: ${sourceBucket}/${sourceKey}`,
        };
      }

      // 复制数据
      const data = sourceObject.data || '';

      // 合并元数据
      const mergedOptions: UploadOptions = {
        ...options,
        metadata: options.metadata_directive === 'REPLACE'
          ? options.metadata
          : { ...sourceObject.metadata, ...options.metadata },
        tags: options.tagging_directive === 'REPLACE'
          ? options.tags
          : { ...sourceObject.tags, ...options.tags },
        storage_class: options.storage_class || sourceObject.storage_class,
        acl: options.acl || sourceObject.acl,
        content_type: options.content_type || sourceObject.content_type,
      };

      // 上传到目标
      const result = this.upload(destBucket, destKey, data, mergedOptions);

      if (result.success) {
        (this as any).debugLog(`Object copied: ${sourceBucket}/${sourceKey} -> ${destBucket}/${destKey}`);
      }

      return result;
    }

    /**
     * 获取上传URL（预签名上传URL）
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param expiresIn 过期时间（秒）
     * @returns 上传URL
     */
    getUploadUrl(bucket: string, key: string, expiresIn: number = 3600): string {
      const normalizedKey = normalizePath(key);
      const timestamp = Date.now();
      const expires = timestamp + expiresIn * 1000;
      const signature = generateUUID(); // 模拟签名
      return `https://${bucket}.rustfs.mock/${normalizedKey}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=mock-access-key/20240101/us-east-1/s3/aws4_request&X-Amz-Date=${new Date(timestamp).toISOString().replace(/[-:]/g, '').split('.')[0]}Z&X-Amz-Expires=${expiresIn}&X-Amz-SignedHeaders=host&X-Amz-Signature=${signature}`;
    }
  };
}
