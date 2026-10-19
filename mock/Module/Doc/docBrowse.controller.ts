// mock/Doc/docBrowse.controller.ts
// 文档浏览历史控制器层
// 职责：接收文档浏览历史相关的 HTTP 请求，调用 Service 处理业务逻辑，统一返回响应

import type { Request, Response } from 'express';
import { handleService } from '../../Core';
import type { RecordDocBrowseResponse } from './docBrowse.dto';
import { docBrowseService } from './docBrowse.service';

// ============================================================================
// 文档浏览历史控制器
// ============================================================================

class DocBrowseController {
  // ==================== 记录浏览历史 ====================

  /** 记录文档浏览历史 */
  async recordDocBrowse(req: Request, res: Response): Promise<void> {
    const docId = Number(req.params.id);
    const userId = req.body.user_id ? Number(req.body.user_id) : 1;

    await handleService<RecordDocBrowseResponse>(
      res,
      () => docBrowseService.recordDocBrowse(docId, userId),
      '记录成功',
    );
  }
}

// ============================================================================
// 导出控制器实例
// ============================================================================

export const docBrowseController = new DocBrowseController();
