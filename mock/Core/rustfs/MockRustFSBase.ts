/**
 * RustFS Mock 基类
 * 
 * 包含核心属性、构造函数和初始化方法
 * 所有功能Mixin都继承自此基类
 */

import type {
  RustFSConfig,
  Bucket,
  FileObject,
  MultipartUpload,
  CacheConfig,
  CacheEntry,
  CacheStats,
  StorageClass,
  ACLType,
} from './types';

import { DEFAULT_RUSTFS_CONFIG } from './types';

import {
  generateUUID,
  getCurrentTime,
  DEFAULT_CACHE_CONFIG,
} from './utils';

/**
 * RustFS Mock 基类
 */
export class MockRustFSBase {
  // ==================== 核心配置 ====================

  /** 配置 */
  protected config: Required<RustFSConfig>;

  // ==================== 数据存储 ====================

  /** 存储桶映射（桶名 -> 桶信息） */
  protected buckets: Map<string, Bucket>;

  /** 文件对象映射（键格式: bucket:key:versionId） */
  protected objects: Map<string, FileObject>;

  /** 分片上传会话映射（uploadId -> 分片上传会话） */
  protected multipartUploads: Map<string, MultipartUpload>;

  // ==================== 缓存 ====================

  /** 查询缓存 */
  protected queryCache: Map<string, CacheEntry>;

  /** 缓存命中次数 */
  protected cacheHitCount: number;

  /** 缓存未命中次数 */
  protected cacheMissCount: number;

  /** 缓存驱逐次数 */
  protected cacheEvictionCount: number;

  /** 缓存配置 */
  protected cacheConfig: CacheConfig;

  // ==================== 集群状态 ====================

  /** 集群名称 */
  protected clusterName: string;

  /** 集群UUID */
  protected clusterUUID: string;

  /** 集群状态版本 */
  protected clusterStateVersion: number;

  /** 节点映射（节点ID -> 节点信息） */
  protected nodes: Map<string, any>;

  // ==================== 统计 ====================

  /** 总上传次数 */
  protected totalUploads: number;

  /** 总下载次数 */
  protected totalDownloads: number;

  /** 总删除次数 */
  protected totalDeletes: number;

  /** 总上传字节数 */
  protected totalUploadedBytes: number;

  /** 总下载字节数 */
  protected totalDownloadedBytes: number;

  /** 总请求次数 */
  protected totalRequests: number;

  /** 成功请求次数 */
  protected successfulRequests: number;

  /** 失败请求次数 */
  protected failedRequests: number;

  // ==================== 其他 ====================

  /** 待处理任务列表 */
  protected pendingTasks: any[];

  /** 调试模式 */
  protected debug: boolean;

  // ==================== 构造函数 ====================

  /**
   * 构造函数
   * 
   * @param config 配置
   */
  constructor(config: RustFSConfig = {}) {
    // 合并配置
    this.config = { ...DEFAULT_RUSTFS_CONFIG, ...config } as Required<RustFSConfig>;

    // 初始化数据存储
    this.buckets = new Map();
    this.objects = new Map();
    this.multipartUploads = new Map();

    // 初始化缓存
    this.queryCache = new Map();
    this.cacheHitCount = 0;
    this.cacheMissCount = 0;
    this.cacheEvictionCount = 0;
    this.cacheConfig = {
      ...DEFAULT_CACHE_CONFIG,
      enabled: this.config.enable_cache,
      ttl: this.config.cache_ttl,
    };

    // 初始化集群状态
    this.clusterName = this.config.cluster_name;
    this.clusterUUID = generateUUID();
    this.clusterStateVersion = 1;
    this.nodes = new Map();

    // 初始化默认节点
    this.initDefaultNodes();

    // 初始化统计
    this.totalUploads = 0;
    this.totalDownloads = 0;
    this.totalDeletes = 0;
    this.totalUploadedBytes = 0;
    this.totalDownloadedBytes = 0;
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;

    // 初始化其他
    this.pendingTasks = [];
    this.debug = false;

    this.debugLog('RustFS Mock 初始化完成', {
      clusterName: this.clusterName,
      clusterUUID: this.clusterUUID,
      nodeCount: this.nodes.size,
    });
  }

