// mock/User/user.controller.ts
// 普通用户控制器层
// 职责：接收普通用户相关的 HTTP 请求，调用 Service 处理业务逻辑，统一返回响应

import type { Request, Response } from 'express';
import { delay, handleService, success } from '../../Core';
import type {
  ChangePasswordRequest,
  ChangePasswordResponse,
  GetEditorSettingsResponse,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  RegisterRequest,
  RegisterResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  SaveEditorSettingsRequest,
  SaveEditorSettingsResponse,
  SendResetCodeRequest,
  SendResetCodeResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
} from './user.dto';
import { userService } from './user.service';

// ============================================================================
// 普通用户控制器
// ============================================================================
class UserController {
  // ==================== 认证相关 ====================

  /** 登录 */
  async login(req: Request, res: Response) {
    await delay(300);
    const data = req.body as LoginRequest;
    await handleService<LoginResponse>(
      res,
      () => userService.login(data),
      '登录成功',
    );
  }

  /** 退出登录 */
  async logout(req: Request, res: Response) {
    await delay(100);
    await handleService<LogoutResponse>(
      res,
      () => userService.logout(req),
      '退出成功',
    );
  }

  /** 获取当前用户信息（直接从 authMiddleware 挂载的 req.currentUser 返回，避免重复查询） */
  async getCurrentUser(req: Request, res: Response) {
    await delay(200);
    // 从 req 获取当前用户（由 authMiddleware 挂载，已包含完整用户信息）
    const currentUser = (req as any).currentUser;
    res.json(success(currentUser, '获取当前用户信息成功'));
  }

  // ==================== 注册相关 ====================

  /** 注册 */
  async register(req: Request, res: Response) {
    await delay(400);
    const data = req.body as RegisterRequest;
    await handleService<RegisterResponse>(
      res,
      () => userService.register(data),
      '注册成功',
    );
  }

  // ==================== 密码重置相关 ====================

  /** 发送重置密码验证码 */
  async sendResetCode(req: Request, res: Response) {
    await delay(500);
    const data = req.body as SendResetCodeRequest;
    await handleService<SendResetCodeResponse>(
      res,
      () => userService.sendResetCode(data.email),
      '验证码已发送到您的邮箱',
    );
  }

  /** 重置密码 */
  async resetPassword(req: Request, res: Response) {
    await delay(400);
    const data = req.body as ResetPasswordRequest;
    await handleService<ResetPasswordResponse>(
      res,
      () => userService.resetPassword(data),
      '密码重置成功，请使用新密码登录',
    );
  }

  // ==================== 个人中心相关 ====================

  /** 更新个人资料 */
  async updateProfile(req: Request, res: Response) {
    await delay(300);
    // 从 req 获取当前用户（由 authMiddleware 挂载）
    const currentUser = (req as any).currentUser;
    const data = req.body as UpdateProfileRequest;
    await handleService<UpdateProfileResponse>(
      res,
      () => userService.updateProfile(currentUser, data),
      '更新成功',
    );
  }

  /** 修改密码 */
  async changePassword(req: Request, res: Response) {
    await delay(400);
    // 从 req 获取当前用户（由 authMiddleware 挂载）
    const currentUser = (req as any).currentUser;
    const data = req.body as ChangePasswordRequest;
    await handleService<ChangePasswordResponse>(
      res,
      () => userService.changePassword(currentUser.id, data),
      '密码修改成功',
    );
  }

  // ==================== 编辑器设置相关 ====================

  /** 获取编辑器设置 */
  async getEditorSettings(req: Request, res: Response) {
    await delay(150);
    // 从 req 获取当前用户（由 authMiddleware 挂载，已包含编辑器设置）
    const currentUser = (req as any).currentUser;
    await handleService<GetEditorSettingsResponse>(
      res,
      () => userService.getEditorSettings(currentUser),
      '获取编辑器设置成功',
    );
  }

  /** 保存编辑器设置 */
  async saveEditorSettings(req: Request, res: Response) {
    await delay(200);
    // 从 req 获取当前用户（由 authMiddleware 挂载）
    const currentUser = (req as any).currentUser;
    const data = req.body as SaveEditorSettingsRequest;
    await handleService<SaveEditorSettingsResponse>(
      res,
      () => userService.saveEditorSettings(currentUser, data),
      '编辑器设置已保存',
    );
  }
}

// ============================================================================
// 导出控制器实例
// ============================================================================
export const userController = new UserController();
