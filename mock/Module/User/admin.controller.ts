// mock/User/admin.controller.ts
// 管理员用户控制器层
// 职责：接收管理员相关的 HTTP 请求，调用 Service 处理业务逻辑，统一返回响应

import type { Request, Response } from 'express';
import { delay, handleService } from '../../Core';
import { adminService } from './admin.service';
import type {
  AdminGetUserListRequest,
  AdminGetUserListResponse,
  AdminGetUserDetailResponse,
  AdminCreateUserRequest,
  AdminCreateUserResponse,
  AdminUpdateUserRequest,
  AdminUpdateUserResponse,
  AdminDeleteUserResponse,
} from './admin.dto';

/**
 * 管理员用户控制器
 */
class AdminController {
  // ==================== 管理员用户管理相关 ====================

  /** 获取用户列表（分页 + 搜索） */
  async getAdminUserList(req: Request, res: Response) {
    await delay(300);
    // 权限校验由 adminMiddleware 处理
    const query = req.query as unknown as AdminGetUserListRequest;

    // 参数默认值处理（HTTP 层职责，service 层接收完整参数）
    const params: AdminGetUserListRequest = {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
      keyword: query.keyword ?? '',
      status: query.status ?? '',
    };

    await handleService<AdminGetUserListResponse>(
      res,
      () => adminService.getAdminUserList(params),
    );
  }

  /** 获取单个用户详情 */
  async getAdminUserDetail(req: Request, res: Response) {
    await delay(200);
    // 权限校验由 adminMiddleware 处理
    const userId = parseInt(req.params.id as string, 10);
    await handleService<AdminGetUserDetailResponse>(
      res,
      () => adminService.getAdminUserDetail(userId),
      undefined,
      404,
    );
  }

  /** 管理员创建用户 */
  async adminCreateUser(req: Request, res: Response) {
    await delay(400);
    // 权限校验由 adminMiddleware 处理
    // 参数校验由 validateMiddleware 处理
    const data = req.body as AdminCreateUserRequest;
    await handleService<AdminCreateUserResponse>(
      res,
      () => adminService.adminCreateUser(data),
      '创建成功',
    );
  }

  /** 管理员更新用户 */
  async adminUpdateUser(req: Request, res: Response) {
    await delay(300);
    // 权限校验由 adminMiddleware 处理
    // 参数校验由 validateMiddleware 处理
    const userId = parseInt(req.params.id as string, 10);
    const data = req.body as AdminUpdateUserRequest;
    await handleService<AdminUpdateUserResponse>(
      res,
      () => adminService.adminUpdateUser(userId, data),
      '更新成功',
      404,
    );
  }

  /** 管理员删除用户 */
  async adminDeleteUser(req: Request, res: Response) {
    await delay(300);
    // 权限校验由 superAdminMiddleware 处理
    const userId = parseInt(req.params.id as string, 10);
    // 从 req 获取当前用户（由 authMiddleware 挂载）
    const currentUser = (req as any).currentUser;
    await handleService<AdminDeleteUserResponse>(
      res,
      () => adminService.adminDeleteUser(userId, currentUser.id),
      '删除成功',
      404,
    );
  }
}

export const adminController = new AdminController();
