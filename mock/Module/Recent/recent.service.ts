// mock/Module/Recent/recent.service.ts
// Recent 模块业务逻辑层（Service）
// 职责：处理最近文档、最近创建、最近更新、最近浏览等业务逻辑

import type {
  GetRecentDocsRequest,
  RecentDocItem,
  RecentCreatedItem,
  RecentUpdatedItem,
  RecentBrowsedItem,
} from './recent.dto';
import { recentRepository } from './recent.repository';

// ============================================================================
// Recent 服务类
// ============================================================================

class RecentService {
  // ==================== 最近使用文档 ====================

  /**
   * 获取最近使用文档列表（分页 + 时间筛选）
   * @param userId 用户 ID
   * @param data 请求参数
   * @returns 分页结果
   */
  async getRecentDocs(
    userId: number,
    data: GetRecentDocsRequest,
  ): Promise<{ list: RecentDocItem[]; total: number; page: number; page_size: number }> {
    const page = data.page ?? 1;
    const pageSize = data.page_size ?? 10;
    const timeFilter = data.time_filter ?? 'all';

    // 1. 获取数据
    const [allDocs, allProjects, allVersions] = await Promise.all([
      recentRepository.findAllDocs(),
      recentRepository.findAllProjects(),
      recentRepository.findAllVersions(),
    ]);

    // 2. 按修改时间倒序
    let list = [...allDocs].sort((a, b) => b.modify_time - a.modify_time);

    // 3. 时间筛选
    const now = Date.now();
    if (timeFilter === 'today') {
      list = list.filter((d) => d.modify_time > now - 86400000);
    } else if (timeFilter === 'week') {
      list = list.filter((d) => d.modify_time > now - 86400000 * 7);
    } else if (timeFilter === 'month') {
      list = list.filter((d) => d.modify_time > now - 86400000 * 30);
    }

    // 4. 关联文集名称和作者信息
    const result: RecentDocItem[] = list.map((doc) => {
      const project = allProjects.find((p) => p.id === doc.project_id);
      const currentVersion = allVersions.find(
        (v) => v.doc_id === doc.id && v.id === doc.current_version_id,
      );
      return {
        ...doc,
        project_name: project?.name || '未知文集',
        author_name: currentVersion?.author_name || '未知',
        author_id: currentVersion?.author_id || 0,
        summary: doc.summary,
      };
    });

    // 5. 分页
    const total = result.length;
    const start = (page - 1) * pageSize;
    const pagedList = result.slice(start, start + pageSize);

    return {
      list: pagedList,
      total,
      page,
      page_size: pageSize,
    };
  }

  // ==================== 最近创建文档 ====================

  /**
   * 获取最近创建的文档
   * @param userId 用户 ID
   * @param data 请求参数
   * @returns 分页结果
   */
  async getRecentCreated(
    userId: number,
    data: { page?: number; page_size?: number },
  ): Promise<{ list: RecentCreatedItem[]; total: number; page: number; page_size: number }> {
    const page = data.page ?? 1;
    const pageSize = data.page_size ?? 10;

    // 1. 获取数据
    const [allDocs, allProjects, allVersions] = await Promise.all([
      recentRepository.findAllDocs(),
      recentRepository.findAllProjects(),
      recentRepository.findAllVersions(),
    ]);

    // 2. 关联文集名称和作者信息，按创建时间排序
    const result: RecentCreatedItem[] = allDocs
      .map((doc) => {
        const project = allProjects.find((p) => p.id === doc.project_id);
        const firstVersion = [...allVersions]
          .filter((v) => v.doc_id === doc.id)
          .sort((a, b) => new Date(a.create_time).getTime() - new Date(b.create_time).getTime())[0];
        return {
          ...doc,
          project_name: project?.name || '未知文集',
          author_name: firstVersion?.author_name || '未知',
          author_id: firstVersion?.author_id || 0,
          create_time: firstVersion?.create_time || '',
        };
      })
      .sort((a, b) => new Date(b.create_time).getTime() - new Date(a.create_time).getTime());

    // 3. 分页
    const total = result.length;
    const start = (page - 1) * pageSize;
    const pagedList = result.slice(start, start + pageSize);

    return {
      list: pagedList,
      total,
      page,
      page_size: pageSize,
    };
  }

