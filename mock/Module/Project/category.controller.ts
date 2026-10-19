// mock/Project/category.controller.ts
// 分类控制器层
// 职责：接收分类相关的 HTTP 请求，调用 Service 处理业务逻辑，统一返回响应
// 【控制器层】只包含请求处理和响应格式化

import type { Request, Response } from 'express';
import { delay, handleService } from '../../Core';
import type {
  BatchDeleteCategoriesRequest,
  BatchDeleteCategoriesResponse,
  BatchMoveCategoriesRequest,
  BatchMoveCategoriesResponse,
  CreateCategoryRequest,
  CreateCategoryResponse,
  DeleteCategoryResponse,
  GetCategoryListResponse,
  SaveCategorySortRequest,
  SaveCategorySortResponse,
  UpdateCategoryRequest,
  UpdateCategoryResponse,
} from './category.dto';
import { categoryService } from './category.service';

/**
 * 分类控制器
 * 职责：接收请求，调用 Service，返回响应
 */
class CategoryController {
  // ==================== 分类高级操作 ====================

  /** 获取分类列表（统一带统计字段：project_count + project_ids） */
  async getCategoryList(_req: Request, res: Response) {
    await delay(100);
    // parent_id/keyword 预留，当前 service 返回全量后前端过滤
    await handleService<GetCategoryListResponse>(
      res,
      () => categoryService.getCategoryList(),
      '获取成功',
    );
  }

  /** 创建分类（自动计算 sort） */
  async createCategory(req: Request, res: Response) {
    await delay(200);
    const data = req.body as CreateCategoryRequest;
    await handleService<CreateCategoryResponse>(
      res,
      () => categoryService.createCategory(data),
      '创建成功',
    );
  }

  /** 更新分类 */
  async updateCategory(req: Request, res: Response) {
    await delay(300);
    const id = Number(req.params.id);
    const data = req.body as UpdateCategoryRequest;
    await handleService<UpdateCategoryResponse>(
      res,
      () => categoryService.updateCategory(id, data),
      '更新成功',
    );
  }

  /** 删除分类（含校验） */
  async deleteCategory(req: Request, res: Response) {
    await delay(200);
    // ID 已由 validateParams 中间件校验，直接使用
    const id = Number(req.params.id);
    await handleService<DeleteCategoryResponse>(
      res,
      () => categoryService.deleteCategory(id),
      '删除成功',
    );
  }

  /** 批量删除分类 */
  async batchDeleteCategories(req: Request, res: Response) {
    await delay(300);
    const data = req.body as BatchDeleteCategoriesRequest;
    await handleService<BatchDeleteCategoriesResponse>(
      res,
      () => categoryService.batchDeleteCategories(data),
      '批量删除成功',
    );
  }

  /** 批量移动分类 */
  async batchMoveCategories(req: Request, res: Response) {
    await delay(300);
    const data = req.body as BatchMoveCategoriesRequest;
    await handleService<BatchMoveCategoriesResponse>(
      res,
      () => categoryService.batchMoveCategories(data),
      '批量移动成功',
    );
  }

  /** 保存分类排序 */
  async saveCategorySort(req: Request, res: Response) {
    await delay(200);
    const data = req.body as SaveCategorySortRequest;
    await handleService<SaveCategorySortResponse>(
      res,
      () => categoryService.saveCategorySort(data),
      '排序保存成功',
    );
  }
}

export const categoryController = new CategoryController();
