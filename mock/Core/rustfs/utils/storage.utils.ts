/**
 * RustFS 存储工具函数
 * 
 * 包含存储统计、配额计算、缓存管理等工具函数
 */

import type {
  FileObject,
  Bucket,
  BucketStats,
  FileSizeDistribution,
  TotalStats,
  QuotaUsage,
  CacheEntry,
  CacheConfig,
  CacheStats,
  StorageClass,
} from '../types';

// ==================== 存储统计工具 ====================

/**
 * 计算桶统计信息
 * 
 * @param bucket 桶
 * @param objects 对象列表
 * @returns 桶统计信息
 */
export function calculateBucketStats(bucket: Bucket, objects: FileObject[]): BucketStats {
  const validObjects = objects.filter(obj => !obj.is_delete_marker);
  const totalSize = validObjects.reduce((sum, obj) => sum + obj.size, 0);
  const objectCount = validObjects.length;

  // 存储类分布
  const storageClassDistribution = {} as Record<StorageClass, { count: number; size: number }>;
  for (const obj of validObjects) {
    if (!storageClassDistribution[obj.storage_class]) {
      storageClassDistribution[obj.storage_class] = { count: 0, size: 0 };
    }
    storageClassDistribution[obj.storage_class].count++;
    storageClassDistribution[obj.storage_class].size += obj.size;
  }

  // MIME类型分布
  const contentTypeDistribution: Record<string, { count: number; size: number }> = {};
  for (const obj of validObjects) {
    if (!contentTypeDistribution[obj.content_type]) {
      contentTypeDistribution[obj.content_type] = { count: 0, size: 0 };
    }
    contentTypeDistribution[obj.content_type].count++;
    contentTypeDistribution[obj.content_type].size += obj.size;
  }

  // 文件大小分布
  const fileSizeDistribution = calculateFileSizeDistribution(validObjects);

  // 计算最大/最小/平均对象大小
  const sizes = validObjects.map(obj => obj.size);
  const maxObjectSize = sizes.length > 0 ? Math.max(...sizes) : 0;
  const minObjectSize = sizes.length > 0 ? Math.min(...sizes) : 0;
  const avgObjectSize = objectCount > 0 ? totalSize / objectCount : 0;

  // 版本数量
  const versionCount = objects.filter(obj => obj.version_id).length;
  const deleteMarkerCount = objects.filter(obj => obj.is_delete_marker).length;

  return {
    bucket: bucket.name,
    object_count: objectCount,
    total_size: totalSize,
    avg_object_size: avgObjectSize,
    max_object_size: maxObjectSize,
    min_object_size: minObjectSize,
    storage_class_distribution: storageClassDistribution,
    content_type_distribution: contentTypeDistribution,
    file_size_distribution: fileSizeDistribution,
    version_count: versionCount,
    delete_marker_count: deleteMarkerCount,
    last_modified: bucket.creation_date, // 简化处理
    creation_date: bucket.creation_date,
  };
}

/**
 * 计算文件大小分布
 * 
 * @param objects 对象列表
 * @returns 文件大小分布
 */
export function calculateFileSizeDistribution(objects: FileObject[]): FileSizeDistribution[] {
  const ranges = [
    { range: '0-1KB', min: 0, max: 1024 },
    { range: '1KB-10KB', min: 1024, max: 10 * 1024 },
    { range: '10KB-100KB', min: 10 * 1024, max: 100 * 1024 },
    { range: '100KB-1MB', min: 100 * 1024, max: 1024 * 1024 },
    { range: '1MB-10MB', min: 1024 * 1024, max: 10 * 1024 * 1024 },
    { range: '10MB-100MB', min: 10 * 1024 * 1024, max: 100 * 1024 * 1024 },
    { range: '100MB-1GB', min: 100 * 1024 * 1024, max: 1024 * 1024 * 1024 },
    { range: '1GB-10GB', min: 1024 * 1024 * 1024, max: 10 * 1024 * 1024 * 1024 },
    { range: '10GB+', min: 10 * 1024 * 1024 * 1024, max: Infinity },
  ];

  return ranges.map(({ range, min, max }) => {
    const filtered = objects.filter(obj => obj.size >= min && obj.size < max);
    return {
      range,
      min_size: min,
      max_size: max === Infinity ? Number.MAX_SAFE_INTEGER : max,
      count: filtered.length,
      total_size: filtered.reduce((sum, obj) => sum + obj.size, 0),
    };
  });
}

