/**
 * L3 高级功能层 - 分片上传 Mixin
 * 
 * 提供分片上传、断点续传、分片合并等功能
 */

import type { Constructor } from './mixin.types';
import type {
  FileObject,
  MultipartUpload,
  CreateMultipartUploadResult,
  UploadPartResult,
  CompleteMultipartUploadResult,
  AbortMultipartUploadResult,
  ListMultipartUploadsResult,
  ListPartsResult,
} from '../types';

import {
  getCurrentTime,
  normalizePath,
  calculateETag,
  calculateMultipartETag,
  getMimeType,
} from '../utils';

/**
 * 分片上传 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithMultipartUpload<T extends Constructor>(Base: T) {
  return class MultipartUploadMixin extends Base {
    // ==================== 创建分片上传 ====================

    /**
     * 创建分片上传任务
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param options 上传选项
     * @returns 创建结果
     */
    createMultipartUpload(
      bucket: string,
      key: string,
      options?: {
        content_type?: string;
        metadata?: Record<string, string>;
        tags?: Record<string, string>;
        storage_class?: string;
        acl?: string;
      },
    ): any {
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

      // 创建上传ID
      const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = getCurrentTime();

      // 创建分片上传任务
      const multipartUpload: any = {
        upload_id: uploadId,
        bucket,
        key: normalizedKey,
        initiated_at: now,
        status: 'in_progress',
        parts: [],
        content_type: options?.content_type || getMimeType(normalizedKey),
        metadata: options?.metadata || {},
        tags: options?.tags || {},
        storage_class: (options?.storage_class || 'STANDARD') as any,
        acl: (options?.acl || 'private') as any,
      };

      // 保存分片上传任务
      (this as any).multipartUploads.set(uploadId, multipartUpload);

      (this as any).debugLog(`Multipart upload created: ${bucket}/${normalizedKey}, uploadId: ${uploadId}`);

      return {
        success: true,
        upload_id: uploadId,
        bucket,
        key: normalizedKey,
        initiated_at: now,
      };
    }

    // ==================== 上传分片 ====================

    /**
     * 上传分片
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param uploadId 上传ID
     * @param partNumber 分片号
     * @param data 分片数据
     * @returns 上传结果
     */
    uploadPart(
      bucket: string,
      key: string,
      uploadId: string,
      partNumber: number,
      data: string | Buffer,
    ): any {
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

      // 获取分片上传任务
      const upload = (this as any).multipartUploads.get(uploadId);

      if (!upload || upload.status !== 'in_progress') {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Upload not found or not in progress: ${uploadId}`,
        };
      }

      // 计算分片大小和ETag
      const size = typeof data === 'string' ? (Buffer as any).byteLength(data, 'utf8') : data.length;
      const etag = calculateETag(data);
      const now = getCurrentTime();

      // 检查是否已存在相同分片号，如果存在则替换
      const existingPartIndex = upload.parts.findIndex((p: any) => p.part_number === partNumber);
      if (existingPartIndex !== -1) {
        upload.parts[existingPartIndex] = {
          part_number: partNumber,
          size,
          etag,
          data,
          uploaded_at: now,
        };
      } else {
        upload.parts.push({
          part_number: partNumber,
          size,
          etag,
          data,
          uploaded_at: now,
        });
      }

      // 按分片号排序
      upload.parts.sort((a: any, b: any) => a.part_number - b.part_number);

      // 更新分片上传任务
      (this as any).multipartUploads.set(uploadId, upload);

      (this as any).debugLog(`Part uploaded: ${bucket}/${normalizedKey}, uploadId: ${uploadId}, part: ${partNumber}, size: ${size}`);

      return {
        success: true,
        upload_id: uploadId,
        part_number: partNumber,
        etag,
        size,
      };
    }

    // ==================== 完成分片上传 ====================

    /**
     * 完成分片上传（合并所有分片）
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param uploadId 上传ID
     * @param parts 要合并的分片列表（可选，默认使用所有已上传的分片）
     * @returns 完成结果
     */
    completeMultipartUpload(
      bucket: string,
      key: string,
      uploadId: string,
      parts?: Array<{ part_number: number; etag: string }>,
    ): any {
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

      // 获取分片上传任务
      const upload = (this as any).multipartUploads.get(uploadId);

      if (!upload || upload.status !== 'in_progress') {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Upload not found or not in progress: ${uploadId}`,
        };
      }

      // 确定要合并的分片
      let partsToMerge = upload.parts;
      if (parts && parts.length > 0) {
        partsToMerge = parts.map((p: any) => {
          const uploadedPart = upload.parts.find((up: any) => up.part_number === p.part_number && up.etag === p.etag);
          if (!uploadedPart) {
            throw new Error(`Part not found: ${p.part_number}`);
          }
          return uploadedPart;
        });
      }

      // 检查分片是否连续
      partsToMerge.sort((a: any, b: any) => a.part_number - b.part_number);
      for (let i = 0; i < partsToMerge.length; i++) {
        if (partsToMerge[i].part_number !== i + 1) {
          (this as any).recordRequest(false);
          return {
            success: false,
            error: `Parts are not consecutive. Expected part ${i + 1}, got ${partsToMerge[i].part_number}`,
          };
        }
      }

      // 合并所有分片数据
      const dataBuffers = partsToMerge.map((p: any) =>
        typeof p.data === 'string' ? (Buffer as any).from(p.data, 'utf8') : p.data
      );
      const mergedData = (Buffer as any).concat(dataBuffers);
      const totalSize = mergedData.length;
      const etag = calculateMultipartETag(partsToMerge.map((p: any) => p.etag));

      // 创建版本ID
      const now = getCurrentTime();
      const versionId = `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
        data: mergedData.toString('utf8'),
        size: totalSize,
        content_type: upload.content_type,
        etag,
        last_modified: now,
        storage_class: upload.storage_class,
        acl: upload.acl,
        metadata: upload.metadata,
        tags: upload.tags,
      };

      (this as any).objects.set(objectKey, fileObject);

      // 更新桶统计
      (this as any).updateBucketStats(bucket, totalSize, 1);

      // 标记分片上传任务为已完成
      upload.status = 'completed';
      upload.completed_at = now;
      (this as any).multipartUploads.set(uploadId, upload);

      // 清除相关缓存
      const cacheKeysToDelete: string[] = [];
      for (const cacheKey of (this as any).queryCache.keys()) {
        if (cacheKey.includes(`bucket:${bucket}`) && cacheKey.includes(`key:${normalizedKey}`)) {
          cacheKeysToDelete.push(cacheKey);
        }
      }
      cacheKeysToDelete.forEach(cacheKey => (this as any).queryCache.delete(cacheKey));

      (this as any).debugLog(`Multipart upload completed: ${bucket}/${normalizedKey}, uploadId: ${uploadId}, parts: ${partsToMerge.length}, size: ${totalSize}`);

      return {
        success: true,
        upload_id: uploadId,
        bucket,
        key: normalizedKey,
        version_id: versionId,
        etag,
        size: totalSize,
        last_modified: now,
        parts_count: partsToMerge.length,
      };
    }

    // ==================== 中止分片上传 ====================

    /**
     * 中止分片上传
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param uploadId 上传ID
     * @returns 中止结果
     */
    abortMultipartUpload(
      bucket: string,
      key: string,
      uploadId: string,
    ): any {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Bucket not found: ${bucket}`,
        };
      }

      // 获取分片上传任务
      const upload = (this as any).multipartUploads.get(uploadId);

      if (!upload || upload.status !== 'in_progress') {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Upload not found or not in progress: ${uploadId}`,
        };
      }

      // 标记分片上传任务为已中止
      upload.status = 'aborted';
      upload.aborted_at = getCurrentTime();
      (this as any).multipartUploads.set(uploadId, upload);

      (this as any).debugLog(`Multipart upload aborted: ${bucket}/${key}, uploadId: ${uploadId}`);

      return {
        success: true,
        upload_id: uploadId,
        aborted_at: upload.aborted_at,
      };
    }

    // ==================== 列出分片上传任务 ====================

    /**
     * 列出进行中的分片上传任务
     * 
     * @param bucket 桶名
     * @param options 列出选项
     * @returns 分片上传任务列表
     */
    listMultipartUploads(
      bucket: string,
      options?: {
        prefix?: string;
        max_uploads?: number;
        key_marker?: string;
        upload_id_marker?: string;
      },
    ): any {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return {
          uploads: [],
          bucket,
          is_truncated: false,
        };
      }

      // 获取所有进行中的分片上传任务
      let uploads = Array.from((this as any).multipartUploads.values()).filter(
        (upload: any) => upload.bucket === bucket && upload.status === 'in_progress',
      );

      // 前缀筛选
      if (options?.prefix) {
        uploads = uploads.filter((upload: any) => upload.key.startsWith(options.prefix));
      }

      // 按初始化时间降序排序
      uploads.sort((a: any, b: any) =>
        new Date(b.initiated_at).getTime() - new Date(a.initiated_at).getTime()
      );

      // 限制数量
      const maxUploads = options?.max_uploads ?? 1000;
      const isTruncated = uploads.length > maxUploads;
      uploads = uploads.slice(0, maxUploads);

      return {
        uploads: uploads.map((upload: any) => ({
          upload_id: upload.upload_id,
          key: upload.key,
          initiated_at: upload.initiated_at,
          storage_class: upload.storage_class,
        })),
        bucket,
        prefix: options?.prefix,
        max_uploads: maxUploads,
        is_truncated: isTruncated,
      };
    }

    // ==================== 列出已上传分片 ====================

    /**
     * 列出已上传的分片
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param uploadId 上传ID
     * @param options 列出选项
     * @returns 已上传分片列表
     */
    listParts(
      bucket: string,
      key: string,
      uploadId: string,
      options?: {
        max_parts?: number;
        part_number_marker?: number;
      },
    ): any {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return {
          parts: [],
          bucket,
          key,
          upload_id: uploadId,
          is_truncated: false,
        };
      }

      // 获取分片上传任务
      const upload = (this as any).multipartUploads.get(uploadId);

      if (!upload) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Upload not found: ${uploadId}`,
          parts: [],
          bucket,
          key,
          upload_id: uploadId,
          is_truncated: false,
        } as any;
      }

      // 获取所有分片
      let parts = [...upload.parts];

      // 分片号标记筛选（分页）
      const partNumberMarker = options?.part_number_marker;
      if (partNumberMarker) {
        parts = parts.filter((p: any) => p.part_number > partNumberMarker);
      }

      // 限制数量
      const maxParts = options?.max_parts ?? 1000;
      const isTruncated = parts.length > maxParts;
      const nextPartNumberMarker = isTruncated ? parts[maxParts - 1]?.part_number : undefined;
      parts = parts.slice(0, maxParts);

      return {
        parts: parts.map((p: any) => ({
          part_number: p.part_number,
          size: p.size,
          etag: p.etag,
          uploaded_at: p.uploaded_at,
        })),
        bucket,
        key,
        upload_id: uploadId,
        initiator: upload.initiator,
        storage_class: upload.storage_class,
        part_number_marker: options?.part_number_marker,
        next_part_number_marker: nextPartNumberMarker,
        max_parts: maxParts,
        is_truncated: isTruncated,
      };
    }
  };
}
