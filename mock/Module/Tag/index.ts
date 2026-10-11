/**
 * 标签模块路由层
 *
 * 【文件职责】
 * 定义标签 API 路由，配置中间件，将请求转发给 Controller
 *
 * 【六层架构】
 * 1. 路由层（index.ts）：只做路由定义，使用 withMiddleware 包装
 * 2. 控制器层（controller.ts）：处理请求响应，使用 handleService 统一异常
 * 3. 服务层（service.ts）：业务逻辑，返回数据，抛出 BusinessError
 * 4. 数据访问层：L1 MockTable / L2 MongoDB / L3 Redis
 * 5. 实体层（Entities/tag.ts）：类型定义、初始数据、表实例
 * 6. 通用层（Core/）：通用工具、中间件、异常处理
 *
 * 【路由层职责】
 * - 只包含路由定义和中间件配置
 * - 不包含业务逻辑
 * - 使用 withMiddleware 包装，引入参数校验中间件
 */

import type { Request, Response } from 'express';
import { tagController } from './controller';
import { withMiddleware } from '../../Core/middleware';
import {
  validateAddDocTagRequest,
  validateCreateTagCategoryRequest,
  validateCreateTagRequest,
  validateGetTagCategoriesRequest,
  validateGetTagDocsRequest,
  validateGetTagListRequest,
  validateSortTagCategoryRequest,
  validateUpdateTagCategoryRequest,
  validateUpdateTagRequest,
} from './validator';

// ==================== 标签 API 路由定义 ====================

export default {
  // ---------- 标签列表 ----------

  /**
   * 获取标签列表（所有标签+分类+文档关联，用于 TagManager）
   * 中间件：参数校验（query）
   */
  'GET /api/tags': withMiddleware(
    {
      validate: validateGetTagListRequest,
      validateSource: 'query',
    },
    (req: Request, res: Response) => tagController.getTagList(req, res),
  ),

  // ---------- 标签分类 ----------

  /**
   * 获取标签分类列表（含该分类下的标签）
   * 中间件：参数校验（query）
   */
  'GET /api/tag/categories': withMiddleware(
    {
      validate: validateGetTagCategoriesRequest,
      validateSource: 'query',
    },
    (req: Request, res: Response) => tagController.getTagCategories(req, res),
  ),

  /**
   * 新建标签分类
   * 中间件：参数校验（body）
   */
  'POST /api/tag/category': withMiddleware(
    {
      validate: validateCreateTagCategoryRequest,
    },
    (req: Request, res: Response) => tagController.createTagCategory(req, res),
  ),

  /**
   * 更新标签分类（重命名）
   * 中间件：参数校验（body）
   */
  'PUT /api/tag/category/:id': withMiddleware(
    {
      validate: validateUpdateTagCategoryRequest,
    },
    (req: Request, res: Response) => tagController.updateTagCategory(req, res),
  ),

  /**
   * 删除标签分类
   */
  'DELETE /api/tag/category/:id': (req: Request, res: Response) =>
    tagController.deleteTagCategory(req, res),

  /**
   * 分类排序（同级上下移动）
   * 中间件：参数校验（body）
   */
  'PUT /api/tag/category/:id/sort': withMiddleware(
    {
      validate: validateSortTagCategoryRequest,
    },
    (req: Request, res: Response) => tagController.sortTagCategory(req, res),
  ),

  // ---------- 标签 ----------

  /**
   * 新建标签
   * 中间件：参数校验（body）
   */
  'POST /api/tag': withMiddleware(
    {
      validate: validateCreateTagRequest,
    },
    (req: Request, res: Response) => tagController.createTag(req, res),
  ),

  /**
   * 修改标签
   * 中间件：参数校验（body）
   */
  'PUT /api/tag/:id': withMiddleware(
    {
      validate: validateUpdateTagRequest,
    },
    (req: Request, res: Response) => tagController.updateTag(req, res),
  ),

  /**
   * 删除标签
   */
  'DELETE /api/tag/:id': (req: Request, res: Response) =>
    tagController.deleteTag(req, res),

  /**
   * 按标签获取目标列表（分页）
   * 中间件：参数校验（query）
   */
  'GET /api/tag/:id/docs': withMiddleware(
    {
      validate: validateGetTagDocsRequest,
      validateSource: 'query',
    },
    (req: Request, res: Response) => tagController.getTagDocs(req, res),
  ),

  // ---------- 文档标签关联 ----------

  /**
   * 获取文档已关联的标签列表
   */
  'GET /api/doc/:id/tags': (req: Request, res: Response) =>
    tagController.getDocTags(req, res),

  /**
   * 给文档添加标签（关联）
   * 中间件：参数校验（body）
   */
  'POST /api/doc/:id/tags': withMiddleware(
    {
      validate: validateAddDocTagRequest,
    },
    (req: Request, res: Response) => tagController.addDocTag(req, res),
  ),

  /**
   * 移除文档标签（取消关联）
   */
  'DELETE /api/doc/:id/tags/:tag_id': (req: Request, res: Response) =>
    tagController.removeDocTag(req, res),
};
