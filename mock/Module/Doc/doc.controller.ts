/**
 * 文档 CRUD 控制器层
 *
 * 【职责】
 * - 解析文档核心 CRUD 相关的请求参数（params/query/body）
 * - 调用 service 层方法
 * - 使用 handleService 统一异常处理，返回标准响应格式
 * - 不处理业务逻辑，只做 HTTP 层的请求/响应处理
 */

import type { Request, Response } from 'express';
import { handleService } from '../../Core';
import * as docService from './doc.service';

// ==================== 文档 CRUD ====================

/**
 * 新建文档
 * POST /api/doc/create
 *
 * 【参数校验】HTTP 层职责，在控制器中完成
 * - project_id：必填，文集 ID
 * - name：必填，文档名称
 */
export async function createDoc(req: Request, res: Response): Promise<void> {
  // ========== 参数校验（HTTP 层职责） ==========
  const { project_id, name } = req.body;
  if (!project_id || !name) {
    res.status(400).json({
      success: false,
      errorCode: 400,
      message: '请填写完整的文档信息（project_id 和 name 为必填项）',
      data: null,
    });
    return;
  }

  await handleService(
    res,
    () =>
      docService.createDoc({
        project_id: Number(project_id),
        name,
        summary: req.body.summary,
        doc_category_id: req.body.doc_category_id
          ? Number(req.body.doc_category_id)
          : undefined,
        sort: req.body.sort ? Number(req.body.sort) : undefined,
        version_overview: req.body.version_overview,
        author_id: req.body.author_id ? Number(req.body.author_id) : 1,
        author_name: req.body.author_name || 'admin',
      }),
    '文档创建成功',
  );
}

/**
 * 获取文档详情（含当前版本 content）
 * GET /api/doc/:id
 */
export async function getDocDetail(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const versionId = req.query.version ? Number(req.query.version) : undefined;

  await handleService(
    res,
    () => docService.getDocDetail(id, versionId),
    '获取成功',
  );
}

/**
 * 更新文档（只更新文档基本信息，版本内容更新请使用 updateDocVersion 接口）
 * PUT /api/doc/:id
 */
export async function updateDoc(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);

  await handleService(
    res,
    () =>
      docService.updateDoc(id, {
        name: req.body.name,
        summary: req.body.summary,
        doc_category_id: req.body.doc_category_id
          ? Number(req.body.doc_category_id)
          : undefined,
        sort: req.body.sort ? Number(req.body.sort) : undefined,
        version_overview: req.body.version_overview,
      }),
    '保存成功',
  );
}

/**
 * 删除文档
 * DELETE /api/doc/:id
 */
export async function deleteDoc(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);

  await handleService(res, () => docService.deleteDoc(id), '文档删除成功');
}
