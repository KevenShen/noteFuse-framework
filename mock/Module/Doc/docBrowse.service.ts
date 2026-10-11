/**
 * 文档浏览历史服务层
 *
 * 【职责】
 * - 只处理文档浏览历史相关的业务逻辑
 * - 返回纯数据，不返回 ServiceResult 格式
 * - 业务异常抛出 BusinessError，由控制器层统一捕获
 * - 使用 database/mongodb/redis 进行数据操作
 */

import type { Request } from 'express';
import { BusinessError } from '../../Core';
import { redis } from '../../Core/redis';
import {
  docAnnotationTable,
  docBrowseHistoryTable,
  docCategoryChainCache,
  docCategoryDocsCache,
  docCategoryInfoCache,
  docCategoryMongoCollection,
  docCategoryOrderCache,
  docCategoryTable,
  docInfoCache,
  docListCache,
  docMongoCollection,
  docTable,
  docVersionCache,
  docVersionMongoCollection,
  docVersionTable,
  type MockDoc,
  type MockDocAnnotation,
  type MockDocCategory,
  type MockDocVersion,
  type MockVersionStatus,
} from '../../Entities/doc';
import { projectMongoCollection, projectTable } from '../../Entities/project';
import { tagRelations, tags } from '../../Entities/tag';

export async function recordDocBrowse(
  docId: number,
  userId: number,
): Promise<void> {
  await docBrowseHistoryTable.create({
    doc_id: docId,
    user_id: Number(userId),
    browse_time: Date.now(),
    doc_name: '',
    project_id: 0,
    project_name: '',
  } as any);
}

