// mock/Doc/docAnnotation.controller.ts
// 文档批注管理控制器层
// 职责：接收文档批注相关的 HTTP 请求，调用 Service 处理业务逻辑，统一返回响应

import type { Request, Response } from 'express';
import { handleService } from '../../Core';
import type {
  AddAnnotationRequest,
  AddAnnotationResponse,
  DeleteAnnotationRequest,
  DeleteAnnotationResponse,
  GetVersionAnnotationsResponse,
  UpdateAnnotationRequest,
  UpdateAnnotationResponse,
} from './docAnnotation.dto';
import { docAnnotationService } from './docAnnotation.service';

// ============================================================================
// 文档批注控制器
// ============================================================================

class DocAnnotationController {
  // ==================== 获取批注 ====================

  /** 获取版本的批注列表 */
  async getVersionAnnotations(req: Request, res: Response): Promise<void> {
    const versionId = Number(req.params.id);

    await handleService<GetVersionAnnotationsResponse>(
      res,
      () => docAnnotationService.getVersionAnnotations(versionId),
      '获取成功',
    );
  }

  // ==================== 添加批注 ====================

  /** 添加批注（同时保存带标记的原文） */
  async addAnnotation(req: Request, res: Response): Promise<void> {
    const versionId = Number(req.params.id);
    const data = req.body as AddAnnotationRequest;

    await handleService<AddAnnotationResponse>(
      res,
      () =>
        docAnnotationService.addAnnotation(versionId, {
          marker_id: Number(data.marker_id),
          content: data.content,
          content_with_marker: data.content_with_marker,
          author_id: data.author_id ? Number(data.author_id) : 1,
          author_name: data.author_name || 'admin',
        }),
      '批注添加成功',
    );
  }

  // ==================== 更新批注 ====================

  /** 更新批注 */
  async updateAnnotation(req: Request, res: Response): Promise<void> {
    const annotationId = Number(req.params.id);
    const data = req.body as UpdateAnnotationRequest;

    await handleService<UpdateAnnotationResponse>(
      res,
      () => docAnnotationService.updateAnnotation(annotationId, data.content),
      '批注更新成功',
    );
  }

  // ==================== 删除批注 ====================

  /** 删除批注（同时删除原文中的标记） */
  async deleteAnnotation(req: Request, res: Response): Promise<void> {
    const annotationId = Number(req.params.id);
    const data = req.body as DeleteAnnotationRequest;

    await handleService<DeleteAnnotationResponse>(
      res,
      () =>
        docAnnotationService.deleteAnnotation(
          annotationId,
          data.content_without_marker,
        ),
      '批注删除成功',
    );
  }
}

// ============================================================================
// 导出控制器实例
// ============================================================================

export const docAnnotationController = new DocAnnotationController();
