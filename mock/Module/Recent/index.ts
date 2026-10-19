// mock/Recent/index.ts
// 最近使用 Mock 接口 - 最近文档、最近创建、最近更新、最近浏览
// 统一响应格式：{ success, errorCode, message, data }

import type { Request, Response } from 'express';
import { db, delay, success, fail } from '../../Core';
import { getCurrentUserFromToken } from '../../Core/auth';

const { docs, projects, doc_versions, doc_browse_history } = db;

/** 从请求 token 中获取当前用户 ID，兜底 1（mock 环境） */
const getUserId = async (req: Request): Promise<number> => {
  const user = await getCurrentUserFromToken(req);
  return user?.id || 1;
};

export default {
  // ---------- 最近使用文档列表（分页 + 时间筛选） ----------
  'GET /api/recent/docs': async (req: Request, res: Response) => {
    await delay(150);
    const {
      page = 1,
      page_size = 10,
      time_filter = 'all', // all/today/week/month
    } = req.query as any;
    const user_id = await getUserId(req);

    // 按修改时间倒序
    let list = [...docs].sort((a, b) => b.modify_time - a.modify_time);

    // 时间筛选
    const now = Date.now();
    if (time_filter === 'today') {
      list = list.filter((d) => d.modify_time > now - 86400000);
    } else if (time_filter === 'week') {
      list = list.filter((d) => d.modify_time > now - 86400000 * 7);
    } else if (time_filter === 'month') {
      list = list.filter((d) => d.modify_time > now - 86400000 * 30);
    }

    // 关联文集名称和作者信息
    const result = list.map((doc) => {
      const project = projects.find((p) => p.id === doc.project_id);
      const currentVersion = doc_versions.find(
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

    // 分页
    const total = result.length;
    const start = (Number(page) - 1) * Number(page_size);
    const pagedList = result.slice(start, start + Number(page_size));

    return res.json(
      success({
        list: pagedList,
        total,
        page: Number(page),
        page_size: Number(page_size),
      }),
    );
  },

  // ---------- 最近创建的文档 ----------
  'GET /api/recent/created': async (req: Request, res: Response) => {
    await delay(200);
    const { page = 1, page_size = 10 } = req.query as any;
    const user_id = await getUserId(req);

    let result = [...docs];
    // 按创建时间排序（modify_time 近似创建时间，取最早的版本）
    result = result
      .map((doc) => {
        const project = projects.find((p) => p.id === doc.project_id);
        const firstVersion = [...doc_versions]
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

    // 分页
    const total = result.length;
    const start = (Number(page) - 1) * Number(page_size);
    const pagedList = result.slice(start, start + Number(page_size));

    return res.json(
      success({
        list: pagedList,
        total,
        page: Number(page),
        page_size: Number(page_size),
      }),
    );
  },

  // ---------- 最近更新的文档 ----------
  'GET /api/recent/updated': async (req: Request, res: Response) => {
    await delay(200);
    const { page = 1, page_size = 10 } = req.query as any;
    const user_id = await getUserId(req);

    let result = [...docs];
    result = result
      .map((doc) => {
        const project = projects.find((p) => p.id === doc.project_id);
        const currentVersion = doc_versions.find(
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

    // 分页
    const total = result.length;
    const start = (Number(page) - 1) * Number(page_size);
    const pagedList = result.slice(start, start + Number(page_size));

    return res.json(
      success({
        list: pagedList,
        total,
        page: Number(page),
        page_size: Number(page_size),
      }),
    );
  },

  // ---------- 最近浏览的文档（当前用户） ----------
  'GET /api/recent/browsed': async (req: Request, res: Response) => {
    await delay(200);
    const { page = 1, page_size = 10 } = req.query as any;
    const user_id = await getUserId(req);

    // 从浏览历史表取当前用户的记录，按浏览时间倒序
    const userHistory = doc_browse_history
      .filter((h) => h.user_id === Number(user_id))
      .sort((a, b) => b.browse_time - a.browse_time);

    // 去重（同一文档只保留最近一次浏览）
    const seenDocIds = new Set<number>();
    const uniqueHistory = userHistory.filter((h) => {
      if (seenDocIds.has(h.doc_id)) return false;
      seenDocIds.add(h.doc_id);
      return true;
    });

    // 关联文档信息
    const result = uniqueHistory
      .map((h) => {
        const doc = docs.find((d) => d.id === h.doc_id);
        if (!doc) return null;
        const project = projects.find((p) => p.id === doc.project_id);
        const currentVersion = doc_versions.find(
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
      .filter(Boolean);

    // 分页
    const total = result.length;
    const start = (Number(page) - 1) * Number(page_size);
    const pagedList = result.slice(start, start + Number(page_size));

    return res.json(
      success({
        list: pagedList,
        total,
        page: Number(page),
        page_size: Number(page_size),
      }),
    );
  },
};
