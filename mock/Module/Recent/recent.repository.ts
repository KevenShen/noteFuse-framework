// mock/Module/Recent/recent.repository.ts
// Recent 模块数据访问层（Repository 模式）
// 职责：封装文档、文集、版本、浏览历史等存取细节
// 【数据分层】L1 MockTable（主存储）

import { db } from '../../Core';

const { docs, projects, doc_versions, doc_browse_history } = db;

// ============================================================================
// Recent 数据访问类
// ============================================================================

class RecentRepository {
  // ==================== 文档查询 ====================

  /**
   * 查询所有文档
   * @returns 文档数组
   */
  async findAllDocs(): Promise<any[]> {
    return docs;
  }

  /**
   * 查询所有文集
   * @returns 文集数组
   */
  async findAllProjects(): Promise<any[]> {
    return projects;
  }

  /**
   * 查询所有文档版本
   * @returns 版本数组
   */
  async findAllVersions(): Promise<any[]> {
    return doc_versions;
  }

  // ==================== 浏览历史查询 ====================

  /**
   * 查询用户的浏览历史
   * @param userId 用户 ID
   * @returns 浏览历史数组
   */
  async findBrowseHistoryByUserId(userId: number): Promise<any[]> {
    return doc_browse_history.filter((h: any) => h.user_id === userId);
  }
}

// ============================================================================
// 导出 Repository 实例
// ============================================================================

export const recentRepository = new RecentRepository();
