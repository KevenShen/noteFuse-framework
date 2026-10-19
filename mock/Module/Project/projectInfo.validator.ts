// mock/Project/projectInfo.validator.ts
// 文集详情页子资源请求参数校验规则
// 功能：校验文集详情页子资源相关接口请求参数是否符合要求

import { BusinessError } from '../../Core/common';
import { CommonErrorCodes } from '../../Core/errorCodes';

import type {
  SaveAiOutlineRequest,
  UpdateProjectIntroRequest,
} from './projectInfo.dto';

// ==================== AI 总结大纲相关校验 ====================

/**
 * 校验保存文集的 AI 总结大纲请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateSaveAiOutlineRequest(
  data: SaveAiOutlineRequest,
): void {
  // 1. 必填校验
  if (data.summary === undefined || data.summary === null) {
    throw new BusinessError('大纲摘要不能为空', CommonErrorCodes.VALIDATION_FAILED);
  }

  if (data.chapters === undefined || data.chapters === null) {
    throw new BusinessError('大纲章节列表不能为空', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 2. 摘要长度校验
  if (data.summary.length > 2000) {
    throw new BusinessError('大纲摘要长度不能超过2000个字符', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 3. 章节列表校验
  if (!Array.isArray(data.chapters)) {
    throw new BusinessError('大纲章节列表必须是数组', CommonErrorCodes.VALIDATION_FAILED);
  }

  if (data.chapters.length > 100) {
    throw new BusinessError('大纲章节数量不能超过100个', CommonErrorCodes.VALIDATION_FAILED);
  }

  // 4. 每个章节的有效性校验
  for (let i = 0; i < data.chapters.length; i++) {
    const chapter = data.chapters[i];
    if (!chapter.title) {
      return `第${i + 1}个章节的标题不能为空`;
    }
    if (chapter.title.length > 100) {
      return `第${i + 1}个章节的标题长度不能超过100个字符`;
    }
    if (chapter.desc && chapter.desc.length > 500) {
      return `第${i + 1}个章节的描述长度不能超过500个字符`;
    }
    if (chapter.docs && !Array.isArray(chapter.docs)) {
      return `第${i + 1}个章节的文档列表必须是数组`;
    }
  }

}

// ==================== 文集简介相关校验 ====================

/**
 * 校验更新文集简介请求
 * @param data 请求参数
 * @throws BusinessError 校验失败时抛出
 */
export function validateUpdateProjectIntroRequest(
  data: UpdateProjectIntroRequest,
): void {
  // 1. 必填校验
  if (data.intro === undefined || data.intro === null) {
    throw new BusinessError('文集简介不能为空', CommonErrorCodes.VALIDATION_FAILED);
  }

}
