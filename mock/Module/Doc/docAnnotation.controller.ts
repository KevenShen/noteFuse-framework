/**
 * 文档批注管理控制器层
 *
 * 【职责】
 * - 解析文档批注相关的请求参数（params/query/body）
 * - 调用 service 层方法
 * - 使用 handleService 统一异常处理，返回标准响应格式
 * - 不处理业务逻辑，只做 HTTP 层的请求/响应处理
 */

import type { Request, Response } from 'express';
import { handleService } from '../../Core';
import * as docService from './docAnnotation.service';

// ==================== 文档批注管理 ====================

/**
 * 获取版本的批注列表
 * GET /api/doc/version/:id/annotations
 */
export async function getVersionAnnotations(
  req: Request,
  res: Response,
): Promise<void> {
  const versionId = Number(req.params.id);

  await handleService(
    res,
    () => docService.getVersionAnnotations(versionId),
    '获取成功',
  );
}

/**
 * 添加批注
 * POST /api/doc/version/:id/annotations
 */
export async function addAnnotation(
  req: Request,
  res: Response,
): Promise<void> {
  const versionId = Number(req.params.id);

  await handleService(
    res,
    () =>
      docService.addAnnotation(versionId, {
        marker_id: Number(req.body.marker_id),
        content: req.body.content,
        content_with_marker: req.body.content_with_marker,
        author_id: req.body.author_id ? Number(req.body.author_id) : 1,
        author_name: req.body.author_name || 'admin',
      }),
    '批注添加成功',
  );
}

/**
 * 更新批注
 * PUT /api/doc/annotation/:id
 */
export async function updateAnnotation(
  req: Request,
  res: Response,
): Promise<void> {
  const annotationId = Number(req.params.id);
  const { content } = req.body;

  await handleService(
    res,
    () => docService.updateAnnotation(annotationId, content),
    '批注更新成功',
  );
}

/**
 * 删除批注
 * DELETE /api/doc/annotation/:id
 */
export async function deleteAnnotation(
  req: Request,
  res: Response,
): Promise<void> {
  const annotationId = Number(req.params.id);
  const { content_without_marker } = req.body;

  await handleService(
    res,
    () => docService.deleteAnnotation(annotationId, content_without_marker),
    '批注删除成功',
  );
}
