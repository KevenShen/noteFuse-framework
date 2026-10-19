// mock/Doc/doc.controller.ts
// 文档 CRUD 控制器层
// 职责：接收文档核心 CRUD 相关的 HTTP 请求，调用 Service 处理业务逻辑，统一返回响应

import type { Request, Response } from 'express';
import { handleService } from '../../Core';
import type {
  CreateDocRequest,
  CreateDocResponse,
  DeleteDocResponse,
  GetDocDetailResponse,
  UpdateDocRequest,
  UpdateDocResponse,
} from './doc.dto';
import { docService } from './doc.service';

// ============================================================================
// 文档控制器
// ============================================================================

class DocController {
  // ==================== 创建文档 ====================

  /** 新建文档 */
  async createDoc(req: Request, res: Response): Promise<void> {
    const data = req.body as CreateDocRequest;

    await handleService<CreateDocResponse>(
      res,
      () =>
        docService.createDoc({
          project_id: Number(data.project_id),
          name: data.name,
          summary: data.summary,
          doc_category_id: data.doc_category_id
            ? Number(data.doc_category_id)
            : undefined,
          sort: data.sort ? Number(data.sort) : undefined,
          version_overview: data.version_overview,
          author_id: data.author_id ? Number(data.author_id) : 1,
          author_name: data.author_name || 'admin',
        }),
      '文档创建成功',
    );
  }

  // ==================== 获取文档详情 ====================

  /** 获取文档详情（含当前版本 content） */
  async getDocDetail(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const versionId = req.query.version ? Number(req.query.version) : undefined;

    await handleService<GetDocDetailResponse>(
      res,
      () => docService.getDocDetail(id, versionId),
      '获取成功',
    );
  }

  // ==================== 更新文档 ====================

  /** 更新文档（只更新文档基本信息） */
  async updateDoc(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const data = req.body as UpdateDocRequest;

    await handleService<UpdateDocResponse>(
      res,
      () =>
        docService.updateDoc(id, {
          name: data.name,
          summary: data.summary,
          doc_category_id: data.doc_category_id
            ? Number(data.doc_category_id)
            : undefined,
          sort: data.sort ? Number(data.sort) : undefined,
          version_overview: data.version_overview,
        }),
      '保存成功',
    );
  }

  // ==================== 删除文档 ====================

  /** 删除文档 */
  async deleteDoc(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);

    await handleService<DeleteDocResponse>(
      res,
      () => docService.deleteDoc(id),
      '文档删除成功',
    );
  }
}

// ============================================================================
// 导出控制器实例
// ============================================================================

export const docController = new DocController();
