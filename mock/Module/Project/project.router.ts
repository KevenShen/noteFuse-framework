// mock/Project/index.ts
// 文集模块路由层
// 职责：定义文集 API 路由，配置中间件，将请求转发给 Controller
// 【路由层】只包含路由定义和中间件配置，不包含业务逻辑
// 注意：分类相关路由统一在 category.ts 中管理

import type { Request, Response } from 'express';
import { withMiddleware } from '../../Core/middleware';
import { projectController } from './project.controller';
import {
  validateCreateProjectRequest,
  validateDeleteProjectRequest,
  validateGetProjectListRequest,
  validateUpdateProjectRequest,
} from './project.validator';

// ==================== 文集 API 路由定义 ====================

export default {
  // ---------- 文集列表 ----------

  /** 获取文集列表（分页 + 搜索 + 筛选 + 排序）
   * 中间件：参数校验（query）
   */
  'GET /api/project/list': withMiddleware(
    {
      validate: validateGetProjectListRequest,
    },
    (req: Request, res: Response) => projectController.getProjectList(req, res),
  ),

  // ---------- 创建文集 ----------

  /** 创建文集
   * 中间件：认证 + 参数校验（body）
   */
  'POST /api/project': withMiddleware(
    {
      auth: true,
      validate: validateCreateProjectRequest,
    },
    (req: Request, res: Response) => projectController.createProject(req, res),
  ),

  // ---------- 更新文集 ----------

  /** 更新文集
   * 中间件：认证 + 参数校验（body）
   */
  'PUT /api/project/:id(\\d+)': withMiddleware(
    {
      auth: true,
      validate: validateUpdateProjectRequest,
    },
    (req: Request, res: Response) => projectController.updateProject(req, res),
  ),

  // ---------- 删除文集 ----------

  /** 删除文集
   * 中间件：认证 + 参数校验（params id）
   */
  'DELETE /api/project/:id(\\d+)': withMiddleware(
    {
      auth: true,
      validate: validateDeleteProjectRequest,
    },
    (req: Request, res: Response) => projectController.deleteProject(req, res),
  ),
};
