/**
 * RustFS 使用示例
 * 
 * 展示如何使用 RustFS 分布式对象存储模拟模块的各种功能
 */

import { MockRustFS, rustfs } from './index';

// 使用类型断言绕过Mixin组合模式的TypeScript类型推断限制
const fs = rustfs as any;
const MockRustFSClass = MockRustFS as any;

// ==================== 示例1：基本使用 ====================

export function exampleBasicUsage() {
  console.log('=== 示例1：基本使用 ===\n');

  // 创建存储桶
  const createResult = fs.createBucket('my-bucket', {
    acl: 'private',
    region: 'us-east-1',
  });
  console.log('创建存储桶:', createResult);

  // 列出所有存储桶
  const buckets = fs.listBuckets();
  console.log('存储桶列表:', buckets);

  // 上传对象
  const uploadResult = fs.upload('my-bucket', 'hello.txt', 'Hello, RustFS!', {
    content_type: 'text/plain',
    acl: 'private',
  });
  console.log('上传对象:', uploadResult);

  // 下载对象
  const downloadResult = fs.download('my-bucket', 'hello.txt');
  console.log('下载对象:', downloadResult);

  // 获取对象元数据
  const metadata = fs.getObjectMetadata('my-bucket', 'hello.txt');
  console.log('对象元数据:', metadata);

  // 列出对象
  const objects = fs.listObjects('my-bucket');
  console.log('对象列表:', objects);

  // 删除对象
  const deleteResult = fs.deleteObject('my-bucket', 'hello.txt');
  console.log('删除对象:', deleteResult);

  console.log('\n');
}

// ==================== 示例2：目录操作 ====================

export function exampleDirectoryOperations() {
  console.log('=== 示例2：目录操作 ===\n');

  // 创建目录
  const createDirResult = fs.createDirectory('my-bucket', 'documents/reports/2024');
  console.log('创建目录:', createDirResult);

  // 列出目录
  const listDirResult = fs.listDirectory('my-bucket', 'documents/');
  console.log('列出目录:', listDirResult);

  // 获取目录信息
  const dirInfo = fs.getDirectoryInfo('my-bucket', 'documents/reports/');
  console.log('目录信息:', dirInfo);

  // 重命名目录
  const renameDirResult = fs.renameDirectory('my-bucket', 'documents/reports/', 'documents/annual-reports/');
  console.log('重命名目录:', renameDirResult);

  // 删除目录
  const deleteDirResult = fs.deleteDirectory('my-bucket', 'documents/annual-reports/');
  console.log('删除目录:', deleteDirResult);

  console.log('\n');
}

// ==================== 示例3：批量操作 ====================

export function exampleBulkOperations() {
  console.log('=== 示例3：批量操作 ===\n');

  // 批量上传
  const bulkUploadResult = fs.bulkUpload('my-bucket', [
    { key: 'file1.txt', content: 'Content 1' },
    { key: 'file2.txt', content: 'Content 2' },
    { key: 'file3.txt', content: 'Content 3' },
  ]);
  console.log('批量上传:', bulkUploadResult);

  // 批量下载
  const bulkDownloadResult = fs.bulkDownload('my-bucket', ['file1.txt', 'file2.txt']);
  console.log('批量下载:', bulkDownloadResult);

  // 批量复制
  const bulkCopyResult = fs.bulkCopy('my-bucket', ['file1.txt', 'file2.txt'], 'my-bucket', 'backup/');
  console.log('批量复制:', bulkCopyResult);

  // 批量删除
  const bulkDeleteResult = fs.bulkDelete('my-bucket', ['file1.txt', 'file2.txt', 'file3.txt']);
  console.log('批量删除:', bulkDeleteResult);

  console.log('\n');
}

// ==================== 示例4：版本管理 ====================

export function exampleVersioning() {
  console.log('=== 示例4：版本管理 ===\n');

  // 启用版本控制
  const enableVersioningResult = fs.enableBucketVersioning('my-bucket');
  console.log('启用版本控制:', enableVersioningResult);

  // 上传多个版本
  fs.upload('my-bucket', 'versioned.txt', 'Version 1');
  fs.upload('my-bucket', 'versioned.txt', 'Version 2');
  fs.upload('my-bucket', 'versioned.txt', 'Version 3');

  // 列出对象版本
  const versions = fs.listObjectVersions('my-bucket', 'versioned.txt');
  console.log('对象版本列表:', versions);

  // 获取特定版本
  if (versions.versions && versions.versions.length > 0) {
    const versionId = versions.versions[0].version_id;
    const version = fs.getObjectVersion('my-bucket', 'versioned.txt', versionId);
    console.log('特定版本:', version);

    // 恢复到特定版本
    const restoreResult = fs.restoreObjectVersion('my-bucket', 'versioned.txt', versionId);
    console.log('恢复版本:', restoreResult);
  }

  console.log('\n');
}

