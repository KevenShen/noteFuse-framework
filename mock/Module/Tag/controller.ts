/**
 * 标签模块 Controller 层（控制器层）
 *
 * 【文件职责】
 * 接收 HTTP 请求，调用 Service 处理业务逻辑，统一返回响应
 *
 * 【六层架构】
 * 1. 路由层（index.ts）：只做路由定义，使用 withMiddleware 包装
 * 2. 控制器层（controller.ts）：处理请求响应，使用 handleService 统一异常
 * 3. 服务层（service.ts）：业务逻辑，返回数据，抛出 BusinessError
 * 4. 数据访问层：L1 MockTable / L2 MongoDB / L3 Redis
 * 5. 实体层（Entities/tag.ts）：类型定义、初始数据、表实例
 * 6. 通用层（Core/）：通用工具、中间件、异常处理
 *
 * 【控制器层职责】
 * - 解析请求参数（params/query/body）
 * - 调用 service 层方法
 * - 使用 handleService 统一异常处理，返回标准响应格式
 * - 不处理业务逻辑，只做 HTTP 层的请求/响应处理
 */

import type { Request, Response } from 'express';
import { delay, handleService } from '../../Core';
import type { TagType } from '../../Entities/tag';
import type {
  AddDocTagRequest,
  AddDocTagResponse,
  CreateTagCategoryRequest,
  CreateTagCategoryResponse,
  CreateTagRequest,
  CreateTagResponse,
  DeleteTagCategoryResponse,
  DeleteTagResponse,
  GetDocTagsResponse,
  GetTagCategoriesResponse,
  GetTagDocsResponse,
  GetTagListResponse,
  RemoveDocTagResponse,
  SortTagCategoryRequest,
  SortTagCategoryResponse,
  UpdateTagCategoryRequest,
  UpdateTagCategoryResponse,
  UpdateTagRequest,
  UpdateTagResponse,
} from './dto';
import * as tagService from './service';

/**
 * 标签控制器
 *
 * 职责：接收请求，调用 Service，返回响应
 * 注意：权限校验和参数校验由中间件处理，控制器只关注业务逻辑和异常捕获
 */
class TagController {
  // ==================== 标签列表相关 ====================

  /**
   * 获取标签列表（所有标签+分类+文档关联，用于 TagManager）
   * GET /api/tags
   */
  async getTagList(req: Request, res: Response): Promise<void> {
    await delay(100);
    const data = {
      type: req.query.type as TagType | undefined,
    };
    await handleService<GetTagListResponse>(res, () =>
      tagService.getTagList(data),
    );
  }

  // ==================== 标签分类相关 ====================

  /**
   * 获取标签分类列表（含该分类下的标签）
   * GET /api/tag/categories
   */
  async getTagCategories(req: Request, res: Response): Promise<void> {
    await delay(200);
    const data = {
      type: req.query.type as TagType | undefined,
    };
    await handleService<GetTagCategoriesResponse>(res, () =>
      tagService.getTagCategories(data),
    );
  }

  /**
   * 新建标签分类
   * POST /api/tag/category
   */
  async createTagCategory(req: Request, res: Response): Promise<void> {
    await delay(200);
    const data = req.body as CreateTagCategoryRequest;
    await handleService<CreateTagCategoryResponse>(
      res,
      () => tagService.createTagCategory(data),
      '分类创建成功',
    );
  }

  /**
   * 更新标签分类（重命名）
   * PUT /api/tag/category/:id
   */
  async updateTagCategory(req: Request, res: Response): Promise<void> {
    await delay(200);
    const id = Number(req.params.id);
    const data = req.body as UpdateTagCategoryRequest;
    await handleService<UpdateTagCategoryResponse>(
      res,
      () => tagService.updateTagCategory(id, data),
      '分类更新成功',
    );
  }

  /**
   * 删除标签分类
   * DELETE /api/tag/category/:id
   */
  async deleteTagCategory(req: Request, res: Response): Promise<void> {
    await delay(200);
    const id = Number(req.params.id);
    await handleService<DeleteTagCategoryResponse>(
      res,
      () => tagService.deleteTagCategory(id),
      '分类删除成功',
    );
  }

  /**
   * 分类排序（同级上下移动）
   * PUT /api/tag/category/:id/sort
   */
  async sortTagCategory(req: Request, res: Response): Promise<void> {
    await delay(150);
    const id = Number(req.params.id);
    const data = req.body as SortTagCategoryRequest;
    await handleService<SortTagCategoryResponse>(
      res,
      () => tagService.sortTagCategory(id, data),
      '排序更新成功',
    );
  }

  // ==================== 标签相关 ====================

  /**
   * 新建标签
   * POST /api/tag
   */
  async createTag(req: Request, res: Response): Promise<void> {
    await delay(200);
    const data = req.body as CreateTagRequest;
    await handleService<CreateTagResponse>(
      res,
      () => tagService.createTag(data),
      '标签创建成功',
    );
  }

  /**
   * 修改标签
   * PUT /api/tag/:id
   */
  async updateTag(req: Request, res: Response): Promise<void> {
    await delay(200);
    const id = Number(req.params.id);
    const data = req.body as UpdateTagRequest;
    await handleService<UpdateTagResponse>(
      res,
      () => tagService.updateTag(id, data),
      '标签更新成功',
    );
  }

  /**
   * 删除标签
   * DELETE /api/tag/:id
   */
  async deleteTag(req: Request, res: Response): Promise<void> {
    await delay(200);
    const id = Number(req.params.id);
    await handleService<DeleteTagResponse>(
      res,
      () => tagService.deleteTag(id),
      '标签删除成功',
    );
  }

  /**
   * 按标签获取目标列表（分页）
   * GET /api/tag/:id/docs
   */
  async getTagDocs(req: Request, res: Response): Promise<void> {
    await delay(200);
    const tagId = Number(req.params.id);
    const data = {
      page: req.query.page ? Number(req.query.page) : undefined,
      page_size: req.query.page_size ? Number(req.query.page_size) : undefined,
      type: req.query.type as TagType | undefined,
    };
    await handleService<GetTagDocsResponse>(
      res,
      () => tagService.getTagDocs(tagId, data),
    );
  }

  // ==================== 标签关联相关 ====================

  /**
   * 获取文档已关联的标签列表
   * GET /api/doc/:id/tags
   */
  async getDocTags(req: Request, res: Response): Promise<void> {
    await delay(100);
    const docId = Number(req.params.id);
    await handleService<GetDocTagsResponse>(res, () =>
      tagService.getDocTags(docId),
    );
  }

  /**
   * 给文档添加标签（关联）
   * POST /api/doc/:id/tags
   */
  async addDocTag(req: Request, res: Response): Promise<void> {
    await delay(150);
    const docId = Number(req.params.id);
    const data = req.body as AddDocTagRequest;
    await handleService<AddDocTagResponse>(
      res,
      () => tagService.addDocTag(docId, data),
      '标签添加成功',
    );
  }

  /**
   * 移除文档标签（取消关联）
   * DELETE /api/doc/:id/tags/:tag_id
   */
  async removeDocTag(req: Request, res: Response): Promise<void> {
    await delay(150);
    const docId = Number(req.params.id);
    const tagId = Number(req.params.tag_id);
    await handleService<RemoveDocTagResponse>(
      res,
      () => tagService.removeDocTag(docId, tagId),
      '标签移除成功',
    );
  }
}

/** 标签控制器实例 */
export const tagController = new TagController();
