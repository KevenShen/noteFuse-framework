// mock/Doc/docVersion.controller.ts
// 文档版本管理控制器层
// 职责：接收文档版本相关的 HTTP 请求，调用 Service 处理业务逻辑，统一返回响应

import type { Request, Response } from 'express';
import { handleService } from '../../Core';
import type {
  CreateDocVersionRequest,
  CreateDocVersionResponse,
  DeleteDocVersionResponse,
  SaveVersionContentRequest,
  SaveVersionContentResponse,
  SetCurrentVersionResponse,
  UpdateDocVersionRequest,
  UpdateDocVersionResponse,
} from './docVersion.dto';
import { docVersionService } from './docVersion.service';

// ============================================================================
// 文档版本控制器
// ============================================================================

class DocVersionController {
  // ==================== 创建版本 ====================

  /** 新建版本 */
  async createDocVersion(req: Request, res: Response): Promise<void> {
    const docId = Number(req.params.id);
    const data = req.body as CreateDocVersionRequest;

    await handleService<CreateDocVersionResponse>(
      res,
      () =>
        docVersionService.createDocVersion(docId, {
          content: data.content,
          remark: data.remark,
          version_name: data.version_name,
          version: data.version,
          status: data.status,
          base_version_id: data.base_version_id
            ? Number(data.base_version_id)
            : undefined,
          author_id: data.author_id ? Number(data.author_id) : 1,
          author_name: data.author_name || 'admin',
        }),
      '新版本创建成功',
    );
  }

  // ==================== 更新版本 ====================

  /** 更新版本内容（支持 content、outline、remark） */
  async updateDocVersion(req: Request, res: Response): Promise<void> {
    const versionId = Number(req.params.versionId);
    const data = req.body as UpdateDocVersionRequest;

    await handleService<UpdateDocVersionResponse>(
      res,
      () =>
        docVersionService.updateDocVersion(versionId, {
          content: data.content,
          outline: data.outline,
          remark: data.remark,
        }),
      '版本更新成功',
    );
  }

  // ==================== 设为当前版本 ====================

  /** 设为当前版本 */
  async setCurrentVersion(req: Request, res: Response): Promise<void> {
    const versionId = Number(req.params.versionId);

    await handleService<SetCurrentVersionResponse>(
      res,
      () => docVersionService.setCurrentVersion(versionId),
      '已设为当前版本',
    );
  }

  // ==================== 保存版本原文 ====================

  /** 保存版本原文（带标记，同时检测孤立批注） */
  async saveVersionContent(req: Request, res: Response): Promise<void> {
    const versionId = Number(req.params.id);
    const data = req.body as SaveVersionContentRequest;

    await handleService<SaveVersionContentResponse>(
      res,
      () => docVersionService.saveVersionContent(versionId, data.content),
      '原文保存成功',
    );
  }

  // ==================== 删除版本 ====================

  /** 删除版本（级联删除批注，禁止删除当前版本） */
  async deleteDocVersion(req: Request, res: Response): Promise<void> {
    const versionId = Number(req.params.versionId);

    await handleService<DeleteDocVersionResponse>(
      res,
      () => docVersionService.deleteDocVersion(versionId),
      '版本删除成功',
    );
  }
}

// ============================================================================
// 导出控制器实例
// ============================================================================

export const docVersionController = new DocVersionController();