// ==================== 示例5：分片上传 ====================

export function exampleMultipartUpload() {
  console.log('=== 示例5：分片上传 ===\n');

  // 创建分片上传
  const createUploadResult = fs.createMultipartUpload('my-bucket', 'large-file.zip', {
    content_type: 'application/zip',
  });
  console.log('创建分片上传:', createUploadResult);

  if (createUploadResult.success && createUploadResult.upload_id) {
    const uploadId = createUploadResult.upload_id;

    // 上传分片
    const part1 = fs.uploadPart('my-bucket', 'large-file.zip', uploadId, 1, 'Part 1 content');
    const part2 = fs.uploadPart('my-bucket', 'large-file.zip', uploadId, 2, 'Part 2 content');
    const part3 = fs.uploadPart('my-bucket', 'large-file.zip', uploadId, 3, 'Part 3 content');
    console.log('上传分片:', { part1, part2, part3 });

    // 列出已上传的分片
    const parts = fs.listParts('my-bucket', 'large-file.zip', uploadId);
    console.log('分片列表:', parts);

    // 完成分片上传
    const completeResult = fs.completeMultipartUpload('my-bucket', 'large-file.zip', uploadId, [
      { part_number: 1, etag: part1.etag },
      { part_number: 2, etag: part2.etag },
      { part_number: 3, etag: part3.etag },
    ]);
    console.log('完成分片上传:', completeResult);
  }

  console.log('\n');
}

// ==================== 示例6：权限管理 ====================

export function examplePermissionManagement() {
  console.log('=== 示例6：权限管理 ===\n');

  // 设置对象ACL
  const setACLResult = fs.setObjectACL('my-bucket', 'hello.txt', 'public-read');
  console.log('设置对象ACL:', setACLResult);

  // 获取对象ACL
  const getACLResult = fs.getObjectACL('my-bucket', 'hello.txt');
  console.log('获取对象ACL:', getACLResult);

  // 设置桶策略
  const setPolicyResult = fs.setBucketPolicy('my-bucket', {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: '*',
        Action: ['s3:GetObject'],
        Resource: ['arn:aws:s3:::my-bucket/*'],
      },
    ],
  });
  console.log('设置桶策略:', setPolicyResult);

  // 获取桶策略
  const getPolicyResult = fs.getBucketPolicy('my-bucket');
  console.log('获取桶策略:', getPolicyResult);

  // 生成预签名URL
  const presignedUrl = fs.generatePresignedDownloadUrl('my-bucket', 'hello.txt', {
    expires_in: 3600,
  });
  console.log('预签名URL:', presignedUrl);

  console.log('\n');
}

// ==================== 示例7：标签管理 ====================

export function exampleTagging() {
  console.log('=== 示例7：标签管理 ===\n');

  // 设置对象标签
  const setTagsResult = fs.putObjectTagging('my-bucket', 'hello.txt', {
    department: 'engineering',
    project: 'rustfs',
    priority: 'high',
  });
  console.log('设置对象标签:', setTagsResult);

  // 获取对象标签
  const getTagsResult = fs.getObjectTagging('my-bucket', 'hello.txt');
  console.log('获取对象标签:', getTagsResult);

  // 根据标签筛选对象
  const filteredObjects = fs.listObjectsByTags('my-bucket', [
    { key: 'department', value: 'engineering' },
    { key: 'priority', value: 'high' },
  ]);
  console.log('按标签筛选对象:', filteredObjects);

  // 删除对象标签
  const deleteTagsResult = fs.deleteObjectTagging('my-bucket', 'hello.txt');
  console.log('删除对象标签:', deleteTagsResult);

  console.log('\n');
}

// ==================== 示例8：生命周期管理 ====================

export function exampleLifecycle() {
  console.log('=== 示例8：生命周期管理 ===\n');

  // 设置生命周期配置
  const setLifecycleResult = fs.putBucketLifecycle('my-bucket', {
    rules: [
      {
        id: 'archive-old-files',
        status: 'Enabled',
        filter: { prefix: 'logs/' },
        transitions: [
          { days: 30, storage_class: 'STANDARD_IA' },
          { days: 90, storage_class: 'ARCHIVE' },
        ],
        expiration: { days: 365 },
      },
    ],
  });
  console.log('设置生命周期配置:', setLifecycleResult);

  // 获取生命周期配置
  const getLifecycleResult = fs.getBucketLifecycle('my-bucket');
  console.log('获取生命周期配置:', getLifecycleResult);

  // 执行生命周期规则
  const executeResult = fs.executeLifecycleRules('my-bucket', {
    dry_run: true,
  });
  console.log('执行生命周期规则（dry run）:', executeResult);

  console.log('\n');
}

