/**
 * 文档版本管理路由层
 *
 * 【职责】
 * - 只包含文档版本相关的路由定义和中间件配置
 * - 不包含业务逻辑
 * - 将请求转发给 Controller 层
 */

import type { Request, Response } from 'express';
import { withMiddleware } from '../../Core/middleware';
import {
  createDocVersion,
  deleteDocVersion,
  saveVersionContent,
  setCurrentVersion,
  updateDocVersion,
} from './docVersion.controller';
import {
  validateCreateDocVersionRequest,
  validateSaveVersionContentRequest,
  validateUpdateDocVersionRequest,
} from './docVersion.validator';

// ==================== 文档版本管理 API 路由定义 ====================

export default {
  /** 新建版本
   * 中间件：参数校验（body）
   */
  'POST /api/doc/:id/version': withMiddleware(
    {
      validate: validateCreateDocVersionRequest,
    },
    (req: Request, res: Response) => createDocVersion(req, res),
  ),

  /** 更新版本内容（支持 content、outline、remark）
   * 中间件：参数校验（body）
   */
  'PUT /api/doc/version/:versionId': withMiddleware(
    {
      validate: validateUpdateDocVersionRequest,
    },
    (req: Request, res: Response) => updateDocVersion(req, res),
  ),

  /** 设为当前版本 */
  'PUT /api/doc/version/:versionId/set-current': (
    req: Request,
    res: Response,
  ) => setCurrentVersion(req, res),

  /** 保存版本原文（带标记，同时检测孤立批注）
   * 中间件：参数校验（body）
   */
  'PUT /api/doc/version/:id/content': withMiddleware(
    {
      validate: validateSaveVersionContentRequest,
    },
    (req: Request, res: Response) => saveVersionContent(req, res),
  ),

  /** 删除版本（级联删除批注，禁止删除当前版本） */
  'DELETE /api/doc/version/:versionId': (
    req: Request,
    res: Response,
  ) => deleteDocVersion(req, res),
};
