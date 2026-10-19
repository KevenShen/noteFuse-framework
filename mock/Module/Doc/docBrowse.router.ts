// mock/Doc/docBrowse.router.ts
// 文档浏览历史路由层
// 职责：定义文档浏览历史 API 路由，配置中间件，将请求转发给 Controller

import type { Request, Response } from 'express';
import { withMiddleware } from '../../Core/middleware';
import { docBrowseController } from './docBrowse.controller';
import { validateRecordDocBrowseRequest } from './docBrowse.validator';

// ==================== 文档浏览历史 API 路由定义 ====================

export default {
  // ---------- 记录浏览历史 ----------

  /** 记录文档浏览历史
   * 中间件：认证 + 参数校验（params）
   */
  'POST /api/doc/:id/browse': withMiddleware(
    {
      auth: true,
      validate: validateRecordDocBrowseRequest,
    },
    (req: Request, res: Response) => docBrowseController.recordDocBrowse(req, res),
  ),
};
