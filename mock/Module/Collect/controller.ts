/**
 * 收藏模块 Controller 层（控制器层）
 *
 * 【文件职责】
 * 接收 HTTP 请求，调用 Service 处理业务逻辑，统一返回响应
 *
 * 【六层架构】
 * 1. 路由层（index.ts）：只做路由定义，使用 withMiddleware 包装
 * 2. 控制器层（controller.ts）：处理请求响应，使用 handleService 统一异常
 * 3. 服务层（service.ts）：业务逻辑，返回数据，抛出 BusinessError
 * 4. 数据访问层：L1 MockTable / L2 MongoDB / L3 Redis
 * 5. 实体层（Entities/collect.ts）：类型定义、初始数据、表实例
 * 6. 通用层（Core/）：通用工具、中间件、异常处理
 *
 * 【控制器层职责】
 * - 解析请求参数（params/query/body）
 * - 从 token 中获取当前用户 ID
 * - 调用 service 层方法
 * - 使用 handleService 统一异常处理，返回标准响应格式
 * - 不处理业务逻辑，只做 HTTP 层的请求/响应处理
 */

import type { Request, Response } from 'express';
import { delay, handleService } from '../../Core';
import type { CollectType } from '../../Entities/collect';
import type {
  CheckCollectedRequest,
  CheckCollectedResponse,
  CreateCollectGroupRequest,
  CreateCollectGroupResponse,
  CreateCollectRequest,
  CreateCollectResponse,
  DeleteCollectGroupResponse,
  DeleteCollectResponse,
  GetCollectGroupsResponse,
  GetCollectListResponse,
  MoveCollectRequest,
  MoveCollectResponse,
  UpdateCollectGroupRequest,
  UpdateCollectGroupResponse,
} from './dto';
import * as collectService from './service';

/**
 * 从请求 token 中获取当前用户 ID，兜底 1（mock 环境）
 *
 * 【注意】
 * 这里使用 require 动态导入，避免循环依赖问题
 */
const getUserId = async (req: Request): Promise<number> => {
  try {
    const { getCurrentUserFromToken } = require('../../Core/auth');
    const user = await getCurrentUserFromToken(req);
    return user?.id || 1;
  } catch (error) {
    return 1;
  }
};

/**
 * 收藏控制器
 *
 * 职责：接收请求，调用 Service，返回响应
 * 注意：权限校验和参数校验由中间件处理，控制器只关注业务逻辑和异常捕获
 */
class CollectController {
  // ==================== 收藏分组相关 ====================

  /**
   * 获取收藏分组列表
   * GET /api/collect/groups
   */
  async getCollectGroups(req: Request, res: Response): Promise<void> {
    await delay(200);
    const userId = await getUserId(req);
    const data = {
      type: req.query.type as CollectType | undefined,
    };
    await handleService<GetCollectGroupsResponse>(res, () =>
      collectService.getCollectGroups(userId, data),
    );
  }

  /**
   * 新建收藏分组
   * POST /api/collect/group
   */
  async createCollectGroup(req: Request, res: Response): Promise<void> {
    await delay(200);
    const userId = await getUserId(req);
    const data = req.body as CreateCollectGroupRequest;
    await handleService<CreateCollectGroupResponse>(
      res,
      () => collectService.createCollectGroup(userId, data),
      '分组创建成功',
    );
  }

  /**
   * 更新收藏分组
   * PUT /api/collect/group/:id
   */
  async updateCollectGroup(req: Request, res: Response): Promise<void> {
    await delay(200);
    const groupId = Number(req.params.id);
    const data = req.body as UpdateCollectGroupRequest;
    await handleService<UpdateCollectGroupResponse>(
      res,
      () => collectService.updateCollectGroup(groupId, data),
      '分组更新成功',
    );
  }

  /**
   * 删除收藏分组
   * DELETE /api/collect/group/:id
   */
  async deleteCollectGroup(req: Request, res: Response): Promise<void> {
    await delay(200);
    const groupId = Number(req.params.id);
    await handleService<DeleteCollectGroupResponse>(
      res,
      () => collectService.deleteCollectGroup(groupId),
      '分组删除成功',
    );
  }

  // ==================== 收藏记录相关 ====================

  /**
   * 获取收藏列表（支持类型筛选、分组筛选、关键词、分页）
   * GET /api/collect
   */
  async getCollectList(req: Request, res: Response): Promise<void> {
    await delay(200);
    const userId = await getUserId(req);
    const data = {
      page: req.query.page ? Number(req.query.page) : undefined,
      page_size: req.query.page_size ? Number(req.query.page_size) : undefined,
      group_id: req.query.group_id ? Number(req.query.group_id) : undefined,
      keyword: req.query.keyword as string | undefined,
      type: req.query.type as CollectType | undefined,
    };
    await handleService<GetCollectListResponse>(res, () =>
      collectService.getCollectList(userId, data),
    );
  }

  /**
   * 添加收藏（统一接口，type 区分文档/文集）
   * POST /api/collect
   */
  async createCollect(req: Request, res: Response): Promise<void> {
    await delay(200);
    const userId = await getUserId(req);
    const data = req.body as CreateCollectRequest;
    await handleService<CreateCollectResponse>(
      res,
      () => collectService.createCollect(userId, data),
      '收藏成功',
    );
  }

  /**
   * 取消收藏
   * DELETE /api/collect/:id
   */
  async deleteCollect(req: Request, res: Response): Promise<void> {
    await delay(200);
    const collectId = Number(req.params.id);
    await handleService<DeleteCollectResponse>(
      res,
      () => collectService.deleteCollect(collectId),
      '已取消收藏',
    );
  }

  /**
   * 移动收藏到其他分组
   * PUT /api/collect/:id/move
   */
  async moveCollect(req: Request, res: Response): Promise<void> {
    await delay(200);
    const collectId = Number(req.params.id);
    const data = req.body as MoveCollectRequest;
    await handleService<MoveCollectResponse>(
      res,
      () => collectService.moveCollect(collectId, data),
      '移动成功',
    );
  }

  /**
   * 检查是否已收藏
   * GET /api/collect/check
   */
  async checkCollected(req: Request, res: Response): Promise<void> {
    await delay(100);
    const userId = await getUserId(req);
    const data = {
      type: req.query.type as string | undefined,
      target_id: req.query.target_id ? Number(req.query.target_id) : 0,
    } as CheckCollectedRequest;
    await handleService<CheckCollectedResponse>(res, () =>
      collectService.checkCollected(userId, data),
    );
  }
}

/** 收藏控制器实例 */
export const collectController = new CollectController();
