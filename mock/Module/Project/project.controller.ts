// mock/Project/project.controller.ts
// 文集控制器层
// 职责：接收文集相关的 HTTP 请求，调用 Service 处理业务逻辑，统一返回响应
// 【控制器层】只包含请求处理和响应格式化

import type { Request, Response } from 'express';
import { delay, handleService } from '../../Core';
import type {
  CreateProjectRequest,
  CreateProjectResponse,
  DeleteProjectResponse,
  GetProjectListRequest,
  GetProjectListResponse,
  UpdateProjectRequest,
  UpdateProjectResponse,
} from './project.dto';
import { projectService } from './project.service';

/**
 * 文集控制器
 * 职责：接收请求，调用 Service，返回响应
 */
class ProjectController {
  // ==================== 文集列表 ====================

  /** 获取文集列表 */
  async getProjectList(req: Request, res: Response) {
    await delay(200);
    const query = req.query as unknown as GetProjectListRequest;

    // 参数默认值处理 + 类型转换（HTTP 层职责，service 层接收完整的、类型正确的参数）
    const params: GetProjectListRequest = {
      project_category_id: Number(query.project_category_id ?? 0),
      keyword: query.keyword ?? '',
      filter: query.filter ?? 'all',
      sort: query.sort ?? 'update',
      page: Number(query.page ?? 1),
      page_size: Number(query.page_size ?? 12),
      user_id: Number(query.user_id ?? 0),
    };

    await handleService<GetProjectListResponse>(
      res,
      () => projectService.getProjectList(params),
      '获取成功',
    );
  }

  // ==================== 创建文集 ====================

  /** 创建文集 */
  async createProject(req: Request, res: Response) {
    await delay(300);
    const data = req.body as CreateProjectRequest;
    // 从 req 获取当前用户（由 authMiddleware 挂载）
    const currentUser = (req as any).currentUser;
    await handleService<CreateProjectResponse>(
      res,
      () => projectService.createProject(data, currentUser.id),
      '创建成功',
    );
  }

  // ==================== 更新文集 ====================

  /** 更新文集 */
  async updateProject(req: Request, res: Response) {
    await delay(300);
    const id = Number(req.params.id);
    const data = req.body as UpdateProjectRequest;
    await handleService<UpdateProjectResponse>(
      res,
      () => projectService.updateProject(id, data),
      '更新成功',
    );
  }

  // ==================== 删除文集 ====================

  /** 删除文集 */
  async deleteProject(req: Request, res: Response) {
    await delay(300);
    const id = Number(req.params.id);
    await handleService<DeleteProjectResponse>(
      res,
      () => projectService.deleteProject(id),
      '删除成功',
    );
  }
}

export const projectController = new ProjectController();
