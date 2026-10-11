/**
 * 文档分类管理控制器层
 *
 * 【职责】
 * - 解析文档分类相关的请求参数（params/query/body）
 * - 调用 service 层方法
 * - 使用 handleService 统一异常处理，返回标准响应格式
 * - 不处理业务逻辑，只做 HTTP 层的请求/响应处理
 */

import type { Request, Response } from 'express';
import { delay, handleService } from '../../Core';
import * as docService from './docCategory.service';

// ==================== 文档分类管理 ====================

/**
 * 获取文集下的文档分类列表
 * GET /api/doc/categories/:projectId
 */
export async function getDocCategories(
  req: Request,
  res: Response,
): Promise<void> {
  const projectId = Number(req.params.projectId);

  await handleService(
    res,
    () => docService.getDocCategories(projectId),
    '获取成功',
  );
}

/**
 * 新建文档分类
 * POST /api/doc/categories
 *
 * 【参数校验】HTTP 层职责，在控制器中完成
 * - project_id：必填，文集 ID
 * - name：必填，分类名称
 */
export async function createDocCategory(
  req: Request,
  res: Response,
): Promise<void> {
  // ========== 参数校验（HTTP 层职责） ==========
  const { project_id, name } = req.body;
  if (!project_id || !name) {
    res.status(400).json({
      success: false,
      errorCode: 400,
      message: '请填写完整的分类信息（project_id 和 name 为必填项）',
      data: null,
    });
    return;
  }

  await handleService(
    res,
    () =>
      docService.createDocCategory({
        project_id: Number(project_id),
        name,
        parent_id: req.body.parent_id ? Number(req.body.parent_id) : 0,
        sort: req.body.sort ? Number(req.body.sort) : undefined,
        icon: req.body.icon,
      }),
    '分类创建成功',
  );
}

/**
 * 更新文档分类
 * PUT /api/doc/categories/:id
 *
 * 【参数校验】HTTP 层职责，在控制器中完成
 * - id：必填，分类 ID
 * - 检查分类是否存在：在 Service 层完成（Service 层本来就需要获取分类信息判断字段变更，避免重复查询）
 */
export async function updateDocCategory(
  req: Request,
  res: Response,
): Promise<void> {
  const id = Number(req.params.id);

  await handleService(
    res,
    () =>
      docService.updateDocCategory(id, {
        name: req.body.name,
        parent_id: req.body.parent_id ? Number(req.body.parent_id) : undefined,
        sort: req.body.sort ? Number(req.body.sort) : undefined,
        icon: req.body.icon,
      }),
    '分类更新成功',
  );
}

/**
 * 删除文档分类
 * DELETE /api/doc/categories/:id
 */
export async function deleteDocCategory(
  req: Request,
  res: Response,
): Promise<void> {
  const id = Number(req.params.id);

  await handleService(
    res,
    () => docService.deleteDocCategory(id),
    '分类删除成功',
  );
}


// ==================== 高级操作控制器（参照 ProjectCategory） ====================

/**
 * 获取所有文档分类列表（跨文集，带文档数量）
 * GET /api/doc/categories
 */
export async function getAllDocCategories(
  req: Request,
  res: Response,
): Promise<void> {
  await delay(100);
  const { project_id, keyword } = req.query;
  await handleService(
    res,
    () =>
      docService.getAllDocCategoriesWithDocCount({
        project_id: project_id ? Number(project_id) : undefined,
        keyword: keyword ? String(keyword) : undefined,
      }),
    '获取成功',
  );
}

/**
 * 批量删除文档分类
 * POST /api/doc/category/batch-delete
 */
export async function batchDeleteDocCategories(
  req: Request,
  res: Response,
): Promise<void> {
  await delay(300);
  await handleService(
    res,
    () => docService.batchDeleteDocCategories(req.body),
    '批量删除成功',
  );
}

/**
 * 批量移动文档分类
 * POST /api/doc/category/batch-move
 */
export async function batchMoveDocCategories(
  req: Request,
  res: Response,
): Promise<void> {
  await delay(300);
  await handleService(
    res,
    () => docService.batchMoveDocCategories(req.body),
    '批量移动成功',
  );
}

/**
 * 保存文档分类排序
 * POST /api/doc/category/sort
 */
export async function saveDocCategorySort(
  req: Request,
  res: Response,
): Promise<void> {
  await delay(200);
  await handleService(
    res,
    () => docService.saveDocCategorySort(req.body),
    '排序保存成功',
  );
}
