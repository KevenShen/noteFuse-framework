// mock/Doc/docVersion.router.ts
// 文档版本管理路由层
// 职责：定义文档版本 API 路由，配置中间件，将请求转发给 Controller

import type { Request, Response } from 'express';
import { withMiddleware } from '../../Core/middleware';
import { docVersionController } from './docVersion.controller';
import {
  validateCreateDocVersionRequest,
  validateDeleteDocVersionRequest,
  validateSaveVersionContentRequest,
  validateSetCurrentVersionRequest,
  validateUpdateDocVersionRequest,
} from './docVersion.validator';

// ==================== 文档版本管理 API 路由定义 ====================

export default {
  // ---------- 创建版本 ----------

  /** 新建版本
   * 中间件：认证 + 参数校验（body）
   */
  'POST /api/doc/:id/version': withMiddleware(
    {
      auth: true,
      validate: validateCreateDocVersionRequest,
    },
    (req: Request, res: Response) => docVersionController.createDocVersion(req, res),
  ),

  // ---------- 更新版本 ----------

  /** 更新版本内容（支持 content、outline、remark）
   * 中间件：认证 + 参数校验（body）
   */
  'PUT /api/doc/version/:versionId': withMiddleware(
    {
      auth: true,
      validate: validateUpdateDocVersionRequest,
    },
    (req: Request, res: Response) => docVersionController.updateDocVersion(req, res),
  ),

  // ---------- 设为当前版本 ----------

  /** 设为当前版本
   * 中间件：认证 + 参数校验（params）
   */
  'PUT /api/doc/version/:versionId/set-current': withMiddleware(
    {
      auth: true,
      validate: validateSetCurrentVersionRequest,
    },
    (req: Request, res: Response) => docVersionController.setCurrentVersion(req, res),
  ),

  // ---------- 保存版本原文 ----------

  /** 保存版本原文（带标记，同时检测孤立批注）
   * 中间件：认证 + 参数校验（body）
   */
  'PUT /api/doc/version/:id/content': withMiddleware(
    {
      auth: true,
      validate: validateSaveVersionContentRequest,
    },
    (req: Request, res: Response) => docVersionController.saveVersionContent(req, res),
  ),

  // ---------- 删除版本 ----------

  /** 删除版本（级联删除批注，禁止删除当前版本）
   * 中间件：认证 + 参数校验（params）
   */
  'DELETE /api/doc/version/:versionId': withMiddleware(
    {
      auth: true,
      validate: validateDeleteDocVersionRequest,
    },
    (req: Request, res: Response) => docVersionController.deleteDocVersion(req, res),
  ),
};
