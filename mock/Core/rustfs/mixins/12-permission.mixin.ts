/**
 * L4 扩展功能层 - 权限管理 Mixin
 * 
 * 提供ACL管理、访问策略、预签名URL等权限相关功能
 */

import type { Constructor } from './mixin.types';
import type {
  AccessPolicy,
  ACLConfiguration,
  PresignedUrlResult,
} from '../types';

import {
  normalizePath,
  getCurrentTime,
} from '../utils';

/**
 * 权限管理 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithPermission<T extends Constructor>(Base: T) {
  return class PermissionMixin extends Base {
    // ==================== 对象ACL管理 ====================

    /**
     * 设置对象ACL
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param acl ACL配置
     * @returns 设置结果
     */
    setObjectACL(
      bucket: string,
      key: string,
      acl: string | ACLConfiguration,
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

      // 设置ACL
      if (typeof acl === 'string') {
        fileObject.acl = acl;
      } else {
        fileObject.acl_config = acl;
        fileObject.acl = (acl as any).acl || 'private';
      }

      fileObject.last_modified = getCurrentTime();

      (this as any).debugLog(`Object ACL set: ${bucket}/${normalizedKey}, acl: ${typeof acl === 'string' ? acl : (acl as any).acl}`);

      return { success: true };
    }

    /**
     * 获取对象ACL
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @returns ACL配置
     */
    getObjectACL(
      bucket: string,
      key: string,
    ): {
      success: boolean;
      error?: string;
      acl?: string;
      acl_config?: ACLConfiguration;
      owner?: { id: string; display_name: string };
      grants?: Array<{
        grantee: { type: string; id?: string; uri?: string };
        permission: string;
      }>;
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

      return {
        success: true,
        acl: fileObject.acl,
        acl_config: fileObject.acl_config,
        owner: {
          id: 'owner-id',
          display_name: 'owner',
        },
        grants: this.generateACLGrant(fileObject.acl),
      };
    }

    /**
     * 根据ACL类型生成授权列表
     * 
     * @param acl ACL类型
     * @returns 授权列表
     */
    private generateACLGrant(acl: string): Array<{
      grantee: { type: string; id?: string; uri?: string };
      permission: string;
    }> {
      const grants: Array<{
        grantee: { type: string; id?: string; uri?: string };
        permission: string;
      }> = [
        {
          grantee: { type: 'CanonicalUser', id: 'owner-id' },
          permission: 'FULL_CONTROL',
        },
      ];

      switch (acl) {
        case 'public-read':
          grants.push({
            grantee: { type: 'Group', uri: 'http://acs.amazonaws.com/groups/global/AllUsers' },
            permission: 'READ',
          });
          break;
        case 'public-read-write':
          grants.push({
            grantee: { type: 'Group', uri: 'http://acs.amazonaws.com/groups/global/AllUsers' },
            permission: 'READ',
          });
          grants.push({
            grantee: { type: 'Group', uri: 'http://acs.amazonaws.com/groups/global/AllUsers' },
            permission: 'WRITE',
          });
          break;
        case 'authenticated-read':
          grants.push({
            grantee: { type: 'Group', uri: 'http://acs.amazonaws.com/groups/global/AuthenticatedUsers' },
            permission: 'READ',
          });
          break;
        default:
          break;
      }

      return grants;
    }

    // ==================== 访问策略管理 ====================

    /**
     * 设置桶访问策略
     * 
     * @param bucket 桶名
     * @param policy 访问策略
     * @returns 设置结果
     */
    setBucketPolicy(
      bucket: string,
      policy: AccessPolicy,
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

      // 获取桶信息
      const bucketInfo = (this as any).buckets.get(bucket);
      if (!bucketInfo) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${bucket}` };
      }

      // 设置策略
      bucketInfo.policy = policy;
      bucketInfo.last_modified = getCurrentTime();

      (this as any).debugLog(`Bucket policy set: ${bucket}`);

      return { success: true };
    }

    /**
     * 获取桶访问策略
     * 
     * @param bucket 桶名
     * @returns 访问策略
     */
    getBucketPolicy(
      bucket: string,
    ): {
      success: boolean;
      error?: string;
      policy?: AccessPolicy;
    } {
      (this as any).recordRequest(true);

      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${bucket}` };
      }

      // 获取桶信息
      const bucketInfo = (this as any).buckets.get(bucket);
      if (!bucketInfo) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${bucket}` };
      }

      return {
        success: true,
        policy: bucketInfo.policy,
      };
    }

    /**
     * 删除桶访问策略
     * 
     * @param bucket 桶名
     * @returns 删除结果
     */
    deleteBucketPolicy(
      bucket: string,
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

      // 获取桶信息
      const bucketInfo = (this as any).buckets.get(bucket);
      if (!bucketInfo) {
        (this as any).recordRequest(false);
        return { success: false, error: `Bucket not found: ${bucket}` };
      }

      // 删除策略
      delete bucketInfo.policy;
      bucketInfo.last_modified = getCurrentTime();

      (this as any).debugLog(`Bucket policy deleted: ${bucket}`);

      return { success: true };
    }

    // ==================== 预签名URL ====================

    /**
     * 生成预签名上传URL
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param options 选项
     * @returns 预签名URL结果
     */
    generatePresignedUploadUrl(
      bucket: string,
      key: string,
      options?: {
        expires_in?: number; // 秒
        content_type?: string;
        content_length?: number;
        metadata?: Record<string, string>;
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
      const expiresIn = options?.expires_in ?? 3600;
      const expiresAt = Date.now() + expiresIn * 1000;

      // 生成模拟的预签名URL
      const signature = `sig_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
      const url = `/rustfs/presigned/${bucket}/${encodeURIComponent(normalizedKey)}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=mock-access-key%2F${new Date().toISOString().split('T')[0]}%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=${new Date().toISOString()}&X-Amz-Expires=${expiresIn}&X-Amz-Signature=${signature}&X-Amz-SignedHeaders=host`;

      (this as any).debugLog(`Presigned upload URL generated: ${bucket}/${normalizedKey}, expires in ${expiresIn}s`);

      return {
        success: true,
        url,
        method: 'PUT',
        bucket,
        key: normalizedKey,
        expires_in: expiresIn,
        expires_at: new Date(expiresAt).toISOString(),
        signature,
        headers: {
          'Content-Type': options?.content_type || 'application/octet-stream',
          ...(options?.content_length ? { 'Content-Length': String(options.content_length) } : {}),
        },
      };
    }

    /**
     * 生成预签名下载URL
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param options 选项
     * @returns 预签名URL结果
     */
    generatePresignedDownloadUrl(
      bucket: string,
      key: string,
      options?: {
        expires_in?: number; // 秒
        version_id?: string;
        response_content_type?: string;
        response_content_disposition?: string;
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
      const expiresIn = options?.expires_in ?? 3600;
      const expiresAt = Date.now() + expiresIn * 1000;

      // 生成模拟的预签名URL
      const signature = `sig_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
      let url = `/rustfs/presigned/${bucket}/${encodeURIComponent(normalizedKey)}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=mock-access-key%2F${new Date().toISOString().split('T')[0]}%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=${new Date().toISOString()}&X-Amz-Expires=${expiresIn}&X-Amz-Signature=${signature}&X-Amz-SignedHeaders=host`;

      // 添加可选参数
      if (options?.version_id) {
        url += `&versionId=${options.version_id}`;
      }
      if (options?.response_content_type) {
        url += `&response-content-type=${encodeURIComponent(options.response_content_type)}`;
      }
      if (options?.response_content_disposition) {
        url += `&response-content-disposition=${encodeURIComponent(options.response_content_disposition)}`;
      }

      (this as any).debugLog(`Presigned download URL generated: ${bucket}/${normalizedKey}, expires in ${expiresIn}s`);

      return {
        success: true,
        url,
        method: 'GET',
        bucket,
        key: normalizedKey,
        expires_in: expiresIn,
        expires_at: new Date(expiresAt).toISOString(),
        signature,
      };
    }

    // ==================== 访问控制检查 ====================

    /**
     * 检查是否有读取权限
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param principal 访问者
     * @returns 是否有权限
     */
    checkReadPermission(
      bucket: string,
      key: string,
      principal?: { id: string; type: string },
    ): boolean {
      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        return false;
      }

      // 获取桶信息
      const bucketInfo = (this as any).buckets.get(bucket);
      if (!bucketInfo) {
        return false;
      }

      // 桶所有者总是有权限
      if (principal?.id === bucketInfo.owner_id) {
        return true;
      }

      // 检查桶ACL
      if (bucketInfo.acl === 'public-read' || bucketInfo.acl === 'public-read-write') {
        return true;
      }

      // 如果指定了对象，检查对象ACL
      if (key) {
        const normalizedKey = normalizePath(key);
        const allVersions = (Array.from((this as any).objects.values()) as any[]).filter(
          (obj: any) => obj.bucket === bucket && obj.key === normalizedKey,
        );
        const latestVersion = allVersions.find((obj: any) => obj.is_latest);

        if (latestVersion) {
          if (latestVersion.acl === 'public-read' || latestVersion.acl === 'public-read-write') {
            return true;
          }
        }
      }

      return false;
    }

    /**
     * 检查是否有写入权限
     * 
     * @param bucket 桶名
     * @param key 对象键
     * @param principal 访问者
     * @returns 是否有权限
     */
    checkWritePermission(
      bucket: string,
      key: string,
      principal?: { id: string; type: string },
    ): boolean {
      // 检查桶是否存在
      if (!(this as any).bucketExists(bucket)) {
        return false;
      }

      // 获取桶信息
      const bucketInfo = (this as any).buckets.get(bucket);
      if (!bucketInfo) {
        return false;
      }

      // 桶所有者总是有权限
      if (principal?.id === bucketInfo.owner_id) {
        return true;
      }

      // 检查桶ACL
      if (bucketInfo.acl === 'public-read-write') {
        return true;
      }

      return false;
    }
  };
}