  // ==================== 最近更新文档 ====================

  /**
   * 获取最近更新的文档
   * @param userId 用户 ID
   * @param data 请求参数
   * @returns 分页结果
   */
  async getRecentUpdated(
    userId: number,
    data: { page?: number; page_size?: number },
  ): Promise<{ list: RecentUpdatedItem[]; total: number; page: number; page_size: number }> {
    const page = data.page ?? 1;
    const pageSize = data.page_size ?? 10;

    // 1. 获取数据
    const [allDocs, allProjects, allVersions] = await Promise.all([
      recentRepository.findAllDocs(),
      recentRepository.findAllProjects(),
      recentRepository.findAllVersions(),
    ]);

    // 2. 关联文集名称和作者信息，按更新时间排序
    const result: RecentUpdatedItem[] = allDocs
      .map((doc) => {
        const project = allProjects.find((p) => p.id === doc.project_id);
        const currentVersion = allVersions.find(
          (v) => v.doc_id === doc.id && v.id === doc.current_version_id,
        );
        return {
          ...doc,
          project_name: project?.name || '未知文集',
          author_name: currentVersion?.author_name || '未知',
          author_id: currentVersion?.author_id || 0,
          update_time: currentVersion?.update_time || '',
        };
      })
      .sort((a, b) => new Date(b.update_time).getTime() - new Date(a.update_time).getTime());

    // 3. 分页
    const total = result.length;
    const start = (page - 1) * pageSize;
    const pagedList = result.slice(start, start + pageSize);

    return {
      list: pagedList,
      total,
      page,
      page_size: pageSize,
    };
  }

  // ==================== 最近浏览文档 ====================

  /**
   * 获取最近浏览的文档（当前用户）
   * @param userId 用户 ID
   * @param data 请求参数
   * @returns 分页结果
   */
  async getRecentBrowsed(
    userId: number,
    data: { page?: number; page_size?: number },
  ): Promise<{ list: RecentBrowsedItem[]; total: number; page: number; page_size: number }> {
    const page = data.page ?? 1;
    const pageSize = data.page_size ?? 10;

    // 1. 获取数据
    const [userHistory, allDocs, allProjects, allVersions] = await Promise.all([
      recentRepository.findBrowseHistoryByUserId(userId),
      recentRepository.findAllDocs(),
      recentRepository.findAllProjects(),
      recentRepository.findAllVersions(),
    ]);

    // 2. 按浏览时间倒序
    const sortedHistory = userHistory.sort((a, b) => b.browse_time - a.browse_time);

    // 3. 去重（同一文档只保留最近一次浏览）
    const seenDocIds = new Set<number>();
    const uniqueHistory = sortedHistory.filter((h) => {
      if (seenDocIds.has(h.doc_id)) return false;
      seenDocIds.add(h.doc_id);
      return true;
    });

    // 4. 关联文档信息
    const result: RecentBrowsedItem[] = uniqueHistory
      .map((h) => {
        const doc = allDocs.find((d) => d.id === h.doc_id);
        if (!doc) return null;
        const project = allProjects.find((p) => p.id === doc.project_id);
        const currentVersion = allVersions.find(
          (v) => v.doc_id === doc.id && v.id === doc.current_version_id,
        );
        return {
          ...doc,
          project_name: project?.name || '未知文集',
          author_name: currentVersion?.author_name || '未知',
          author_id: currentVersion?.author_id || 0,
          browse_time: h.browse_time,
        };
      })
      .filter(Boolean) as RecentBrowsedItem[];

    // 5. 分页
    const total = result.length;
    const start = (page - 1) * pageSize;
    const pagedList = result.slice(start, start + pageSize);

    return {
      list: pagedList,
      total,
      page,
      page_size: pageSize,
    };
  }
}

// ============================================================================
// 导出 Service 实例
// ============================================================================

export const recentService = new RecentService();
