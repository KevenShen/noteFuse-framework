// mock/Project/projectInfo.router.ts
// 文集详情页子资源路由层
// 职责：定义文集详情页子资源 API 路由，配置中间件，将请求转发给 Controller
// 【路由层】只包含路由定义和中间件配置，不包含业务逻辑

import type { Request, Response } from 'express';
import { withMiddleware } from '../../Core/middleware';
import { projectInfoController } from './projectInfo.controller';
import {
  validateSaveAiOutlineRequest,
  validateUpdateProjectIntroRequest,
} from './projectInfo.validator';

// ==================== 文集详情页子资源 API 路由定义 ====================

export default {
  // ---------- 文档分类 ----------

  /** 获取文集下的文档分类列表 */
  'GET /api/project/:id(\\d+)/categories': (req: Request, res: Response) =>
    projectInfoController.getProjectCategories(req, res),

  // ---------- 文档列表 ----------

  /** 获取文集下的文档列表 */
  'GET /api/project/:id(\\d+)/docs': (req: Request, res: Response) =>
    projectInfoController.getProjectDocs(req, res),

  // ---------- 文档版本 ----------

  /** 获取文集下所有文档的版本列表 */
  'GET /api/project/:id(\\d+)/doc-versions': (req: Request, res: Response) =>
    projectInfoController.getProjectDocVersions(req, res),

  // ---------- AI 总结大纲 ----------

  /** 获取文集的 AI 总结大纲 */
  'GET /api/project/:id(\\d+)/ai-outline': (req: Request, res: Response) =>
    projectInfoController.getAiOutline(req, res),

  /** 生成文集的 AI 总结大纲
   * 中间件：认证
   */
  'POST /api/project/:id(\\d+)/ai-outline/generate': withMiddleware(
    {
      auth: true,
    },
    (req: Request, res: Response) =>
      projectInfoController.generateAiOutline(req, res),
  ),

  /** 保存文集的 AI 总结大纲
   * 中间件：认证 + 参数校验（body）
   */
  'PUT /api/project/:id(\\d+)/ai-outline': withMiddleware(
    {
      auth: true,
      validate: validateSaveAiOutlineRequest,
    },
    (req: Request, res: Response) =>
      projectInfoController.saveAiOutline(req, res),
  ),

  // ---------- 文集简介 ----------

  /** 更新文集简介
   * 中间件：认证 + 参数校验（body）
   */
  'PUT /api/project/:id(\\d+)/intro': withMiddleware(
    {
      auth: true,
      validate: validateUpdateProjectIntroRequest,
    },
    (req: Request, res: Response) =>
      projectInfoController.updateProjectIntro(req, res),
  ),
};
