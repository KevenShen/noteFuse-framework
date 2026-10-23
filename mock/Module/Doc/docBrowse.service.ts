// mock/Doc/docBrowse.service.ts
// 文档浏览历史服务层
// 职责：处理文档浏览历史相关的业务逻辑

import { docBrowseRepository } from './docBrowse.repository';

// ============================================================================
// 文档浏览历史服务类
// ============================================================================

class DocBrowseService {
  // ==================== 记录浏览历史 ====================

  /**
   * 记录文档浏览历史
   *
   * @param docId 文档 ID
   * @param userId 用户 ID
   */
  async recordDocBrowse(docId: number, userId: number): Promise<void> {
    await docBrowseRepository.create({
      doc_id: docId,
      user_id: Number(userId),
      browse_time: Date.now(),
      doc_name: '',
      project_id: 0,
      project_name: '',
    });
  }
}

// ============================================================================
// 导出服务实例
// ============================================================================

export const docBrowseService = new DocBrowseService();
