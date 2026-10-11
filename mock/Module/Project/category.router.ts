// mock/Project/category.ts
// 文集分类路由层
// 职责：定义分类 API 路由，配置中间件，将请求转发给 Controller
// 【路由层】只包含路由定义和中间件配置，不包含业务逻辑

import type { Request, Response } from 'express';
import { withMiddleware } from '../../Core/middleware';
import { categoryController } from './category.controller';
import {
  validateBatchDeleteCategoriesRequest,
  validateBatchMoveCategoriesRequest,
  validateCreateCategoryRequest,
  validateGetCategoryListRequest,
  validateSaveCategorySortRequest,
  validateUpdateCategoryRequest,
} from './category.validator';

// ==================== 分类 API 路由定义 ====================

export default {
  // ---------- 分类列表 ----------

  /** 获取分类列表（含后代文档数汇总）
   * 中间件：无（公开接口），参数校验（query）
   */
  'GET /api/project/categories': withMiddleware(
    {
      validate: validateGetCategoryListRequest,
      validateSource: 'query',
    },
    (req: Request, res: Response) =>
      categoryController.getCategoryListWithProjectCount(req, res),
  ),

  // ---------- 创建分类 ----------

  /** 创建分类（自动计算 sort）
   * 中间件：认证 + 参数校验（body）
   */
  'POST /api/project/category': withMiddleware(
    {
      auth: true,
      validate: validateCreateCategoryRequest,
    },
    (req: Request, res: Response) =>
      categoryController.createCategoryAdvanced(req, res),
  ),

  // ---------- 更新分类 ----------

  /** 更新分类
   * 中间件：认证 + 参数校验（body）
   */
  'PUT /api/project/category/:id': withMiddleware(
    {
      auth: true,
      validate: validateUpdateCategoryRequest,
    },
    (req: Request, res: Response) =>
      categoryController.updateCategory(req, res),
  ),

  // ---------- 删除分类 ----------

  /** 删除分类（含校验：存在子分类或文集时禁止删除）
   * 中间件：认证（ID 在 params 中，无需 body 校验）
   */
  'DELETE /api/project/category/:id': withMiddleware(
    {
      auth: true,
    },
    (req: Request, res: Response) =>
      categoryController.deleteCategoryWithCheck(req, res),
  ),

  // ---------- 批量操作 ----------

  /** 批量删除分类（逐个校验，选中的子分类允许级联删除）
   * 中间件：认证 + 参数校验（body）
   */
  'POST /api/project/category/batch-delete': withMiddleware(
    {
      auth: true,
      validate: validateBatchDeleteCategoriesRequest,
    },
    (req: Request, res: Response) =>
      categoryController.batchDeleteCategories(req, res),
  ),

  /** 批量移动分类（防止移动到自己的子分类下）
   * 中间件：认证 + 参数校验（body）
   */
  'POST /api/project/category/batch-move': withMiddleware(
    {
      auth: true,
      validate: validateBatchMoveCategoriesRequest,
    },
    (req: Request, res: Response) =>
      categoryController.batchMoveCategories(req, res),
  ),

  // ---------- 排序 ----------
  /** 保存分类排序（支持扁平化数据）
   * 中间件：认证 + 参数校验（body）
   */
  'POST /api/project/category/sort': withMiddleware(
    {
      auth: true,
      validate: validateSaveCategorySortRequest,
    },
    (req: Request, res: Response) =>
      categoryController.saveCategorySort(req, res),
  ),
};
