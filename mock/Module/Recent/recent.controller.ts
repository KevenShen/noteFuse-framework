// mock/Module/Recent/recent.controller.ts
// Recent 模块控制器层
// 职责：处理请求响应，调用 service 层，返回数据

import type { Request, Response } from 'express';
import { delay, success, fail, BusinessError } from '../../Core';
import { getCurrentUserFromToken } from '../../Core/auth';
import type { GetRecentDocsRequest } from './recent.dto';
import { validateGetRecentDocs, validatePaginationRequest } from './recent.validator';
import { recentService } from './recent.service';

/** 从请求 token 中获取当前用户 ID，兜底 1（mock 环境） */
const getUserId = async (req: Request): Promise<number> => {
  const user = await getCurrentUserFromToken(req);
  return user?.id || 1;
};

// ============================================================================
// Recent 控制器
// ============================================================================

export const recentController = {
  // ---------- 最近使用文档列表（分页 + 时间筛选） ----------
  async getRecentDocs(req: Request, res: Response): Promise<void> {
    await delay(150);
    const data = req.query as unknown as GetRecentDocsRequest;

    // 参数校验
    const error = validateGetRecentDocs(data);
    if (error) {
      res.json(fail(error, 400));
      return;
    }

    const userId = await getUserId(req);
    const result = await recentService.getRecentDocs(userId, data);
    res.json(success(result));
  },

  // ---------- 最近创建的文档 ----------
  async getRecentCreated(req: Request, res: Response): Promise<void> {
    await delay(200);
    const data = req.query as unknown as { page?: number; page_size?: number };

    // 参数校验
    const error = validatePaginationRequest(data);
    if (error) {
      res.json(fail(error, 400));
      return;
    }

    const userId = await getUserId(req);
    const result = await recentService.getRecentCreated(userId, data);
    res.json(success(result));
  },

  // ---------- 最近更新的文档 ----------
  async getRecentUpdated(req: Request, res: Response): Promise<void> {
    await delay(200);
    const data = req.query as unknown as { page?: number; page_size?: number };

    // 参数校验
    const error = validatePaginationRequest(data);
    if (error) {
      res.json(fail(error, 400));
      return;
    }

    const userId = await getUserId(req);
    const result = await recentService.getRecentUpdated(userId, data);
    res.json(success(result));
  },

  // ---------- 最近浏览的文档（当前用户） ----------
  async getRecentBrowsed(req: Request, res: Response): Promise<void> {
    await delay(200);
    const data = req.query as unknown as { page?: number; page_size?: number };

    // 参数校验
    const error = validatePaginationRequest(data);
    if (error) {
      res.json(fail(error, 400));
      return;
    }

    const userId = await getUserId(req);
    const result = await recentService.getRecentBrowsed(userId, data);
    res.json(success(result));
  },
};
