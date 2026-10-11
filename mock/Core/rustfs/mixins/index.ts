/**
 * RustFS Mixin 统一导出
 * 
 * 包含所有功能Mixin的导出
 */

// Mixin基础设施
export * from './mixin.types';
export * from './mixin.utils';

// L1 基础层 Mixin
export { WithBucketManagement } from './01-bucket-management.mixin';
export { WithFileUpload } from './02-file-upload.mixin';
export { WithFileDownload } from './03-file-download.mixin';
export { WithFileDelete } from './04-file-delete.mixin';
export { WithFileMetadata } from './05-file-metadata.mixin';

// L2 操作层 Mixin
export { WithFileOperation } from './06-file-operation.mixin';
export { WithDirectory } from './07-directory.mixin';
export { WithBulkOperation } from './08-bulk-operation.mixin';

// L3 高级功能层 Mixin
export { WithVersioning } from './09-versioning.mixin';
export { WithMultipartUpload } from './10-multipart-upload.mixin';
export { WithFilePreview } from './11-file-preview.mixin';

// L4 扩展功能层 Mixin
export { WithPermission } from './12-permission.mixin';
export { WithTagging } from './13-tagging.mixin';
export { WithLifecycle } from './14-lifecycle.mixin';
export { WithReplication } from './15-replication.mixin';

// L5 运维管理层 Mixin
export { WithStorageStats } from './16-storage-stats.mixin';
export { WithQuota } from './17-quota.mixin';
export { WithCluster } from './18-cluster.mixin';

// L5 运维管理层 Mixin（待实现）
// export { WithStorageStats } from './16-storage-stats.mixin';
// export { WithQuota } from './17-quota.mixin';
// export { WithCluster } from './18-cluster.mixin';