  // ==================== 初始化方法 ====================

  /**
   * 初始化默认节点
   */
  protected initDefaultNodes(): void {
    const nodeCount = this.config.node_count || 1;
    for (let i = 0; i < nodeCount; i++) {
      const nodeId = generateUUID();
      const node = {
        id: nodeId,
        name: `node-${i + 1}`,
        transport_address: `127.0.0.1:${9300 + i}`,
        host: '127.0.0.1',
        ip: '127.0.0.1',
        version: '1.0.0',
        build_type: 'mock',
        build_hash: generateUUID(),
        build_date: getCurrentTime(),
        roles: ['master', 'data', 'ingest'],
        attributes: {},
        joined_at: getCurrentTime(),
      };
      this.nodes.set(nodeId, node);
    }
  }

  // ==================== 工具方法 ====================

  /**
   * 生成对象键（用于内部Map存储）
   * 
   * @param bucket 桶名
   * @param key 对象键
   * @param versionId 版本ID（可选）
   * @returns 内部键
   */
  protected generateObjectKey(bucket: string, key: string, versionId?: string): string {
    if (versionId) {
      return `${bucket}:${key}:${versionId}`;
    }
    return `${bucket}:${key}:latest`;
  }

  /**
   * 解析对象键
   * 
   * @param internalKey 内部键
   * @returns 解析结果
   */
  protected parseObjectKey(internalKey: string): { bucket: string; key: string; versionId: string } {
    const parts = internalKey.split(':');
    return {
      bucket: parts[0],
      key: parts.slice(1, -1).join(':'),
      versionId: parts[parts.length - 1],
    };
  }

  /**
   * 记录请求统计
   * 
   * @param success 是否成功
   */
  protected recordRequest(success: boolean): void {
    this.totalRequests++;
    if (success) {
      this.successfulRequests++;
    } else {
      this.failedRequests++;
    }
  }

  /**
   * 记录上传统计
   * 
   * @param size 大小（字节）
   */
  protected recordUpload(size: number): void {
    this.totalUploads++;
    this.totalUploadedBytes += size;
  }

  /**
   * 记录下载统计
   * 
   * @param size 大小（字节）
   */
  protected recordDownload(size: number): void {
    this.totalDownloads++;
    this.totalDownloadedBytes += size;
  }

  /**
   * 记录删除统计
   */
  protected recordDelete(): void {
    this.totalDeletes++;
  }

  /**
   * 调试日志
   * 
   * @param message 消息
   * @param data 数据
   */
  protected debugLog(message: string, data?: any): void {
    if (this.debug) {
      console.log(`[RustFS Mock] ${message}`, data || '');
    }
  }

  /**
   * 启用调试模式
   */
  public enableDebug(): void {
    this.debug = true;
  }

  /**
   * 禁用调试模式
   */
  public disableDebug(): void {
    this.debug = false;
  }

  /**
   * 获取配置
   * 
   * @returns 配置
   */
  public getConfig(): Required<RustFSConfig> {
    return this.config;
  }

  /**
   * 重置所有数据
   */
  public reset(): void {
    this.buckets.clear();
    this.objects.clear();
    this.multipartUploads.clear();
    this.queryCache.clear();
    this.cacheHitCount = 0;
    this.cacheMissCount = 0;
    this.cacheEvictionCount = 0;
    this.totalUploads = 0;
    this.totalDownloads = 0;
    this.totalDeletes = 0;
    this.totalUploadedBytes = 0;
    this.totalDownloadedBytes = 0;
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.pendingTasks = [];
    this.clusterStateVersion = 1;
    this.debugLog('RustFS Mock 已重置');
  }
}
