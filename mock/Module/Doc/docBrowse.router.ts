/**
 * 文档浏览历史路由层
 *
 * 【职责】
 * - 只包含文档浏览历史相关的路由定义和中间件配置
 * - 不包含业务逻辑
 * - 将请求转发给 Controller 层
 */

import type { Request, Response } from 'express';
import { recordDocBrowse } from './docBrowse.controller';

// ==================== 文档浏览历史 API 路由定义 ====================

export default {
  /** 记录文档浏览历史 */
  'POST /api/doc/:id/browse': (req: Request, res: Response) =>
    recordDocBrowse(req, res),
};
