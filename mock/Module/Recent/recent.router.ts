// mock/Module/Recent/recent.router.ts
// Recent 模块路由层
// 职责：定义路由，使用 withMiddleware 包装

import { recentController } from './recent.controller';
import { withAuth } from './middleware';

// ============================================================================
// Recent 路由定义
// ============================================================================

export default {
  // ---------- 最近使用文档列表（分页 + 时间筛选） ----------
  'GET /api/recent/docs': withAuth(recentController.getRecentDocs),

  // ---------- 最近创建的文档 ----------
  'GET /api/recent/created': withAuth(recentController.getRecentCreated),

  // ---------- 最近更新的文档 ----------
  'GET /api/recent/updated': withAuth(recentController.getRecentUpdated),

  // ---------- 最近浏览的文档（当前用户） ----------
  'GET /api/recent/browsed': withAuth(recentController.getRecentBrowsed),
};
