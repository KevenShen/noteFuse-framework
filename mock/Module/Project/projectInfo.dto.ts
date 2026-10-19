// mock/Project/projectInfo.dto.ts
// 文集详情页子资源 DTO（Data Transfer Object，数据传输对象）
// 功能：定义文集详情页子资源相关接口请求和响应的数据结构类型

import type {
  MockDoc,
  MockDocCategory,
  MockDocVersion,
} from '../../Entities/doc';
import type { MongoProject } from '../../Entities/project';

// ==================== 文集详情相关 DTO ====================

/** 获取文集详情请求参数 */
export interface GetProjectDetailRequest {
  /** 文集 ID（路径参数） */
  id: number;
}

/** 获取文集详情响应数据（data 字段内容） */
export type GetProjectDetailResponse = MongoProject;

// ==================== 文档分类相关 DTO ====================

/** 获取文集下的文档分类列表请求参数 */
export interface GetProjectCategoriesRequest {
  /** 文集 ID（路径参数） */
  projectId: number;
}

/** 获取文集下的文档分类列表响应数据（data 字段内容） */
export type GetProjectCategoriesResponse = MockDocCategory[];

// ==================== 文档列表相关 DTO ====================

/** 获取文集下的文档列表请求参数 */
export interface GetProjectDocsRequest {
  /** 文集 ID（路径参数） */
  projectId: number;
}

/** 获取文集下的文档列表响应数据（data 字段内容） */
export type GetProjectDocsResponse = MockDoc[];

// ==================== 文档版本相关 DTO ====================

/** 获取文集下所有文档的版本列表请求参数 */
export interface GetProjectDocVersionsRequest {
  /** 文集 ID（路径参数） */
  projectId: number;
}

/** 获取文集下所有文档的版本列表响应数据（data 字段内容） */
export type GetProjectDocVersionsResponse = MockDocVersion[];

// ==================== AI 总结大纲相关 DTO ====================

/** AI 大纲章节 */
export interface AiOutlineChapter {
  /** 章节标题 */
  title: string;
  /** 章节描述 */
  desc: string;
  /** 章节包含的文档名称列表 */
  docs: string[];
}

/** AI 大纲数据 */
export interface AiOutlineData {
  /** 文集 ID */
  project_id: number;
  /** 大纲摘要 */
  summary: string;
  /** 大纲章节列表 */
  chapters: AiOutlineChapter[];
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
}

/** 获取文集的 AI 总结大纲请求参数 */
export interface GetAiOutlineRequest {
  /** 文集 ID（路径参数） */
  projectId: number;
}

/** 获取文集的 AI 总结大纲响应数据（data 字段内容，不存在时为 null） */
export type GetAiOutlineResponse = AiOutlineData | null;

/** 生成文集的 AI 总结大纲请求参数 */
export interface GenerateAiOutlineRequest {
  /** 文集 ID（路径参数） */
  projectId: number;
}

/** 生成文集的 AI 总结大纲响应数据（data 字段内容） */
export type GenerateAiOutlineResponse = AiOutlineData;

/** 保存文集的 AI 总结大纲请求参数 */
export interface SaveAiOutlineRequest {
  /** 文集 ID（路径参数） */
  projectId: number;
  /** 大纲摘要 */
  summary: string;
  /** 大纲章节列表 */
  chapters: AiOutlineChapter[];
}

/** 保存文集的 AI 总结大纲响应数据（data 字段内容） */
export type SaveAiOutlineResponse = AiOutlineData;

// ==================== 文集简介相关 DTO ====================

/** 更新文集简介请求参数 */
export interface UpdateProjectIntroRequest {
  /** 文集 ID（路径参数） */
  id: number;
  /** 文集简介内容 */
  intro: string;
}

/** 更新文集简介响应数据（data 字段内容） */
export type UpdateProjectIntroResponse = MongoProject;
