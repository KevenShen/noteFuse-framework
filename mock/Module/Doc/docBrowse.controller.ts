/**
 * 文档浏览历史控制器层
 *
 * 【职责】
 * - 解析文档浏览历史相关的请求参数（params/query/body）
 * - 调用 service 层方法
 * - 使用 handleService 统一异常处理，返回标准响应格式
 * - 不处理业务逻辑，只做 HTTP 层的请求/响应处理
 */

import type { Request, Response } from 'express';
import { handleService } from '../../Core';
import * as docService from './docBrowse.service';

// ==================== 文档浏览历史 ====================

/**
 * 记录文档浏览历史
 * POST /api/doc/:id/browse
 */
export async function recordDocBrowse(
  req: Request,
  res: Response,
): Promise<void> {
  const docId = Number(req.params.id);
  const userId = req.body.user_id ? Number(req.body.user_id) : 1;

  await handleService(
    res,
    () => docService.recordDocBrowse(docId, userId),
    '记录成功',
  );
}
