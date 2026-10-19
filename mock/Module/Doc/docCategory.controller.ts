// mock/Doc/docCategory.controller.ts
// 文档分类管理控制器层
// 职责：接收文档分类相关的 HTTP 请求，调用 Service 处理业务逻辑，统一返回响应

import type { Request, Response } from 'express';
import { delay, handleService } from '../../Core';
import type {
  BatchDeleteDocCategoriesRequest,
  BatchDeleteDocCategoriesResponse,
  BatchMoveDocCategoriesRequest,
  BatchMoveDocCategoriesResponse,
  CreateDocCategoryRequest,
  CreateDocCategoryResponse,
  DeleteDocCategoryResponse,
  GetAllDocCategoriesRequest,
  GetDocCategoriesWithStatsResponse,
  SaveDocCategorySortRequest,
  SaveDocCategorySortResponse,
  UpdateDocCategoryRequest,
  UpdateDocCategoryResponse,
} from './docCategory.dto';
import { docCategoryService } from './docCategory.service';

// ============================================================================
// 文档分类控制器
// ============================================================================

class DocCategoryController {
  // ==================== 获取分类 ====================

  /** 获取文集下的文档分类列表（带文档数量） */
  async getDocCategories(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.projectId);

    await handleService<GetDocCategoriesWithStatsResponse>(
      res,
      () =>
        docCategoryService.getAllDocCategoriesWithDocCount({
          project_id: projectId,
        }),
      '获取成功',
    );
  }

  /** 获取所有文档分类列表（跨文集，带文档数量） */
  async getAllDocCategories(req: Request, res: Response): Promise<void> {
    await delay(100);
    const { project_id, keyword } = req.query as GetAllDocCategoriesRequest;

    await handleService<GetDocCategoriesWithStatsResponse>(
      res,
      () =>
        docCategoryService.getAllDocCategoriesWithDocCount({
          project_id: project_id ? Number(project_id) : undefined,
          keyword: keyword ? String(keyword) : undefined,
        }),
      '获取成功',
    );
  }

  // ==================== 创建分类 ====================

  /** 新建文档分类 */
  async createDocCategory(req: Request, res: Response): Promise<void> {
    const data = req.body as CreateDocCategoryRequest;

    await handleService<CreateDocCategoryResponse>(
      res,
      () =>
        docCategoryService.createDocCategory({
          project_id: Number(data.project_id),
          name: data.name,
          parent_id: data.parent_id ? Number(data.parent_id) : 0,
          sort: data.sort ? Number(data.sort) : undefined,
          icon: data.icon,
        }),
      '分类创建成功',
    );
  }

  // ==================== 更新分类 ====================

  /** 更新文档分类 */
  async updateDocCategory(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const data = req.body as UpdateDocCategoryRequest;

    await handleService<UpdateDocCategoryResponse>(
      res,
      () =>
        docCategoryService.updateDocCategory(id, {
          name: data.name,
          parent_id: data.parent_id ? Number(data.parent_id) : undefined,
          sort: data.sort ? Number(data.sort) : undefined,
          icon: data.icon,
        }),
      '分类更新成功',
    );
  }

  // ==================== 删除分类 ====================

  /** 删除文档分类 */
  async deleteDocCategory(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);

    await handleService<DeleteDocCategoryResponse>(
      res,
      () => docCategoryService.deleteDocCategory(id),
      '分类删除成功',
    );
  }

  // ==================== 批量操作 ====================

  /** 批量删除文档分类 */
  async batchDeleteDocCategories(req: Request, res: Response): Promise<void> {
    await delay(300);
    const data = req.body as BatchDeleteDocCategoriesRequest;

    await handleService<BatchDeleteDocCategoriesResponse>(
      res,
      () => docCategoryService.batchDeleteDocCategories(data),
      '批量删除成功',
    );
  }

  /** 批量移动文档分类 */
  async batchMoveDocCategories(req: Request, res: Response): Promise<void> {
    await delay(300);
    const data = req.body as BatchMoveDocCategoriesRequest;

    await handleService<BatchMoveDocCategoriesResponse>(
      res,
      () => docCategoryService.batchMoveDocCategories(data),
      '批量移动成功',
    );
  }

  // ==================== 保存排序 ====================

  /** 保存文档分类排序 */
  async saveDocCategorySort(req: Request, res: Response): Promise<void> {
    await delay(200);
    const data = req.body as SaveDocCategorySortRequest;

    await handleService<SaveDocCategorySortResponse>(
      res,
      () => docCategoryService.saveDocCategorySort(data),
      '排序保存成功',
    );
  }
}

// ============================================================================
// 导出控制器实例
// ============================================================================

export const docCategoryController = new DocCategoryController();
