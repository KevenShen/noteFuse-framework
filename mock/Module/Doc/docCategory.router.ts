/**
 * 文档分类管理路由层
 *
 * 【职责】
 * - 只包含文档分类相关的路由定义和中间件配置
 * - 不包含业务逻辑
 * - 将请求转发给 Controller 层
 */

import type { Request, Response } from 'express';
import { withMiddleware } from '../../Core/middleware';
import {
  batchDeleteDocCategories,
  batchMoveDocCategories,
  createDocCategory,
  deleteDocCategory,
  getAllDocCategories,
  getDocCategories,
  saveDocCategorySort,
  updateDocCategory,
} from './docCategory.controller';
import {
  validateBatchDeleteDocCategoriesRequest,
  validateBatchMoveDocCategoriesRequest,
  validateCreateDocCategoryRequest,
  validateGetAllDocCategoriesRequest,
  validateSaveDocCategorySortRequest,
  validateUpdateDocCategoryRequest,
} from './docCategory.validator';

// ==================== 文档分类管理 API 路由定义 ====================

export default {
  /** 获取文集下的文档分类列表 */
  'GET /api/doc/categories/:projectId': (req: Request, res: Response) =>
    getDocCategories(req, res),

  /** 新建文档分类
   * 中间件：参数校验（body）
   */
  'POST /api/doc/categories': withMiddleware(
    {
      validate: validateCreateDocCategoryRequest,
    },
    (req: Request, res: Response) => createDocCategory(req, res),
  ),

  /** 更新文档分类
   * 中间件：参数校验（body）
   */
  'PUT /api/doc/categories/:id': withMiddleware(
    {
      validate: validateUpdateDocCategoryRequest,
    },
    (req: Request, res: Response) => updateDocCategory(req, res),
  ),

  /** 删除文档分类 */
  'DELETE /api/doc/categories/:id': (req: Request, res: Response) =>
    deleteDocCategory(req, res),

  // ==================== 高级操作路由（参照 ProjectCategory） ====================

  /** 获取所有文档分类列表（跨文集，带文档数量）
   * 中间件：参数校验（query）
   */
  'GET /api/doc/categories': withMiddleware(
    {
      validate: validateGetAllDocCategoriesRequest,
      validateSource: 'query',
    },
    (req: Request, res: Response) => getAllDocCategories(req, res),
  ),

  /** 批量删除文档分类
   * 中间件：参数校验（body）
   */
  'POST /api/doc/category/batch-delete': withMiddleware(
    {
      validate: validateBatchDeleteDocCategoriesRequest,
    },
    (req: Request, res: Response) => batchDeleteDocCategories(req, res),
  ),

  /** 批量移动文档分类
   * 中间件：参数校验（body）
   */
  'POST /api/doc/category/batch-move': withMiddleware(
    {
      validate: validateBatchMoveDocCategoriesRequest,
    },
    (req: Request, res: Response) => batchMoveDocCategories(req, res),
  ),

  /** 保存文档分类排序
   * 中间件：参数校验（body）
   */
  'POST /api/doc/category/sort': withMiddleware(
    {
      validate: validateSaveDocCategorySortRequest,
    },
    (req: Request, res: Response) => saveDocCategorySort(req, res),
  ),
};
