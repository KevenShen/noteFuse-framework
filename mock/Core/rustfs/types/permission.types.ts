/**
 * RustFS 权限类型定义
 * 
 * 包含ACL、访问策略、CORS等类型
 */

import type { ACLType, FileOwner } from './base.types';

// ==================== 访问策略类型 ====================

/**
 * 访问策略（IAM Policy）
 */
export interface AccessPolicy {
  /** 策略版本 */
  Version: string;
  /** 策略ID */
  Id?: string;
  /** 策略语句 */
  Statement: PolicyStatement[];
}

/**
 * 策略语句
 */
export interface PolicyStatement {
  /** 语句ID */
  Sid?: string;
  /** 效果（允许/拒绝） */
  Effect: 'Allow' | 'Deny';
  /** 主体 */
  Principal?: Principal | string;
  /** 动作 */
  Action: string | string[];
  /** 资源 */
  Resource: string | string[];
  /** 条件 */
  Condition?: PolicyCondition;
}

/**
 * 主体
 */
export interface Principal {
  /** AWS账号ID */
  AWS?: string | string[];
  /** 服务 */
  Service?: string | string[];
  /** 联合身份 */
  Federated?: string | string[];
  /** 所有人 */
  '*'?: string;
}

/**
 * 策略条件
 */
export interface PolicyCondition {
  /** 字符串等于 */
  StringEquals?: Record<string, string | string[]>;
  /** 字符串不等于 */
  StringNotEquals?: Record<string, string | string[]>;
  /** 字符串等于（忽略大小写） */
  StringEqualsIgnoreCase?: Record<string, string | string[]>;
  /** 字符串不等于（忽略大小写） */
  StringNotEqualsIgnoreCase?: Record<string, string | string[]>;
  /** 字符串类似 */
  StringLike?: Record<string, string | string[]>;
  /** 字符串不类似 */
  StringNotLike?: Record<string, string | string[]>;
  /** 数值等于 */
  NumericEquals?: Record<string, number | number[]>;
  /** 数值不等于 */
  NumericNotEquals?: Record<string, number | number[]>;
  /** 数值小于 */
  NumericLessThan?: Record<string, number | number[]>;
  /** 数值小于等于 */
  NumericLessThanEquals?: Record<string, number | number[]>;
  /** 数值大于 */
  NumericGreaterThan?: Record<string, number | number[]>;
  /** 数值大于等于 */
  NumericGreaterThanEquals?: Record<string, number | number[]>;
  /** 日期等于 */
  DateEquals?: Record<string, string | string[]>;
  /** 日期不等于 */
  DateNotEquals?: Record<string, string | string[]>;
  /** 日期小于 */
  DateLessThan?: Record<string, string | string[]>;
  /** 日期小于等于 */
  DateLessThanEquals?: Record<string, string | string[]>;
  /** 日期大于 */
  DateGreaterThan?: Record<string, string | string[]>;
  /** 日期大于等于 */
  DateGreaterThanEquals?: Record<string, string | string[]>;
  /** IP地址等于 */
  IpAddress?: Record<string, string | string[]>;
  /** IP地址不等于 */
  NotIpAddress?: Record<string, string | string[]>;
  /** ARN等于 */
  ArnEquals?: Record<string, string | string[]>;
  /** ARN不等于 */
  ArnNotEquals?: Record<string, string | string[]>;
  /** ARN类似 */
  ArnLike?: Record<string, string | string[]>;
  /** ARN不类似 */
  ArnNotLike?: Record<string, string | string[]>;
  /** 布尔值 */
  Bool?: Record<string, boolean | boolean[]>;
  /** 如果存在键 */
  Null?: Record<string, boolean | boolean[]>;
}

// ==================== ACL类型 ====================

/**
 * ACL配置
 */
export interface ACLConfiguration {
  /** 所有者 */
  owner: FileOwner;
  /** 授权列表 */
  grants: ACLGrant[];
}

/**
 * ACL授权
 */
export interface ACLGrant {
  /** 被授权者 */
  grantee: ACLGrantee;
  /** 权限 */
  permission: ACLPermission;
}

/**
 * ACL被授权者
 */
export interface ACLGrantee {
  /** 类型 */
  type: 'CanonicalUser' | 'Group' | 'AmazonCustomerByEmail';
  /** 用户ID（CanonicalUser类型） */
  id?: string;
  /** 显示名称 */
  display_name?: string;
  /** 组URI（Group类型） */
  uri?: string;
  /** 邮箱（AmazonCustomerByEmail类型） */
  email_address?: string;
}

