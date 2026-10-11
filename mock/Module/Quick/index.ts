/**
 * 快捷操作模块路由层
 *
 * 【文件职责】
 * 定义快捷操作 API 路由，配置中间件，将请求转发给 Controller
 *
 * 【六层架构】
 * 1. 路由层（index.ts）：只做路由定义，使用 withMiddleware 包装
 * 2. 控制器层（controller.ts）：处理请求响应，使用 handleService 统一异常
 * 3. 服务层（service.ts）：业务逻辑，返回数据，抛出 BusinessError
 * 4. 数据访问层：L1 MockTable / L2 MongoDB / L3 Redis
 * 5. 实体层（Entities/quick.ts）：类型定义、初始数据、表实例
 * 6. 通用层（Core/）：通用工具、中间件、异常处理
 *
 * 【路由层职责】
 * - 只包含路由定义和中间件配置
 * - 不包含业务逻辑
 * - 使用 withMiddleware 包装，引入参数校验中间件
 */

import type { Request, Response } from 'express';
import { quickController } from './controller';
import { withMiddleware } from '../../Core/middleware';
import {
  validateAddItemToGroupRequest,
  validateCreateQuickGroupRequest,
  validateCreateQuickItemRequest,
  validateGetQuickItemsRequest,
  validateSaveGroupSortRequest,
  validateUpdateQuickGroupRequest,
  validateUpdateQuickItemRequest,
} from './validator';

// ==================== 快捷操作 API 路由定义 ====================

export default {
  // ==================== 快捷操作分组相关 ====================

  /**
   * 获取分组列表（含分组下的操作项）
   */
  'GET /api/quick/groups': (req: Request, res: Response) =>
    quickController.getQuickGroups(req, res),

  /**
   * 创建分组
   * 中间件：参数校验（body）
   */
  'POST /api/quick/groups': withMiddleware(
    {
      validate: validateCreateQuickGroupRequest,
    },
    (req: Request, res: Response) => quickController.createQuickGroup(req, res),
  ),

  /**
   * 更新分组
   * 中间件：参数校验（body）
   */
  'PUT /api/quick/groups/:id': withMiddleware(
    {
      validate: validateUpdateQuickGroupRequest,
    },
    (req: Request, res: Response) => quickController.updateQuickGroup(req, res),
  ),

  /**
   * 删除分组
   */
  'DELETE /api/quick/groups/:id': (req: Request, res: Response) =>
    quickController.deleteQuickGroup(req, res),

  /**
   * 保存分组排序
   * 中间件：参数校验（body）
   */
  'PUT /api/quick/groups/sort': withMiddleware(
    {
      validate: validateSaveGroupSortRequest,
    },
    (req: Request, res: Response) => quickController.saveGroupSort(req, res),
  ),

  // ==================== 快捷操作项相关 ====================

  /**
   * 获取快捷操作列表
   * 中间件：参数校验（query）
   */
  'GET /api/quick/items': withMiddleware(
    {
      validate: validateGetQuickItemsRequest,
      validateSource: 'query',
    },
    (req: Request, res: Response) => quickController.getQuickItems(req, res),
  ),

  /**
   * 创建快捷操作项
   * 中间件：参数校验（body）
   */
  'POST /api/quick/items': withMiddleware(
    {
      validate: validateCreateQuickItemRequest,
    },
    (req: Request, res: Response) => quickController.createQuickItem(req, res),
  ),

  /**
   * 更新快捷操作项
   * 中间件：参数校验（body）
   */
  'PUT /api/quick/items/:id': withMiddleware(
    {
      validate: validateUpdateQuickItemRequest,
    },
    (req: Request, res: Response) => quickController.updateQuickItem(req, res),
  ),

  /**
   * 删除快捷操作项
   */
  'DELETE /api/quick/items/:id': (req: Request, res: Response) =>
    quickController.deleteQuickItem(req, res),

  /**
   * 增加使用次数
   */
  'POST /api/quick/items/:id/usage': (req: Request, res: Response) =>
    quickController.incrementUsage(req, res),

  // ==================== 分组关联相关 ====================

  /**
   * 添加操作项到分组
   * 中间件：参数校验（body）
   */
  'POST /api/quick/groups/:id/items': withMiddleware(
    {
      validate: validateAddItemToGroupRequest,
    },
    (req: Request, res: Response) => quickController.addItemToGroup(req, res),
  ),

  /**
   * 从分组移除操作项
   */
  'DELETE /api/quick/groups/:id/items/:item_id': (
    req: Request,
    res: Response,
  ) => quickController.removeItemFromGroup(req, res),
};
