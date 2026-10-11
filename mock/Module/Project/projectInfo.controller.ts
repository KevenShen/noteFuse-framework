// mock/Project/projectInfo.controller.ts
// 文集详情页子资源控制器层
// 职责：接收文集详情页子资源相关的 HTTP 请求，调用 Service 处理业务逻辑，统一返回响应
// 【控制器层】只包含请求处理和响应格式化

import type { Request, Response } from 'express';
import { delay, handleService } from '../../Core';
import type {
  AiOutlineData,
  GetAiOutlineResponse,
  GetProjectCategoriesResponse,
  GetProjectDocVersionsResponse,
  GetProjectDocsResponse,
  SaveAiOutlineRequest,
  UpdateProjectIntroRequest,
  UpdateProjectIntroResponse,
} from './projectInfo.dto';
import { projectInfoService } from './projectInfo.service';

/**
 * 文集详情页子资源控制器
 * 职责：接收请求，调用 Service，返回响应
 * 包含：文档分类、文档列表、文档版本、AI 大纲、文集简介等子资源接口
 */
class ProjectInfoController {
  // ==================== 文档分类 ====================

  /** 获取文集下的文档分类列表 */
  async getProjectCategories(req: Request, res: Response) {
    await delay(100);
    const id = Number(req.params.id);
    await handleService<GetProjectCategoriesResponse>(
      res,
      () => projectInfoService.getProjectCategories(id),
      undefined,
      404,
    );
  }

  // ==================== 文档列表 ====================

  /** 获取文集下的文档列表 */
  async getProjectDocs(req: Request, res: Response) {
    await delay(100);
    const id = Number(req.params.id);
    await handleService<GetProjectDocsResponse>(
      res,
      () => projectInfoService.getProjectDocs(id),
      undefined,
      404,
    );
  }

  // ==================== 文档版本 ====================

  /** 获取文集下所有文档的版本列表 */
  async getProjectDocVersions(req: Request, res: Response) {
    await delay(100);
    const id = Number(req.params.id);
    await handleService<GetProjectDocVersionsResponse>(
      res,
      () => projectInfoService.getProjectDocVersions(id),
      undefined,
      404,
    );
  }

  // ==================== AI 总结大纲 ====================

  /** 获取文集的 AI 总结大纲 */
  async getAiOutline(req: Request, res: Response) {
    await delay(150);
    const id = Number(req.params.id);
    await handleService<GetAiOutlineResponse>(
      res,
      () => projectInfoService.getAiOutline(id),
      undefined,
      404,
    );
  }

  /** 生成文集的 AI 总结大纲 */
  async generateAiOutline(req: Request, res: Response) {
    await delay(1000); // 模拟 AI 生成耗时
    const id = Number(req.params.id);
    await handleService<AiOutlineData>(
      res,
      () => projectInfoService.generateAiOutline(id),
      '大纲生成成功',
      404,
    );
  }

  /** 保存文集的 AI 总结大纲 */
  async saveAiOutline(req: Request, res: Response) {
    await delay(200);
    const id = Number(req.params.id);
    const { summary, chapters } = req.body as SaveAiOutlineRequest;
    await handleService<AiOutlineData>(
      res,
      () => projectInfoService.saveAiOutline(id, summary, chapters),
      '大纲保存成功',
      404,
    );
  }

  // ==================== 文集简介 ====================

  /** 更新文集简介 */
  async updateProjectIntro(req: Request, res: Response) {
    await delay(200);
    const id = Number(req.params.id);
    const { intro } = req.body as UpdateProjectIntroRequest;
    await handleService<UpdateProjectIntroResponse>(
      res,
      () => projectInfoService.updateProjectIntro(id, intro),
      '简介更新成功',
      404,
    );
  }
}

export const projectInfoController = new ProjectInfoController();
