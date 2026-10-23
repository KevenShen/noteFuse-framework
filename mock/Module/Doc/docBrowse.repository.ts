// mock/Module/Doc/docBrowse.repository.ts
// 文档浏览历史数据访问层（Repository 模式）
// 职责：封装浏览历史的存取细节

import { docBrowseHistoryTable } from '../../Entities/doc';

// ============================================================================
// 文档浏览历史数据访问类
// ============================================================================

class DocBrowseRepository {
  /**
   * 记录文档浏览历史
   * @param data 浏览历史数据
   */
  async create(data: {
    doc_id: number;
    user_id: number;
    browse_time: number;
    doc_name?: string;
    project_id?: number;
    project_name?: string;
  }): Promise<void> {
    await docBrowseHistoryTable.create(data as any);
  }

  /**
   * 查询指定用户的浏览历史
   * @param userId 用户 ID
   * @param limit 返回数量
   * @returns 浏览历史数组
   */
  async findByUserId(userId: number, limit: number = 20): Promise<any[]> {
    const allHistory = await docBrowseHistoryTable.findAll();
    return allHistory
      .filter((h) => h.user_id === userId)
      .sort((a, b) => b.browse_time - a.browse_time)
      .slice(0, limit);
  }

  /**
   * 删除指定文档的浏览历史
   * @param docId 文档 ID
   */
  async deleteByDocId(docId: number): Promise<void> {
    const allHistory = await docBrowseHistoryTable.findAll();
    const historyIds = allHistory
      .filter((h) => h.doc_id === docId)
      .map((h) => h.id);
    for (const historyId of historyIds) {
      await docBrowseHistoryTable.deleteById(historyId);
    }
  }
}

// ============================================================================
// 导出 Repository 实例
// ============================================================================

export const docBrowseRepository = new DocBrowseRepository();
