// mock/User/admin.ts
// 管理员用户管理路由层
// 职责：定义管理员 API 路由，配置中间件，将请求转发给 Controller
// 【路由层】只包含路由定义和中间件配置，不包含业务逻辑

import type { Request, Response } from 'express';
import { adminController } from './admin.controller';
import { withMiddleware } from '../../Core/middleware';
import {
  validateAdminGetUserListRequest,
  validateAdminCreateUserRequest,
  validateAdminUpdateUserRequest,
} from './admin.validator';

// ==================== 管理员 API 路由定义 ====================

export default {
  // ---------- 用户管理（CRUD） ----------

  /** 获取用户列表（分页 + 搜索）
   * 中间件：管理员权限 + 参数校验（query）
   */
  'GET /api/users': withMiddleware(
    {
      admin: true,
      validate: validateAdminGetUserListRequest,
    },
    (req: Request, res: Response) => adminController.getAdminUserList(req, res),
  ),

  /** 获取单个用户详情
   * 中间件：管理员权限
   */
  'GET /api/users/:id': withMiddleware(
    {
      admin: true,
    },
    (req: Request, res: Response) => adminController.getAdminUserDetail(req, res),
  ),

  /** 创建用户
   * 中间件：管理员权限 + 参数校验（body）
   */
  'POST /api/users': withMiddleware(
    {
      admin: true,
      validate: validateAdminCreateUserRequest,
    },
    (req: Request, res: Response) => adminController.adminCreateUser(req, res),
  ),

  /** 更新用户
   * 中间件：管理员权限 + 参数校验（body）
   */
  'PUT /api/users/:id': withMiddleware(
    {
      admin: true,
      validate: validateAdminUpdateUserRequest,
    },
    (req: Request, res: Response) => adminController.adminUpdateUser(req, res),
  ),

  /** 删除用户
   * 中间件：超级管理员权限
   */
  'DELETE /api/users/:id': withMiddleware(
    {
      superAdmin: true,
    },
    (req: Request, res: Response) => adminController.adminDeleteUser(req, res),
  ),
};
