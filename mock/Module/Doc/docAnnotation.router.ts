/**
 * 文档批注管理路由层
 *
 * 【职责】
 * - 只包含文档批注相关的路由定义和中间件配置
 * - 不包含业务逻辑
 * - 将请求转发给 Controller 层
 */

import type { Request, Response } from 'express';
import { withMiddleware } from '../../Core/middleware';
import {
  addAnnotation,
  deleteAnnotation,
  getVersionAnnotations,
  updateAnnotation,
} from './docAnnotation.controller';
import {
  validateAddAnnotationRequest,
  validateUpdateAnnotationRequest,
} from './docAnnotation.validator';

// ==================== 文档批注管理 API 路由定义 ====================

export default {
  /** 获取版本的批注列表 */
  'GET /api/doc/version/:id/annotations': (req: Request, res: Response) =>
    getVersionAnnotations(req, res),

  /** 添加批注（同时保存带标记的原文）
   * 中间件：参数校验（body）
   */
  'POST /api/doc/version/:id/annotations': withMiddleware(
    {
      validate: validateAddAnnotationRequest,
    },
    (req: Request, res: Response) => addAnnotation(req, res),
  ),

  /** 更新批注
   * 中间件：参数校验（body）
   */
  'PUT /api/doc/annotation/:id': withMiddleware(
    {
      validate: validateUpdateAnnotationRequest,
    },
    (req: Request, res: Response) => updateAnnotation(req, res),
  ),

  /** 删除批注（同时删除原文中的标记） */
  'DELETE /api/doc/annotation/:id': (req: Request, res: Response) =>
    deleteAnnotation(req, res),
};
