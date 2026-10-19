/**
 * 快捷操作模块 Controller 层（控制器层）
 *
 * 【文件职责】
 * 接收 HTTP 请求，调用 Service 处理业务逻辑，统一返回响应
 *
 * 【六层架构】
 * 1. 路由层（index.ts）：只做路由定义，使用 withMiddleware 包装
 * 2. 控制器层（controller.ts）：处理请求响应，使用 handleService 统一异常
 * 3. 服务层（service.ts）：业务逻辑，返回数据，抛出 BusinessError
 * 4. 数据访问层：L1 MockTable / L2 MongoDB / L3 Redis
 * 5. 实体层（Entities/quick.ts）：类型定义、初始数据、表实例
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
import type { QuickItemType } from '../../Entities/quick';
import type {
  AddItemToGroupRequest,
  AddItemToGroupResponse,
  CreateQuickGroupRequest,
  CreateQuickGroupResponse,
  CreateQuickItemRequest,
  CreateQuickItemResponse,
  DeleteQuickGroupResponse,
  DeleteQuickItemResponse,
  GetQuickGroupsResponse,
  GetQuickItemsResponse,
  IncrementUsageResponse,
  RemoveItemFromGroupResponse,
  SaveGroupSortRequest,
  SaveGroupSortResponse,
  UpdateQuickGroupRequest,
  UpdateQuickGroupResponse,
  UpdateQuickItemRequest,
  UpdateQuickItemResponse,
} from './dto';
import * as quickService from './service';

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
 * 快捷操作控制器
 *
 * 职责：接收请求，调用 Service，返回响应
 * 注意：权限校验和参数校验由中间件处理，控制器只关注业务逻辑和异常捕获
 */
class QuickController {
  // ==================== 快捷操作分组相关 ====================

  /**
   * 获取分组列表（含分组下的操作项）
   * GET /api/quick/groups
   */
  async getQuickGroups(req: Request, res: Response): Promise<void> {
    await delay(200);
    const userId = await getUserId(req);
    await handleService<GetQuickGroupsResponse>(res, () =>
      quickService.getQuickGroups(userId),
    );
  }

  /**
   * 创建分组
   * POST /api/quick/groups
   */
  async createQuickGroup(req: Request, res: Response): Promise<void> {
    await delay(300);
    const userId = await getUserId(req);
    const data = req.body as CreateQuickGroupRequest;
    await handleService<CreateQuickGroupResponse>(
      res,
      () => quickService.createQuickGroup(userId, data),
      '分组创建成功',
    );
  }

  /**
   * 更新分组
   * PUT /api/quick/groups/:id
   */
  async updateQuickGroup(req: Request, res: Response): Promise<void> {
    await delay(200);
    const groupId = Number(req.params.id);
    const data = req.body as UpdateQuickGroupRequest;
    await handleService<UpdateQuickGroupResponse>(
      res,
      () => quickService.updateQuickGroup(groupId, data),
      '分组已更新',
    );
  }

  /**
   * 删除分组
   * DELETE /api/quick/groups/:id
   */
  async deleteQuickGroup(req: Request, res: Response): Promise<void> {
    await delay(200);
    const groupId = Number(req.params.id);
    await handleService<DeleteQuickGroupResponse>(
      res,
      () => quickService.deleteQuickGroup(groupId),
      '分组已删除',
    );
  }

  /**
   * 保存分组排序
   * PUT /api/quick/groups/sort
   */
  async saveGroupSort(req: Request, res: Response): Promise<void> {
    await delay(200);
    const data = req.body as SaveGroupSortRequest;
    await handleService<SaveGroupSortResponse>(
      res,
      () => quickService.saveGroupSort(data),
      '排序保存成功',
    );
  }

  // ==================== 快捷操作项相关 ====================

  /**
   * 获取快捷操作列表
   * GET /api/quick/items
   */
  async getQuickItems(req: Request, res: Response): Promise<void> {
    await delay(200);
    const userId = await getUserId(req);
    const data = {
      category_id: req.query.category_id as number | string | undefined,
      type: req.query.type as QuickItemType | undefined,
    };
    await handleService<GetQuickItemsResponse>(res, () =>
      quickService.getQuickItems(userId, data),
    );
  }

  /**
   * 创建快捷操作项
   * POST /api/quick/items
   */
  async createQuickItem(req: Request, res: Response): Promise<void> {
    await delay(300);
    const userId = await getUserId(req);
    const data = req.body as CreateQuickItemRequest;
    await handleService<CreateQuickItemResponse>(
      res,
      () => quickService.createQuickItem(userId, data),
      '操作项创建成功',
    );
  }

  /**
   * 更新快捷操作项
   * PUT /api/quick/items/:id
   */
  async updateQuickItem(req: Request, res: Response): Promise<void> {
    await delay(200);
    const itemId = Number(req.params.id);
    const data = req.body as UpdateQuickItemRequest;
    await handleService<UpdateQuickItemResponse>(
      res,
      () => quickService.updateQuickItem(itemId, data),
      '操作项已更新',
    );
  }

  /**
   * 删除快捷操作项
   * DELETE /api/quick/items/:id
   */
  async deleteQuickItem(req: Request, res: Response): Promise<void> {
    await delay(200);
    const itemId = Number(req.params.id);
    await handleService<DeleteQuickItemResponse>(
      res,
      () => quickService.deleteQuickItem(itemId),
      '操作项已删除',
    );
  }

  /**
   * 增加使用次数
   * POST /api/quick/items/:id/usage
   */
  async incrementUsage(req: Request, res: Response): Promise<void> {
    await delay(100);
    const itemId = Number(req.params.id);
    await handleService<IncrementUsageResponse>(
      res,
      () => quickService.incrementUsage(itemId),
      '使用次数已增加',
    );
  }

  // ==================== 分组关联相关 ====================

  /**
   * 添加操作项到分组
   * POST /api/quick/groups/:id/items
   */
  async addItemToGroup(req: Request, res: Response): Promise<void> {
    await delay(200);
    const groupId = Number(req.params.id);
    const data = req.body as AddItemToGroupRequest;
    await handleService<AddItemToGroupResponse>(
      res,
      () => quickService.addItemToGroup(groupId, data),
      '已添加到分组',
    );
  }

  /**
   * 从分组移除操作项
   * DELETE /api/quick/groups/:id/items/:item_id
   */
  async removeItemFromGroup(req: Request, res: Response): Promise<void> {
    await delay(200);
    const groupId = Number(req.params.id);
    const itemId = Number(req.params.item_id);
    await handleService<RemoveItemFromGroupResponse>(
      res,
      () => quickService.removeItemFromGroup(groupId, itemId),
      '已从分组移除',
    );
  }
}

/** 快捷操作控制器实例 */
export const quickController = new QuickController();