// ==================== 示例9：存储统计 ====================

export function exampleStorageStats() {
  console.log('=== 示例9：存储统计 ===\n');

  // 获取全局存储统计
  const totalStats = fs.getTotalStats();
  console.log('全局存储统计:', totalStats);

  // 获取桶存储统计
  const bucketStats = fs.getBucketStats('my-bucket');
  console.log('桶存储统计:', bucketStats);

  // 获取文件大小分布
  const sizeDistribution = fs.getFileSizeDistribution('my-bucket');
  console.log('文件大小分布:', sizeDistribution);

  // 获取存储类统计
  const storageClassStats = fs.getStorageClassStats('my-bucket');
  console.log('存储类统计:', storageClassStats);

  // 获取存储使用趋势
  const usageTrend = fs.getStorageUsageTrend('my-bucket', 7);
  console.log('存储使用趋势:', usageTrend);

  console.log('\n');
}

// ==================== 示例10：配额管理 ====================

export function exampleQuotaManagement() {
  console.log('=== 示例10：配额管理 ===\n');

  // 设置桶配额
  const setQuotaResult = fs.setBucketQuota('my-bucket', {
    storage_limit: 1024 * 1024 * 1024, // 1GB
    object_count_limit: 10000,
  });
  console.log('设置桶配额:', setQuotaResult);

  // 获取桶配额
  const getQuotaResult = fs.getBucketQuota('my-bucket');
  console.log('获取桶配额:', getQuotaResult);

  // 获取桶配额使用情况
  const quotaUsage = fs.getBucketQuotaUsage('my-bucket');
  console.log('桶配额使用情况:', quotaUsage);

  // 检查上传配额
  const uploadCheck = fs.checkUploadQuota('my-bucket', 1024);
  console.log('检查上传配额:', uploadCheck);

  console.log('\n');
}

// ==================== 示例11：集群管理 ====================

export function exampleClusterManagement() {
  console.log('=== 示例11：集群管理 ===\n');

  // 获取集群健康状态
  const clusterHealth = fs.getClusterHealth();
  console.log('集群健康状态:', clusterHealth);

  // 获取集群状态
  const clusterState = fs.getClusterState();
  console.log('集群状态:', clusterState);

  // 获取集群统计
  const clusterStats = fs.getClusterStats();
  console.log('集群统计:', clusterStats);

  // 获取节点信息
  const nodesInfo = fs.getNodesInfo();
  console.log('节点信息:', nodesInfo);

  // 获取性能指标
  const performanceMetrics = fs.getPerformanceMetrics();
  console.log('性能指标:', performanceMetrics);

  // 获取系统信息
  const systemInfo = fs.getSystemInfo();
  console.log('系统信息:', systemInfo);

  console.log('\n');
}

// ==================== 示例12：创建独立实例 ====================

export function exampleCreateInstance() {
  console.log('=== 示例12：创建独立实例 ===\n');

  // 创建独立的RustFS实例
  const myRustFS = new MockRustFSClass({
    cluster_name: 'my-custom-cluster',
    default_region: 'ap-southeast-1',
    default_storage_class: 'STANDARD',
    default_acl: 'private',
    enable_cache: true,
    cache_ttl: 120000,
  });

  // 使用独立实例
  const createBucketResult = myRustFS.createBucket('custom-bucket');
  console.log('创建存储桶（独立实例）:', createBucketResult);

  const uploadResult = myRustFS.upload('custom-bucket', 'test.txt', 'Test content');
  console.log('上传对象（独立实例）:', uploadResult);

  const downloadResult = myRustFS.download('custom-bucket', 'test.txt');
  console.log('下载对象（独立实例）:', downloadResult);

  console.log('\n');
}

// ==================== 运行所有示例 ====================

export function runAllExamples() {
  console.log('========================================');
  console.log('  RustFS 使用示例');
  console.log('========================================\n');

  exampleBasicUsage();
  exampleDirectoryOperations();
  exampleBulkOperations();
  exampleVersioning();
  exampleMultipartUpload();
  examplePermissionManagement();
  exampleTagging();
  exampleLifecycle();
  exampleStorageStats();
  exampleQuotaManagement();
  exampleClusterManagement();
  exampleCreateInstance();

  console.log('========================================');
  console.log('  所有示例运行完成！');
  console.log('========================================');
}

// 如果直接运行此文件，则执行所有示例
if (require.main === module) {
  runAllExamples();
}
