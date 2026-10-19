// mock/Doc/doc.router.ts
// 文档 CRUD 路由层
// 职责：定义文档核心 CRUD API 路由，配置中间件，将请求转发给 Controller

import type { Request, Response } from 'express';
import { withMiddleware } from '../../Core/middleware';
import { docController } from './doc.controller';
import {
  validateCreateDocRequest,
  validateDeleteDocRequest,
  validateUpdateDocRequest,
} from './doc.validator';

// ==================== 文档 CRUD API 路由定义 ====================

export default {
  // ---------- 获取文档详情 ----------

  /** 获取文档详情（含当前版本 content） */
  'GET /api/doc/:id': (req: Request, res: Response) =>
    docController.getDocDetail(req, res),

  // ---------- 创建文档 ----------

  /** 新建文档
   * 中间件：认证 + 参数校验（body）
   */
  'POST /api/doc/create': withMiddleware(
    {
      auth: true,
      validate: validateCreateDocRequest,
    },
    (req: Request, res: Response) => docController.createDoc(req, res),
  ),

  // ---------- 更新文档 ----------

  /** 保存文档内容（更新当前版本）
   * 中间件：认证 + 参数校验（body）
   */
  'PUT /api/doc/:id': withMiddleware(
    {
      auth: true,
      validate: validateUpdateDocRequest,
    },
    (req: Request, res: Response) => docController.updateDoc(req, res),
  ),

  // ---------- 删除文档 ----------

  /** 删除文档（级联删除版本、标签关联、浏览历史）
   * 中间件：认证 + 参数校验（自动合并 body 和 params）
   */
  'DELETE /api/doc/:id': withMiddleware(
    {
      auth: true,
      validate: validateDeleteDocRequest,
    },
    (req: Request, res: Response) => docController.deleteDoc(req, res),
  ),
};