/**
 * 计算总统计信息
 * 
 * @param buckets 桶列表
 * @param allObjects 所有对象列表
 * @returns 总统计信息
 */
export function calculateTotalStats(buckets: Bucket[], allObjects: FileObject[]): TotalStats {
  const validObjects = allObjects.filter(obj => !obj.is_delete_marker);
  const totalSize = validObjects.reduce((sum, obj) => sum + obj.size, 0);
  const totalObjects = validObjects.length;

  // 存储类分布
  const storageClassDistribution = {} as Record<StorageClass, { count: number; size: number }>;
  for (const obj of validObjects) {
    if (!storageClassDistribution[obj.storage_class]) {
      storageClassDistribution[obj.storage_class] = { count: 0, size: 0 };
    }
    storageClassDistribution[obj.storage_class].count++;
    storageClassDistribution[obj.storage_class].size += obj.size;
  }

  // 区域分布
  const regionDistribution: Record<string, { bucket_count: number; object_count: number; size: number }> = {};
  for (const bucket of buckets) {
    if (!regionDistribution[bucket.region]) {
      regionDistribution[bucket.region] = { bucket_count: 0, object_count: 0, size: 0 };
    }
    regionDistribution[bucket.region].bucket_count++;
    const bucketObjects = validObjects.filter(obj => obj.bucket === bucket.name);
    regionDistribution[bucket.region].object_count += bucketObjects.length;
    regionDistribution[bucket.region].size += bucketObjects.reduce((sum, obj) => sum + obj.size, 0);
  }

  // 计算桶大小统计
  const bucketSizes = buckets.map(bucket => {
    const bucketObjects = validObjects.filter(obj => obj.bucket === bucket.name);
    return bucketObjects.reduce((sum, obj) => sum + obj.size, 0);
  });
  const maxBucketSize = bucketSizes.length > 0 ? Math.max(...bucketSizes) : 0;
  const minBucketSize = bucketSizes.length > 0 ? Math.min(...bucketSizes) : 0;
  const avgBucketSize = buckets.length > 0 ? totalSize / buckets.length : 0;

  return {
    bucket_count: buckets.length,
    total_objects: totalObjects,
    total_size: totalSize,
    avg_bucket_size: avgBucketSize,
    max_bucket_size: maxBucketSize,
    min_bucket_size: minBucketSize,
    storage_class_distribution: storageClassDistribution,
    region_distribution: regionDistribution,
  };
}

// ==================== 配额工具 ====================

/**
 * 计算配额使用情况
 * 
 * @param bucket 桶
 * @param objects 对象列表
 * @returns 配额使用情况
 */
