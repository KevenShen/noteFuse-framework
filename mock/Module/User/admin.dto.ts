// mock/User/admin.dto.ts
// 管理员用户 DTO（Data Transfer Object，数据传输对象）
// 功能：定义管理员用户管理接口请求参数和响应数据的类型结构

import type { MockUser } from '../../Entities/user';

// ==================== 管理员用户管理相关 DTO ====================

/** 获取用户列表请求参数 */
export interface AdminGetUserListRequest {
  /** 当前页（默认 1） */
  page?: number;
  /** 每页条数（默认 10） */
  pageSize?: number;
  /** 搜索关键词（用户名/昵称/邮箱） */
  keyword?: string;
  /** 用户状态筛选（active/disabled） */
  status?: string;
}

/** 获取用户列表响应数据（data 字段内容） */
export interface AdminGetUserListResponse {
  /** 用户列表 */
  list: Array<Omit<MockUser, 'password'>>;
  /** 总条数 */
  total: number;
  /** 当前页 */
  page: number;
  /** 每页条数 */
  pageSize: number;
}

/** 获取单个用户详情响应数据（data 字段内容） */
export type AdminGetUserDetailResponse = Omit<MockUser, 'password'>;

/** 管理员创建用户请求参数 */
export interface AdminCreateUserRequest {
  /** 用户名（3-20位） */
  username: string;
  /** 邮箱 */
  email: string;
  /** 密码（至少6位） */
  password: string;
  /** 昵称（可选，默认同用户名） */
  nickname?: string;
  /** 是否为管理员（默认 false） */
  is_staff?: boolean;
}

/** 管理员创建用户响应数据（data 字段内容） */
export type AdminCreateUserResponse = Omit<MockUser, 'password'>;

/** 管理员更新用户请求参数 */
export interface AdminUpdateUserRequest {
  /** 昵称（可选） */
  nickname?: string;
  /** 邮箱（可选） */
  email?: string;
  /** 是否为管理员（可选） */
  is_staff?: boolean;
  /** 用户状态（可选） */
  status?: 'active' | 'disabled';
  /** 头像 URL（可选） */
  avatar?: string;
}

/** 管理员更新用户响应数据（data 字段内容） */
export type AdminUpdateUserResponse = Omit<MockUser, 'password'>;

/** 管理员删除用户响应数据（无数据） */
export type AdminDeleteUserResponse = null;
