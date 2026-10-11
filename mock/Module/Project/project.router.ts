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
      validateSource: 'query',
    },
    (req: Request, res: Response) => projectController.getProjectList(req, res),
  ),

  // ---------- 文集详情 ----------

  /** 获取文集详情 */
  'GET /api/project/:id(\\d+)': (req: Request, res: Response) =>
    projectController.getProjectDetail(req, res),

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
   * 中间件：认证
   */
  'DELETE /api/project/:id(\\d+)': withMiddleware(
    {
      auth: true,
    },
    (req: Request, res: Response) => projectController.deleteProject(req, res),
  ),

  // ==================== 缓存管理接口（管理后台应急处理） ====================

  /** 获取缓存校验状态 */
  // 'GET /api/project/cache/validation-status': (req: Request, res: Response) =>
  //   projectController.getCacheValidationStatus(req, res),

  /** 手动触发全量校验
   * 中间件：认证
   */
  // 'POST /api/project/cache/validate': withMiddleware(
  //   {
  //     auth: true,
  //   },
  //   (req: Request, res: Response) => projectController.triggerCacheValidation(req, res),
  // ),

  /** 全量重置所有分类缓存
   * 中间件：认证
   */
  // 'POST /api/project/cache/reset/all': withMiddleware(
  //   {
  //     auth: true,
  //   },
  //   (req: Request, res: Response) => projectController.resetAllCache(req, res),
  // ),

  /** 重置单个分类计数器
   * 中间件：认证
   */
  // 'POST /api/project/cache/reset/counter/:id(\\d+)': withMiddleware(
  //   {
  //     auth: true,
  //   },
  //   (req: Request, res: Response) => projectController.resetCategoryCounter(req, res),
  // ),

  /** 重置所有计数器
   * 中间件：认证
   */
  // 'POST /api/project/cache/reset/counters': withMiddleware(
  //   {
  //     auth: true,
  //   },
  //   (req: Request, res: Response) => projectController.resetAllCounters(req, res),
  // ),

  /** 重置单个分类详情
   * 中间件：认证
   */
  // 'POST /api/project/cache/reset/info/:id(\\d+)': withMiddleware(
  //   {
  //     auth: true,
  //   },
  //   (req: Request, res: Response) => projectController.resetCategoryInfo(req, res),
  // ),

  /** 重置排序索引
   * 中间件：认证
   */
  // 'POST /api/project/cache/reset/order': withMiddleware(
  //   {
  //     auth: true,
  //   },
  //   (req: Request, res: Response) => projectController.resetCategoryOrder(req, res),
  // ),

  /** 重置单个分类祖先链路
   * 中间件：认证
   */
  // 'POST /api/project/cache/reset/chain/:id(\\d+)': withMiddleware(
  //   {
  //     auth: true,
  //   },
  //   (req: Request, res: Response) => projectController.resetCategoryChain(req, res),
  // ),

  // ==================== 兜底机制管理接口 ====================

  /** 获取兜底机制状态 */
  // 'GET /api/project/cache/fallback/status': (req: Request, res: Response) =>
  //   projectController.getFallbackStatus(req, res),

  /** 获取兜底机制配置 */
  // 'GET /api/project/cache/fallback/config': (req: Request, res: Response) =>
  //   projectController.getFallbackConfig(req, res),

  /** 更新兜底机制配置
   * 中间件：认证
   */
  // 'PUT /api/project/cache/fallback/config': withMiddleware(
  //   {
  //     auth: true,
  //   },
  //   (req: Request, res: Response) => projectController.updateFallbackConfig(req, res),
  // ),

  /** 重置兜底机制配置为默认值
   * 中间件：认证
   */
  // 'POST /api/project/cache/fallback/config/reset': withMiddleware(
  //   {
  //     auth: true,
  //   },
  //   (req: Request, res: Response) => projectController.resetFallbackConfig(req, res),
  // ),

  /** 获取兜底机制统计 */
  // 'GET /api/project/cache/fallback/stats': (req: Request, res: Response) =>
  //   projectController.getFallbackStats(req, res),

  /** 重置兜底机制统计
   * 中间件：认证
   */
  // 'POST /api/project/cache/fallback/stats/reset': withMiddleware(
  //   {
  //     auth: true,
  //   },
  //   (req: Request, res: Response) => projectController.resetFallbackStats(req, res),
  // ),

  /** 获取兜底机制健康度评分 */
  // 'GET /api/project/cache/fallback/health': (req: Request, res: Response) =>
  //   projectController.getFallbackHealth(req, res),
};