/**
 * ACL权限
 */
export type ACLPermission =
  | 'FULL_CONTROL'
  | 'WRITE'
  | 'WRITE_ACP'
  | 'READ'
  | 'READ_ACP';

/**
 * 预定义ACL组
 */
export const PREDEFINED_ACL_GROUPS = {
  /** 所有用户 */
  ALL_USERS: 'http://acs.amazonaws.com/groups/global/AllUsers',
  /** 认证用户 */
  AUTHENTICATED_USERS: 'http://acs.amazonaws.com/groups/global/AuthenticatedUsers',
  /** 日志投递用户 */
  LOG_DELIVERY: 'http://acs.amazonaws.com/groups/s3/LogDelivery',
} as const;

/**
 * ACL权限映射（预定义ACL到授权列表）
 */
export const ACL_PERMISSION_MAP: Record<ACLType, ACLGrant[]> = {
  'private': [],
  'public-read': [
    {
      grantee: { type: 'Group', uri: PREDEFINED_ACL_GROUPS.ALL_USERS },
      permission: 'READ',
    },
  ],
  'public-read-write': [
    {
      grantee: { type: 'Group', uri: PREDEFINED_ACL_GROUPS.ALL_USERS },
      permission: 'READ',
    },
    {
      grantee: { type: 'Group', uri: PREDEFINED_ACL_GROUPS.ALL_USERS },
      permission: 'WRITE',
    },
  ],
  'authenticated-read': [
    {
      grantee: { type: 'Group', uri: PREDEFINED_ACL_GROUPS.AUTHENTICATED_USERS },
      permission: 'READ',
    },
  ],
  'bucket-owner-read': [
    {
      grantee: { type: 'CanonicalUser', id: 'bucket-owner' },
      permission: 'READ',
    },
  ],
  'bucket-owner-full-control': [
    {
      grantee: { type: 'CanonicalUser', id: 'bucket-owner' },
      permission: 'FULL_CONTROL',
    },
  ],
  'log-delivery-write': [
    {
      grantee: { type: 'Group', uri: PREDEFINED_ACL_GROUPS.LOG_DELIVERY },
      permission: 'WRITE',
    },
    {
      grantee: { type: 'Group', uri: PREDEFINED_ACL_GROUPS.LOG_DELIVERY },
      permission: 'READ_ACP',
    },
  ],
};

// ==================== 访问控制类型 ====================

/**
 * 访问请求
 */
export interface AccessRequest {
  /** 桶名 */
  bucket: string;
  /** 对象键 */
  key?: string;
  /** 动作 */
  action: string;
  /** 请求者 */
  requester?: {
    id?: string;
    type?: 'user' | 'anonymous' | 'service';
  };
  /** 请求参数 */
  params?: Record<string, any>;
  /** 请求头 */
  headers?: Record<string, string>;
  /** 源IP */
  source_ip?: string;
  /** 请求时间 */
  request_time: string;
}

/**
 * 访问决策
 */
export interface AccessDecision {
  /** 是否允许 */
  allowed: boolean;
  /** 决策原因 */
  reason?: string;
  /** 匹配的策略语句 */
  matched_statement?: PolicyStatement;
  /** 决策时间 */
  decision_time: string;
}

// ==================== 签名验证类型 ====================

/**
 * 签名验证结果
 */
export interface SignatureVerificationResult {
  /** 是否有效 */
  valid: boolean;
  /** 访问密钥ID */
  access_key_id?: string;
  /** 签名 */
  signature?: string;
  /** 签名方法 */
  signature_method?: string;
  /** 过期时间 */
  expires_at?: number;
  /** 是否过期 */
  expired?: boolean;
  /** 错误信息 */
  error?: string;
  /** 验证时间 */
  verified_at: string;
}

/**
 * 签名选项
 */
export interface SignOptions {
  /** 访问密钥ID */
  access_key_id: string;
  /** 秘密访问密钥 */
  secret_access_key: string;
  /** 会话令牌 */
  session_token?: string;
  /** HTTP方法 */
  method: string;
  /** 桶名 */
  bucket: string;
  /** 对象键 */
  key?: string;
  /** 查询参数 */
  query_params?: Record<string, string>;
  /** 请求头 */
  headers?: Record<string, string>;
  /** 负载 */
  payload?: string | Buffer;
  /** 区域 */
  region?: string;
  /** 服务 */
  service?: string;
  /** 签名时间 */
  signing_time?: Date;
  /** 过期时间（秒） */
  expires_in?: number;
}
