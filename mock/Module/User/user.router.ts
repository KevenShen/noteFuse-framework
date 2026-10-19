// mock/User/index.ts
// 用户模块路由层
// 职责：定义普通用户 API 路由，配置中间件，将请求转发给 Controller
// 【路由层】只包含路由定义和中间件配置，不包含业务逻辑

import type { Request, Response } from 'express';
import { withMiddleware } from '../../Core/middleware';
import { userController } from './user.controller';
import {
  validateChangePasswordRequest,
  validateLoginRequest,
  validateRegisterRequest,
  validateResetPasswordRequest,
  validateSaveEditorSettingsRequest,
  validateSendResetCodeRequest,
  validateUpdateProfileRequest,
} from './user.validator';

// ==================== 普通用户 API 路由定义 ====================

export default {
  // ---------- 认证相关 ----------

  /** 登录
   * 中间件：参数校验（body）
   */
  'POST /api/login': withMiddleware(
    {
      validate: validateLoginRequest,
    },
    (req: Request, res: Response) => userController.login(req, res),
  ),

  /** 退出登录
   * 中间件：无（公开接口）
   */
  'POST /api/logout': (req: Request, res: Response) =>
    userController.logout(req, res),

  /** 获取当前用户信息
   * 中间件：认证
   */
  'GET /api/currentUser': withMiddleware(
    {
      auth: true,
    },
    (req: Request, res: Response) => userController.getCurrentUser(req, res),
  ),

  // ---------- 注册相关 ----------

  /** 注册
   * 中间件：参数校验（body）
   */
  'POST /api/register': withMiddleware(
    {
      validate: validateRegisterRequest,
    },
    (req: Request, res: Response) => userController.register(req, res),
  ),

  // ---------- 密码重置 ----------

  /** 发送重置密码验证码
   * 中间件：参数校验（body）
   */
  'POST /api/password/send-code': withMiddleware(
    {
      validate: validateSendResetCodeRequest,
    },
    (req: Request, res: Response) => userController.sendResetCode(req, res),
  ),

  /** 重置密码
   * 中间件：参数校验（body）
   */
  'POST /api/password/reset': withMiddleware(
    {
      validate: validateResetPasswordRequest,
    },
    (req: Request, res: Response) => userController.resetPassword(req, res),
  ),

  // ---------- 个人中心 ----------

  /** 更新个人资料
   * 中间件：认证 + 参数校验（body）
   */
  'PUT /api/user/profile': withMiddleware(
    {
      auth: true,
      validate: validateUpdateProfileRequest,
    },
    (req: Request, res: Response) => userController.updateProfile(req, res),
  ),

  /** 修改密码
   * 中间件：认证 + 参数校验（body）
   */
  'PUT /api/user/password': withMiddleware(
    {
      auth: true,
      validate: validateChangePasswordRequest,
    },
    (req: Request, res: Response) => userController.changePassword(req, res),
  ),

  // ---------- 编辑器设置 ----------

  /** 获取当前用户的编辑器设置
   * 中间件：认证
   */
  'GET /api/user/editor-settings': withMiddleware(
    {
      auth: true,
    },
    (req: Request, res: Response) => userController.getEditorSettings(req, res),
  ),

  /** 保存当前用户的编辑器设置
   * 中间件：认证 + 参数校验（body）
   */
  'PUT /api/user/editor-settings': withMiddleware(
    {
      auth: true,
      validate: validateSaveEditorSettingsRequest,
    },
    (req: Request, res: Response) =>
      userController.saveEditorSettings(req, res),
  ),
};