export function calculateQuotaUsage(bucket: Bucket, objects: FileObject[]): QuotaUsage {
  const validObjects = objects.filter(obj => !obj.is_delete_marker);
  const currentSize = validObjects.reduce((sum, obj) => sum + obj.size, 0);
  const currentObjectCount = validObjects.length;

  const sizeLimit = bucket.quota?.size_limit || Number.MAX_SAFE_INTEGER;
  const objectCountLimit = bucket.quota?.object_count_limit;
  const alertThreshold = bucket.quota?.alert_threshold || 80;
  const quotaType = bucket.quota?.type || 'soft';

  const usagePercentage = sizeLimit > 0 ? (currentSize / sizeLimit) * 100 : 0;
  const remainingSize = Math.max(0, sizeLimit - currentSize);

  const objectCountUsagePercentage = objectCountLimit
    ? (currentObjectCount / objectCountLimit) * 100
    : undefined;

  // 计算告警状态
  let alertStatus: QuotaUsage['alert_status'] = 'normal';
  if (usagePercentage >= 100) {
    alertStatus = 'exceeded';
  } else if (usagePercentage >= 90) {
    alertStatus = 'critical';
  } else if (usagePercentage >= alertThreshold) {
    alertStatus = 'warning';
  }

  return {
    bucket: bucket.name,
    size_limit: sizeLimit,
    current_size: currentSize,
    usage_percentage: usagePercentage,
    remaining_size: remainingSize,
    object_count_limit: objectCountLimit,
    current_object_count: currentObjectCount,
    object_count_usage_percentage: objectCountUsagePercentage,
    type: quotaType,
    alert_status: alertStatus,
    alert_threshold: alertThreshold,
    last_checked: new Date().toISOString(),
  };
}

/**
 * 检查是否超过配额
 * 
 * @param quotaUsage 配额使用情况
 * @param additionalSize 额外大小
 * @returns 是否超过配额
 */
export function isOverQuota(quotaUsage: QuotaUsage, additionalSize: number = 0): boolean {
  if (quotaUsage.type === 'hard') {
    return quotaUsage.current_size + additionalSize > quotaUsage.size_limit;
  }
  return false; // 软配额不阻止写入
}

// ==================== 缓存工具 ====================

/**
 * 默认缓存配置
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  ttl: 60000, // 60秒
  max_entries: 1000,
  max_size: 100 * 1024 * 1024, // 100MB
  strategy: 'LRU',
  cache_type: 'memory',
};

/**
 * 创建缓存条目
 * 
 * @param key 键
 * @param value 值
 * @param ttl 过期时间（毫秒）
 * @returns 缓存条目
 */
export function createCacheEntry<T = any>(key: string, value: T, ttl: number = 60000): CacheEntry<T> {
  const now = Date.now();
  const size = estimateObjectSize(value);
  return {
    key,
    value,
    created_at: now,
    last_accessed_at: now,
    access_count: 0,
    expires_at: now + ttl,
    size,
  };
}

/**
 * 检查缓存条目是否过期
 * 
 * @param entry 缓存条目
 * @returns 是否过期
 */
export function isCacheEntryExpired(entry: CacheEntry): boolean {
  return Date.now() > entry.expires_at;
}

/**
 * 估算对象大小（字节）
 * 
 * @param obj 对象
 * @returns 估算大小
 */
export function estimateObjectSize(obj: any): number {
  if (obj === null || obj === undefined) {
    return 0;
  }
  if (typeof obj === 'string') {
    return obj.length * 2; // UTF-16
  }
  if (typeof obj === 'number') {
    return 8;
  }
  if (typeof obj === 'boolean') {
    return 4;
  }
  if (Buffer.isBuffer(obj)) {
    return obj.length;
  }
  try {
    return JSON.stringify(obj).length * 2;
  } catch {
    return 1024; // 默认1KB
  }
}

/**
 * 计算缓存统计
 * 
 * @param cache 缓存Map
 * @param config 缓存配置
 * @param hitCount 命中次数
 * @param missCount 未命中次数
 * @param evictionCount 驱逐次数
 * @returns 缓存统计
 */
export function calculateCacheStats(
  cache: Map<string, CacheEntry>,
  config: CacheConfig,
  hitCount: number,
  missCount: number,
  evictionCount: number,
): CacheStats {
  const entries = Array.from(cache.values());
  const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
  const totalRequests = hitCount + missCount;
  const hitRate = totalRequests > 0 ? (hitCount / totalRequests) * 100 : 0;
  const missRate = totalRequests > 0 ? (missCount / totalRequests) * 100 : 0;

  return {
    entry_count: cache.size,
    size: totalSize,
    hit_count: hitCount,
    miss_count: missCount,
    hit_rate: hitRate,
    miss_rate: missRate,
    eviction_count: evictionCount,
    max_entries: config.max_entries,
    max_size: config.max_size,
    config,
  };
}

