/**
 * 收藏模块路由层
 *
 * 【文件职责】
 * 定义收藏 API 路由，配置中间件，将请求转发给 Controller
 *
 * 【六层架构】
 * 1. 路由层（index.ts）：只做路由定义，使用 withMiddleware 包装
 * 2. 控制器层（controller.ts）：处理请求响应，使用 handleService 统一异常
 * 3. 服务层（service.ts）：业务逻辑，返回数据，抛出 BusinessError
 * 4. 数据访问层：L1 MockTable / L2 MongoDB / L3 Redis
 * 5. 实体层（Entities/collect.ts）：类型定义、初始数据、表实例
 * 6. 通用层（Core/）：通用工具、中间件、异常处理
 *
 * 【路由层职责】
 * - 只包含路由定义和中间件配置
 * - 不包含业务逻辑
 * - 使用 withMiddleware 包装，引入参数校验中间件
 */

import type { Request, Response } from 'express';
import { collectController } from './controller';
import { withMiddleware } from '../../Core/middleware';
import {
  validateCheckCollectedRequest,
  validateCreateCollectGroupRequest,
  validateCreateCollectRequest,
  validateGetCollectGroupsRequest,
  validateGetCollectListRequest,
  validateMoveCollectRequest,
  validateUpdateCollectGroupRequest,
} from './validator';

// ==================== 收藏 API 路由定义 ====================

export default {
  // ==================== 收藏分组相关 ====================

  /**
   * 获取收藏分组列表
   * 中间件：参数校验（query）
   */
  'GET /api/collect/groups': withMiddleware(
    {
      validate: validateGetCollectGroupsRequest,
    },
    (req: Request, res: Response) => collectController.getCollectGroups(req, res),
  ),

  /**
   * 新建收藏分组
   * 中间件：参数校验（body）
   */
  'POST /api/collect/group': withMiddleware(
    {
      validate: validateCreateCollectGroupRequest,
    },
    (req: Request, res: Response) => collectController.createCollectGroup(req, res),
  ),

  /**
   * 更新收藏分组
   * 中间件：参数校验（body）
   */
  'PUT /api/collect/group/:id': withMiddleware(
    {
      validate: validateUpdateCollectGroupRequest,
    },
    (req: Request, res: Response) => collectController.updateCollectGroup(req, res),
  ),

  /**
   * 删除收藏分组
   */
  'DELETE /api/collect/group/:id': (req: Request, res: Response) =>
    collectController.deleteCollectGroup(req, res),

  // ==================== 收藏记录相关 ====================

  /**
   * 获取收藏列表（支持类型筛选、分组筛选、关键词、分页）
   * 中间件：参数校验（query）
   */
  'GET /api/collect': withMiddleware(
    {
      validate: validateGetCollectListRequest,
    },
    (req: Request, res: Response) => collectController.getCollectList(req, res),
  ),

  /**
   * 添加收藏（统一接口，type 区分文档/文集）
   * 中间件：参数校验（body）
   */
  'POST /api/collect': withMiddleware(
    {
      validate: validateCreateCollectRequest,
    },
    (req: Request, res: Response) => collectController.createCollect(req, res),
  ),

  /**
   * 取消收藏
   */
  'DELETE /api/collect/:id': (req: Request, res: Response) =>
    collectController.deleteCollect(req, res),

  /**
   * 移动收藏到其他分组
   * 中间件：参数校验（body）
   */
  'PUT /api/collect/:id/move': withMiddleware(
    {
      validate: validateMoveCollectRequest,
    },
    (req: Request, res: Response) => collectController.moveCollect(req, res),
  ),

  /**
   * 检查是否已收藏
   * 中间件：参数校验（query）
   */
  'GET /api/collect/check': withMiddleware(
    {
      validate: validateCheckCollectedRequest,
    },
    (req: Request, res: Response) => collectController.checkCollected(req, res),
  ),
};
