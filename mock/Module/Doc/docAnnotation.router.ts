// mock/Doc/docAnnotation.router.ts
// 文档批注管理路由层
// 职责：定义文档批注 API 路由，配置中间件，将请求转发给 Controller

import type { Request, Response } from 'express';
import { withMiddleware } from '../../Core/middleware';
import { docAnnotationController } from './docAnnotation.controller';
import {
  validateAddAnnotationRequest,
  validateDeleteAnnotationRequest,
  validateGetVersionAnnotationsRequest,
  validateUpdateAnnotationRequest,
} from './docAnnotation.validator';

// ==================== 文档批注管理 API 路由定义 ====================

export default {
  // ---------- 获取批注列表 ----------

  /** 获取版本的批注列表
   * 中间件：参数校验（params）
   */
  'GET /api/doc/version/:id/annotations': withMiddleware(
    {
      validate: validateGetVersionAnnotationsRequest,
    },
    (req: Request, res: Response) => docAnnotationController.getVersionAnnotations(req, res),
  ),

  // ---------- 添加批注 ----------

  /** 添加批注（同时保存带标记的原文）
   * 中间件：认证 + 参数校验（body）
   */
  'POST /api/doc/version/:id/annotations': withMiddleware(
    {
      auth: true,
      validate: validateAddAnnotationRequest,
    },
    (req: Request, res: Response) => docAnnotationController.addAnnotation(req, res),
  ),

  // ---------- 更新批注 ----------

  /** 更新批注
   * 中间件：认证 + 参数校验（body）
   */
  'PUT /api/doc/annotation/:id': withMiddleware(
    {
      auth: true,
      validate: validateUpdateAnnotationRequest,
    },
    (req: Request, res: Response) => docAnnotationController.updateAnnotation(req, res),
  ),

  // ---------- 删除批注 ----------

  /** 删除批注（同时删除原文中的标记）
   * 中间件：认证 + 参数校验（自动合并 body 和 params）
   */
  'DELETE /api/doc/annotation/:id': withMiddleware(
    {
      auth: true,
      validate: validateDeleteAnnotationRequest,
    },
    (req: Request, res: Response) => docAnnotationController.deleteAnnotation(req, res),
  ),
};