/**
 * LRU缓存驱逐策略
 * 
 * @param cache 缓存Map
 * @param maxEntries 最大条目数
 * @param maxSize 最大大小
 * @returns 驱逐的键列表
 */
export function evictLRU(
  cache: Map<string, CacheEntry>,
  maxEntries: number,
  maxSize: number,
): string[] {
  const evictedKeys: string[] = [];

  // 先清除过期条目
  for (const [key, entry] of cache.entries()) {
    if (isCacheEntryExpired(entry)) {
      cache.delete(key);
      evictedKeys.push(key);
    }
  }

  // 如果仍然超过限制，按LRU驱逐
  while (cache.size > maxEntries || getCacheTotalSize(cache) > maxSize) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of cache.entries()) {
      if (entry.last_accessed_at < oldestTime) {
        oldestTime = entry.last_accessed_at;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      cache.delete(oldestKey);
      evictedKeys.push(oldestKey);
    } else {
      break;
    }
  }

  return evictedKeys;
}

/**
 * 获取缓存总大小
 * 
 * @param cache 缓存Map
 * @returns 总大小
 */
export function getCacheTotalSize(cache: Map<string, CacheEntry>): number {
  let total = 0;
  for (const entry of cache.values()) {
    total += entry.size;
  }
  return total;
}

// ==================== 目录工具 ====================

/**
 * 从对象列表中提取目录列表
 * 
 * @param objects 对象列表
 * @param prefix 前缀
 * @param delimiter 分隔符
 * @returns 目录列表
 */
export function extractDirectories(
  objects: FileObject[],
  prefix: string = '',
  delimiter: string = '/',
): string[] {
  const directories = new Set<string>();

  for (const obj of objects) {
    let key = obj.key;
    // 移除前缀
    if (prefix && key.startsWith(prefix)) {
      key = key.substring(prefix.length);
    }
    // 查找第一个分隔符
    const delimiterIndex = key.indexOf(delimiter);
    if (delimiterIndex !== -1) {
      const directory = key.substring(0, delimiterIndex + 1);
      directories.add(directory);
    }
  }

  return Array.from(directories).sort();
}

/**
 * 过滤指定前缀的对象
 * 
 * @param objects 对象列表
 * @param prefix 前缀
 * @returns 过滤后的对象列表
 */
export function filterObjectsByPrefix(objects: FileObject[], prefix: string): FileObject[] {
  if (!prefix) {
    return objects;
  }
  return objects.filter(obj => obj.key.startsWith(prefix));
}

/**
 * 过滤指定目录下的对象（不递归）
 * 
 * @param objects 对象列表
 * @param directory 目录
 * @param delimiter 分隔符
 * @returns 过滤后的对象列表
 */
export function filterObjectsInDirectory(
  objects: FileObject[],
  directory: string = '',
  delimiter: string = '/',
): FileObject[] {
  return objects.filter(obj => {
    let key = obj.key;
    if (directory && key.startsWith(directory)) {
      key = key.substring(directory.length);
    }
    // 不包含分隔符（即不在子目录中）
    return !key.includes(delimiter);
  });
}

/**
 * 计算目录大小
 * 
 * @param objects 对象列表
 * @param directory 目录
 * @returns 目录大小
 */
export function calculateDirectorySize(objects: FileObject[], directory: string): number {
  return filterObjectsByPrefix(objects, directory)
    .filter(obj => !obj.is_delete_marker)
    .reduce((sum, obj) => sum + obj.size, 0);
}

/**
 * 统计目录中的文件数量
 * 
 * @param objects 对象列表
 * @param directory 目录
 * @returns 文件数量
 */
export function countFilesInDirectory(objects: FileObject[], directory: string): number {
  return filterObjectsByPrefix(objects, directory)
    .filter(obj => !obj.is_delete_marker)
    .length;
}

