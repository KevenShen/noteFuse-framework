/**
 * 文档 CRUD 路由层
 *
 * 【职责】
 * - 只包含文档核心 CRUD 相关的路由定义和中间件配置
 * - 不包含业务逻辑
 * - 将请求转发给 Controller 层
 */

import type { Request, Response } from 'express';
import { withMiddleware } from '../../Core/middleware';
import {
  createDoc,
  deleteDoc,
  getDocDetail,
  updateDoc,
} from './doc.controller';
import {
  validateCreateDocRequest,
  validateUpdateDocRequest,
} from './doc.validator';

// ==================== 文档 CRUD API 路由定义 ====================

export default {
  /** 获取文档详情（含当前版本 content） */
  'GET /api/doc/:id': (req: Request, res: Response) => getDocDetail(req, res),
  /** 新建文档
   * 中间件：参数校验（body）
   */
  'POST /api/doc/create': withMiddleware(
    {
      validate: validateCreateDocRequest,
    },
    (req: Request, res: Response) => createDoc(req, res),
  ),

  /** 保存文档内容（更新当前版本）
   * 中间件：参数校验（body）
   */
  'PUT /api/doc/:id': withMiddleware(
    {
      validate: validateUpdateDocRequest,
    },
    (req: Request, res: Response) => updateDoc(req, res),
  ),

  /** 删除文档（级联删除版本、标签关联、浏览历史） */
  'DELETE /api/doc/:id': (req: Request, res: Response) => deleteDoc(req, res),
};
