// mock/Project/projectInfo.service.ts
// 文集详情页子资源服务层
// 职责：处理文集详情页子资源相关的核心业务逻辑
// 包含：文档分类、文档列表、文档版本、AI 大纲、文集简介等子资源接口
// 数据访问通过 projectInfoRepository 封装

import { BusinessError } from '../../Core';
import type { MockProject, MongoProject } from '../../Entities/project';
import { projectInfoRepository } from './projectInfo.repository';
import { projectRepository } from './project.repository';

// ============================================================================
// 文集详情页子资源服务类
// ============================================================================

class ProjectInfoService {
  // ==================== 文集详情 ====================

  /**
   * 获取文集详情（多级缓存降级）
   *
   * 【读取优先级】Redis（L3）→ MongoDB（L2）→ 数据库（L1）
   * 【返回】完整的 MongoProject（含 doc_count/doc_category_count 统计字段）
   *
   * @param id 文集 ID
   * @returns 文集详情
   */
  async getProjectDetail(id: number): Promise<MongoProject> {
    const projects = await projectRepository.findByIds([id]);
    const project = projects[0];
    if (!project) {
      throw new BusinessError('文集不存在', 404);
    }
    return project;
  }

  // ==================== 文档分类 ====================

  /**
   * 获取文集下的文档分类列表
   *
   * @param projectId 文集 ID
   * @returns 文档分类列表（扁平化，按 sort 排序）
   */
  async getProjectCategories(projectId: number): Promise<any[]> {
    const project = await projectInfoRepository.findProject(projectId);
    if (!project) {
      throw new BusinessError('文集不存在', 404);
    }
    return projectInfoRepository.findDocCategories(projectId);
  }

  // ==================== 文档列表 ====================

  /**
   * 获取文集下的文档列表
   * @param projectId 文集 ID
   * @returns 文档列表（扁平化，按 sort 排序）
   */
  async getProjectDocs(projectId: number): Promise<any[]> {
    const project = await projectInfoRepository.findProject(projectId);
    if (!project) {
      throw new BusinessError('文集不存在', 404);
    }
    return projectInfoRepository.findDocs(projectId);
  }

  // ==================== 文档版本 ====================

  /**
   * 获取文集下所有文档的版本列表
   * @param projectId 文集 ID
   * @returns 文档版本列表（扁平化）
   */
  async getProjectDocVersions(projectId: number): Promise<any[]> {
    const project = await projectInfoRepository.findProject(projectId);
    if (!project) {
      throw new BusinessError('文集不存在', 404);
    }
    return projectInfoRepository.findDocVersions(projectId);
  }

  // ==================== AI 总结大纲 ====================

  /**
   * 获取文集的 AI 总结大纲
   * @param projectId 文集 ID
   * @returns AI 大纲数据（不存在时返回 null）
   */
  getAiOutline(projectId: number): any | null {
    const project = projectInfoRepository.findProject(projectId);
    if (!project) {
      throw new BusinessError('文集不存在', 404);
    }
    return projectInfoRepository.getAiOutline(projectId);
  }

  /**
   * 生成文集的 AI 总结大纲
   * @param projectId 文集 ID
   * @returns 生成的 AI 大纲数据
   */
  async generateAiOutline(projectId: number): Promise<any> {
    const project = await projectInfoRepository.findProject(projectId);
    if (!project) {
      throw new BusinessError('文集不存在', 404);
    }

    // 获取该文集下的文档列表
    const docList = await projectInfoRepository.findDocs(projectId);
    if (docList.length === 0) {
      throw new BusinessError('文集下暂无文档，无法生成大纲');
    }

    // 获取该文集下的文档分类
    const categoryList = await projectInfoRepository.findDocCategories(projectId);

    // 按文档分类组织章节
    const chapters: any[] = [];

    if (categoryList.length > 0) {
      // 有分类时，按分类组织章节
      categoryList.forEach((category) => {
        const categoryDocs = docList.filter(
          (d) => d.doc_category_id === category.id,
        );
        if (categoryDocs.length > 0) {
          chapters.push({
            title: category.name,
            desc: `包含 ${categoryDocs.length} 篇文档`,
            docs: categoryDocs.map((d) => d.name),
          });
        }
      });
      // 未分类的文档
      const uncategorizedDocs = docList.filter(
        (d) => !d.doc_category_id || d.doc_category_id === 0,
      );
      if (uncategorizedDocs.length > 0) {
        chapters.push({
          title: '未分类',
          desc: `包含 ${uncategorizedDocs.length} 篇未分类文档`,
          docs: uncategorizedDocs.map((d) => d.name),
        });
      }
    } else {
      // 无分类时，每篇文档作为一个章节
      docList.forEach((doc) => {
        chapters.push({
          title: doc.name,
          desc: doc.summary || '暂无描述',
          docs: [doc.name],
        });
      });
    }

    // 生成大纲数据（与前端 AiOutline 类型一致）
    const outline = {
      project_id: projectId,
      summary: `本文集「${project.name}」共包含 ${docList.length} 篇文档，${
        categoryList.length > 0 ? `分为 ${categoryList.length} 个分类，` : ''
      }涵盖项目介绍、核心概念、API 文档等内容。本文档由 AI 自动生成，仅供参考。`,
      chapters,
      created_at: new Date().toLocaleString('zh-CN', { hour12: false }),
      updated_at: new Date().toLocaleString('zh-CN', { hour12: false }),
    };

    // 保存到内存存储
    projectInfoRepository.saveAiOutline(projectId, outline);

    return outline;
  }

  /**
   * 保存文集的 AI 总结大纲
   * @param projectId 文集 ID
   * @param summary 大纲摘要
   * @param chapters 大纲章节
   * @returns 保存后的 AI 大纲数据
   */
  saveAiOutline(projectId: number, summary: string, chapters: any[]): any {
    const project = projectInfoRepository.findProject(projectId);
    if (!project) {
      throw new BusinessError('文集不存在', 404);
    }
    const existing = projectInfoRepository.getAiOutline(projectId);
    const outline = {
      project_id: projectId,
      summary,
      chapters,
      created_at:
        existing?.created_at ||
        new Date().toLocaleString('zh-CN', { hour12: false }),
      updated_at: new Date().toLocaleString('zh-CN', { hour12: false }),
    };
    projectInfoRepository.saveAiOutline(projectId, outline);
    return outline;
  }

  // ==================== 文集简介 ====================

  /**
   * 更新文集简介
   * @param id 文集 ID
   * @param intro 新的简介内容
   * @returns 更新后的文集
   */
  async updateProjectIntro(id: number, intro: string): Promise<MockProject> {
    const oldProject = await projectInfoRepository.findProject(id);
    if (!oldProject) {
      throw new BusinessError('文集不存在', 404);
    }

    const updatedProject = await projectInfoRepository.updateIntro(id, intro);

    // 精确失效列表缓存（intro 变更不影响排序，只影响 all 筛选的展示）
    if (updatedProject) {
      await projectRepository.invalidateListCache(updatedProject, ['intro']);
    }

    return updatedProject!;
  }
}

export const projectInfoService = new ProjectInfoService();