// ==================== 版本工具 ====================

/**
 * 获取对象的所有版本
 * 
 * @param objects 对象列表
 * @param bucket 桶名
 * @param key 对象键
 * @returns 版本列表（按时间倒序）
 */
export function getObjectVersions(
  objects: FileObject[],
  bucket: string,
  key: string,
): FileObject[] {
  return objects
    .filter(obj => obj.bucket === bucket && obj.key === key)
    .sort((a, b) => new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime());
}

/**
 * 获取对象的最新版本
 * 
 * @param objects 对象列表
 * @param bucket 桶名
 * @param key 对象键
 * @returns 最新版本对象
 */
export function getLatestObjectVersion(
  objects: FileObject[],
  bucket: string,
  key: string,
): FileObject | null {
  const versions = getObjectVersions(objects, bucket, key);
  return versions.length > 0 ? versions[0] : null;
}

/**
 * 获取对象的特定版本
 * 
 * @param objects 对象列表
 * @param bucket 桶名
 * @param key 对象键
 * @param versionId 版本ID
 * @returns 特定版本对象
 */
export function getObjectVersionById(
  objects: FileObject[],
  bucket: string,
  key: string,
  versionId: string,
): FileObject | null {
  return objects.find(
    obj => obj.bucket === bucket && obj.key === key && obj.version_id === versionId,
  ) || null;
}

// ==================== 标签工具 ====================

/**
 * 按标签筛选对象
 * 
 * @param objects 对象列表
 * @param tagKey 标签键
 * @param tagValue 标签值（可选，不指定则匹配所有有该标签的对象）
 * @returns 筛选后的对象列表
 */
export function filterObjectsByTag(
  objects: FileObject[],
  tagKey: string,
  tagValue?: string,
): FileObject[] {
  return objects.filter(obj => {
    if (!obj.tags || !(tagKey in obj.tags)) {
      return false;
    }
    if (tagValue !== undefined && obj.tags[tagKey] !== tagValue) {
      return false;
    }
    return true;
  });
}

/**
 * 获取对象的标签数量
 * 
 * @param obj 对象
 * @returns 标签数量
 */
export function getObjectTagCount(obj: FileObject): number {
  return obj.tags ? Object.keys(obj.tags).length : 0;
}

/**
 * 合并标签
 * 
 * @param existingTags 现有标签
 * @param newTags 新标签
 * @param replace 是否替换
 * @returns 合并后的标签
 */
export function mergeTags(
  existingTags: Record<string, string>,
  newTags: Record<string, string>,
  replace: boolean = false,
): Record<string, string> {
  if (replace) {
    return { ...newTags };
  }
  return { ...existingTags, ...newTags };
}

// ==================== 复制/移动工具 ====================

/**
 * 复制对象元数据
 * 
 * @param source 源对象
 * @param destinationBucket 目标桶
 * @param destinationKey 目标键
 * @returns 新对象
 */
export function copyObjectMetadata(
  source: FileObject,
  destinationBucket: string,
  destinationKey: string,
): FileObject {
  return {
    ...source,
    bucket: destinationBucket,
    key: destinationKey,
    version_id: undefined, // 新版本
    is_latest: true,
    last_modified: new Date().toISOString(),
    etag: source.etag, // 内容相同，ETag相同
  };
}

/**
 * 生成复制操作的结果
 * 
 * @param sourceBucket 源桶
 * @param sourceKey 源键
 * @param destinationBucket 目标桶
 * @param destinationKey 目标键
 * @returns 复制结果
 */
export function generateCopyResult(
  sourceBucket: string,
  sourceKey: string,
  destinationBucket: string,
  destinationKey: string,
) {
  return {
    copy_source: `${sourceBucket}/${sourceKey}`,
    destination_bucket: destinationBucket,
    destination_key: destinationKey,
    copied_at: new Date().toISOString(),
  };
}
