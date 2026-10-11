/**
 * 文档版本管理控制器层
 *
 * 【职责】
 * - 解析文档版本相关的请求参数（params/query/body）
 * - 调用 service 层方法
 * - 使用 handleService 统一异常处理，返回标准响应格式
 * - 不处理业务逻辑，只做 HTTP 层的请求/响应处理
 */

import type { Request, Response } from 'express';
import { handleService } from '../../Core';
import * as docService from './docVersion.service';

// ==================== 文档版本管理 ====================

/**
 * 新建版本
 * POST /api/doc/:id/version
 */
export async function createDocVersion(
  req: Request,
  res: Response,
): Promise<void> {
  const docId = Number(req.params.id);

  await handleService(
    res,
    () =>
      docService.createDocVersion(docId, {
        content: req.body.content,
        remark: req.body.remark,
        version_name: req.body.version_name,
        version: req.body.version,
        status: req.body.status,
        base_version_id: req.body.base_version_id
          ? Number(req.body.base_version_id)
          : undefined,
        author_id: req.body.author_id ? Number(req.body.author_id) : 1,
        author_name: req.body.author_name || 'admin',
      }),
    '新版本创建成功',
  );
}

/**
 * 更新版本内容
 * PUT /api/doc/version/:versionId
 */
export async function updateDocVersion(
  req: Request,
  res: Response,
): Promise<void> {
  const versionId = Number(req.params.versionId);

  await handleService(
    res,
    () =>
      docService.updateDocVersion(versionId, {
        content: req.body.content,
        outline: req.body.outline,
        remark: req.body.remark,
      }),
    '版本更新成功',
  );
}

/**
 * 设为当前版本
 * PUT /api/doc/version/:versionId/set-current
 */
export async function setCurrentVersion(
  req: Request,
  res: Response,
): Promise<void> {
  const versionId = Number(req.params.versionId);

  await handleService(
    res,
    () => docService.setCurrentVersion(versionId),
    '已设为当前版本',
  );
}

/**
 * 保存版本原文（带标记，同时检测孤立批注）
 * PUT /api/doc/version/:id/content
 */
export async function saveVersionContent(
  req: Request,
  res: Response,
): Promise<void> {
  const versionId = Number(req.params.id);
  const { content } = req.body;

  await handleService(
    res,
    () => docService.saveVersionContent(versionId, content),
    '原文保存成功',
  );
}

/**
 * 删除版本（级联删除批注，禁止删除当前版本）
 * DELETE /api/doc/version/:versionId
 */
export async function deleteDocVersion(
  req: Request,
  res: Response,
): Promise<void> {
  const versionId = Number(req.params.versionId);

  await handleService(
    res,
    () => docService.deleteDocVersion(versionId),
    '版本删除成功',
  );
}
