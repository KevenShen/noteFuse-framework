/**
 * L3 高级功能层 - 文件预览 Mixin
 * 
 * 提供图片缩略图、文档预览、视频截图、音频波形等预览功能
 */

import type { Constructor } from './mixin.types';
import type {
  GenerateThumbnailResult,
  DocumentPreviewResult,
  VideoScreenshotResult,
  AudioWaveformResult,
} from '../types';

import {
  normalizePath,
  isImage,
  isVideo,
  isAudio,
  isDocument,
  getFileName,
  getFileExtension,
} from '../utils';

/**
 * 文件预览 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithFilePreview<T extends Constructor>(Base: T) {
  return class FilePreviewMixin extends Base {
    // ==================== 图片缩略图 ====================

    /**
     * 生成图片缩略图
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param options 缩略图选项
     * @returns 缩略图结果
     */
    generateThumbnail(
      bucket: string,
      key: string,
      options?: {
        width?: number;
        height?: number;
        quality?: number;
        format?: 'jpeg' | 'png' | 'webp' | 'gif';
        mode?: 'cover' | 'contain' | 'fill';
        version_id?: string;
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

      // 获取对象
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

      // 检查是否为图片
      if (!isImage(normalizedKey) && !fileObject.content_type.startsWith('image/')) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Object is not an image: ${normalizedKey}`,
        };
      }

      // 生成缩略图参数
      const width = options?.width ?? 200;
      const height = options?.height ?? 200;
      const quality = options?.quality ?? 80;
      const format = options?.format ?? 'jpeg';
      const mode = options?.mode ?? 'cover';

      // 模拟生成缩略图（实际应用中会使用图像处理库）
      const thumbnailKey = `thumbnails/${normalizedKey}_${width}x${height}_q${quality}.${format}`;
      const thumbnailUrl = `/rustfs/thumbnails/${bucket}/${encodeURIComponent(thumbnailKey)}`;

      (this as any).debugLog(`Thumbnail generated: ${bucket}/${normalizedKey}, size: ${width}x${height}, format: ${format}`);

      return {
        success: true,
        thumbnail_key: thumbnailKey,
        thumbnail_url: thumbnailUrl,
        width,
        height,
        quality,
        format,
        mode,
        source_key: normalizedKey,
        source_bucket: bucket,
        generated_at: new Date().toISOString(),
      };
    }

    // ==================== 文档预览 ====================

    /**
     * 生成文档预览
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param options 文档预览选项
     * @returns 文档预览结果
     */
    generateDocumentPreview(
      bucket: string,
      key: string,
      options?: {
        pages?: number;
        format?: 'pdf' | 'html' | 'text' | 'images';
        dpi?: number;
        version_id?: string;
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

      // 获取对象
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

      // 检查是否为文档
      if (!isDocument(normalizedKey) && !fileObject.content_type.startsWith('application/')) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Object is not a document: ${normalizedKey}`,
        };
      }

      // 生成文档预览参数
      const pages = options?.pages ?? 10;
      const format = options?.format ?? 'html';
      const dpi = options?.dpi ?? 96;

      // 模拟生成文档预览
      const previewKey = `previews/${normalizedKey}_p${pages}_${format}.${format === 'images' ? 'zip' : format}`;
      const previewUrl = `/rustfs/previews/${bucket}/${encodeURIComponent(previewKey)}`;

      // 模拟提取文本内容
      const textContent = typeof fileObject.data === 'string'
        ? fileObject.data.substring(0, 1000)
        : '[Binary document content]';

      (this as any).debugLog(`Document preview generated: ${bucket}/${normalizedKey}, pages: ${pages}, format: ${format}`);

      return {
        success: true,
        preview_key: previewKey,
        preview_url: previewUrl,
        format,
        pages,
        dpi,
        source_key: normalizedKey,
        source_bucket: bucket,
        file_name: getFileName(normalizedKey),
        file_extension: getFileExtension(normalizedKey),
        file_size: fileObject.size,
        text_content: format === 'text' ? textContent : undefined,
        generated_at: new Date().toISOString(),
      };
    }

    // ==================== 视频截图 ====================

    /**
     * 生成视频截图
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param options 视频截图选项
     * @returns 视频截图结果
     */
    generateVideoScreenshot(
      bucket: string,
      key: string,
      options?: {
        time?: number; // 秒
        width?: number;
        height?: number;
        quality?: number;
        format?: 'jpeg' | 'png' | 'webp';
        version_id?: string;
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

      // 获取对象
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

      // 检查是否为视频
      if (!isVideo(normalizedKey) && !fileObject.content_type.startsWith('video/')) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Object is not a video: ${normalizedKey}`,
        };
      }

      // 生成视频截图参数
      const time = options?.time ?? 1;
      const width = options?.width ?? 640;
      const height = options?.height ?? 360;
      const quality = options?.quality ?? 80;
      const format = options?.format ?? 'jpeg';

      // 模拟生成视频截图
      const screenshotKey = `screenshots/${normalizedKey}_t${time}s_${width}x${height}.${format}`;
      const screenshotUrl = `/rustfs/screenshots/${bucket}/${encodeURIComponent(screenshotKey)}`;

      (this as any).debugLog(`Video screenshot generated: ${bucket}/${normalizedKey}, time: ${time}s, size: ${width}x${height}`);

      return {
        success: true,
        screenshot_key: screenshotKey,
        screenshot_url: screenshotUrl,
        time,
        width,
        height,
        quality,
        format,
        source_key: normalizedKey,
        source_bucket: bucket,
        generated_at: new Date().toISOString(),
      };
    }

    // ==================== 音频波形 ====================

    /**
     * 生成音频波形图
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param options 音频波形选项
     * @returns 音频波形结果
     */
    generateAudioWaveform(
      bucket: string,
      key: string,
      options?: {
        width?: number;
        height?: number;
        color?: string;
        background_color?: string;
        format?: 'png' | 'svg' | 'json';
        samples?: number;
        version_id?: string;
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

      // 获取对象
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

      // 检查是否为音频
      if (!isAudio(normalizedKey) && !fileObject.content_type.startsWith('audio/')) {
        (this as any).recordRequest(false);
        return {
          success: false,
          error: `Object is not an audio: ${normalizedKey}`,
        };
      }

      // 生成音频波形参数
      const width = options?.width ?? 800;
      const height = options?.height ?? 200;
      const color = options?.color ?? '#4a90d9';
      const backgroundColor = options?.background_color ?? '#ffffff';
      const format = options?.format ?? 'png';
      const samples = options?.samples ?? 100;

      // 模拟生成波形数据
      const waveformData = Array.from({ length: samples }, () => Math.random());

      // 模拟生成音频波形图
      const waveformKey = `waveforms/${normalizedKey}_${width}x${height}_s${samples}.${format}`;
      const waveformUrl = `/rustfs/waveforms/${bucket}/${encodeURIComponent(waveformKey)}`;

      (this as any).debugLog(`Audio waveform generated: ${bucket}/${normalizedKey}, samples: ${samples}, size: ${width}x${height}`);

      return {
        success: true,
        waveform_key: waveformKey,
        waveform_url: waveformUrl,
        width,
        height,
        color,
        background_color: backgroundColor,
        format,
        samples,
        waveform_data: format === 'json' ? waveformData : undefined,
        source_key: normalizedKey,
        source_bucket: bucket,
        generated_at: new Date().toISOString(),
      };
    }

    // ==================== 通用预览 ====================

    /**
     * 根据文件类型自动生成预览
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param options 预览选项
     * @returns 预览结果
     */
    generatePreview(
      bucket: string,
      key: string,
      options?: {
        type?: 'auto' | 'image' | 'document' | 'video' | 'audio';
        [key: string]: any;
      },
    ): {
      success: boolean;
      error?: string;
      preview_type?: string;
      preview_url?: string;
      [key: string]: any;
    } {
      const normalizedKey = normalizePath(key);
      const previewType = options?.type ?? 'auto';

      // 自动检测文件类型
      let detectedType = previewType;
      if (previewType === 'auto') {
        if (isImage(normalizedKey)) {
          detectedType = 'image';
        } else if (isVideo(normalizedKey)) {
          detectedType = 'video';
        } else if (isAudio(normalizedKey)) {
          detectedType = 'audio';
        } else if (isDocument(normalizedKey)) {
          detectedType = 'document';
        } else {
          return {
            success: false,
            error: `Unsupported file type for preview: ${normalizedKey}`,
          };
        }
      }

      // 根据类型生成预览
      switch (detectedType) {
        case 'image':
          return {
            ...this.generateThumbnail(bucket, key, options as any),
            preview_type: 'image',
          };
        case 'document':
          return {
            ...this.generateDocumentPreview(bucket, key, options as any),
            preview_type: 'document',
          };
        case 'video':
          return {
            ...this.generateVideoScreenshot(bucket, key, options as any),
            preview_type: 'video',
          };
        case 'audio':
          return {
            ...this.generateAudioWaveform(bucket, key, options as any),
            preview_type: 'audio',
          };
        default:
          return {
            success: false,
            error: `Unsupported preview type: ${detectedType}`,
          };
      }
    }
  };
}
