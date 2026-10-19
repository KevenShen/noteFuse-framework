// mock/Doc/docCategory.router.ts
// 文档分类管理路由层
// 职责：定义文档分类 API 路由，配置中间件，将请求转发给 Controller

import type { Request, Response } from 'express';
import { withMiddleware } from '../../Core/middleware';
import { docCategoryController } from './docCategory.controller';
import {
  validateBatchDeleteDocCategoriesRequest,
  validateBatchMoveDocCategoriesRequest,
  validateCreateDocCategoryRequest,
  validateDeleteDocCategoryRequest,
  validateGetAllDocCategoriesRequest,
  validateGetDocCategoriesRequest,
  validateSaveDocCategorySortRequest,
  validateUpdateDocCategoryRequest,
} from './docCategory.validator';

// ==================== 文档分类管理 API 路由定义 ====================

export default {
  // ---------- 获取分类列表 ----------

  /** 获取文集下的文档分类列表
   * 中间件：参数校验（query + params）
   */
  'GET /api/doc/categories/:projectId': withMiddleware(
    {
      validate: validateGetDocCategoriesRequest,
    },
    (req: Request, res: Response) =>
      docCategoryController.getDocCategories(req, res),
  ),

  /** 获取所有文档分类列表（跨文集，带文档数量）
   * 中间件：参数校验（query）
   */
  'GET /api/doc/categories': withMiddleware(
    {
      validate: validateGetAllDocCategoriesRequest,
    },
    (req: Request, res: Response) =>
      docCategoryController.getAllDocCategories(req, res),
  ),

  // ---------- 创建分类 ----------

  /** 新建文档分类
   * 中间件：认证 + 参数校验（body）
   */
  'POST /api/doc/categories': withMiddleware(
    {
      auth: true,
      validate: validateCreateDocCategoryRequest,
    },
    (req: Request, res: Response) =>
      docCategoryController.createDocCategory(req, res),
  ),

  // ---------- 更新分类 ----------

  /** 更新文档分类
   * 中间件：认证 + 参数校验（body）
   */
  'PUT /api/doc/categories/:id': withMiddleware(
    {
      auth: true,
      validate: validateUpdateDocCategoryRequest,
    },
    (req: Request, res: Response) =>
      docCategoryController.updateDocCategory(req, res),
  ),

  // ---------- 删除分类 ----------

  /** 删除文档分类
   * 中间件：认证 + 参数校验（自动合并 body 和 params）
   */
  'DELETE /api/doc/categories/:id': withMiddleware(
    {
      auth: true,
      validate: validateDeleteDocCategoryRequest,
    },
    (req: Request, res: Response) =>
      docCategoryController.deleteDocCategory(req, res),
  ),

  // ---------- 批量操作 ----------

  /** 批量删除文档分类
   * 中间件：认证 + 参数校验（body）
   */
  'POST /api/doc/category/batch-delete': withMiddleware(
    {
      auth: true,
      validate: validateBatchDeleteDocCategoriesRequest,
    },
    (req: Request, res: Response) =>
      docCategoryController.batchDeleteDocCategories(req, res),
  ),

  /** 批量移动文档分类
   * 中间件：认证 + 参数校验（body）
   */
  'POST /api/doc/category/batch-move': withMiddleware(
    {
      auth: true,
      validate: validateBatchMoveDocCategoriesRequest,
    },
    (req: Request, res: Response) =>
      docCategoryController.batchMoveDocCategories(req, res),
  ),

  // ---------- 排序 ----------

  /** 保存文档分类排序
   * 中间件：认证 + 参数校验（body）
   */
  'POST /api/doc/category/sort': withMiddleware(
    {
      auth: true,
      validate: validateSaveDocCategorySortRequest,
    },
    (req: Request, res: Response) =>
      docCategoryController.saveDocCategorySort(req, res),
  ),
};
