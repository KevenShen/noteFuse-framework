// src/pages/Tags/index.tsx
// 标签页面 - Dva Hooks + 组件化拆分 + clientLoader 预加载
// 布局：左侧标签分类面板（Dropdown 三级分类 + 标签） + 右侧标签文档列表
import { fetchTagCategories } from '@/services';
import {
  history,
  useClientLoaderData,
  useDispatch,
  useSelector,
} from '@umijs/max';
import { Col, Row } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TagCategoryManager, TagCategoryPanel, TagDocList } from './components';
import type { TagDocItem, TagItem } from './types';
import './index.less';

// ==================== clientLoader：页面渲染前预加载标签分类 ====================
export async function clientLoader() {
  try {
    const res = await fetchTagCategories({ params: { type: 'doc' } });
    // 兼容多种返回结构：res.data（标准响应体）或 res 本身
    const tagCategories = res?.data ?? res ?? [];
    return { tagCategories };
  } catch (e) {
    return { tagCategories: [] };
  }
}

const TagsPage: React.FC = () => {
  const dispatch = useDispatch();

  // useClientLoaderData 返回 { data: clientLoader返回值 }
  const { data: clientLoaderData } = useClientLoaderData() as {
    data: { tagCategories: any[] };
  };

  // ==================== Dva Hooks 取数 ====================
  const {
    tagCategories: modelTagCategories,
    tagCategoriesLoading,
    tagCategorySubmitting,
    tagSubmitting,
    tagDocList,
    tagDocTotal,
    tagDocPage,
    tagDocLoading,
    selectedTagId,
  } = useSelector((state: any) => state.tag);

  // 优先 model 数据（交互更新后），兜底 clientLoader 预加载数据（首屏）
  const { tagCategories } = useMemo(() => {
    const useModel = modelTagCategories?.length > 0;
    const src = useModel ? modelTagCategories : clientLoaderData?.tagCategories;
    return { tagCategories: src || [] };
  }, [modelTagCategories, clientLoaderData]);

  // ==================== 页面状态 ====================
  const [pageSize] = useState(10);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);

  // ==================== 数据同步：clientLoader 预加载数据 → Dva model ====================
  // 用 useRef 标记，避免 setState 导致额外渲染
  const syncedRef = React.useRef(false);
  useEffect(() => {
    if (syncedRef.current) return;
    if (clientLoaderData?.tagCategories?.length) {
      dispatch({ type: 'tag/saveTagCategories', payload: clientLoaderData.tagCategories });
      syncedRef.current = true;
    }
  }, [clientLoaderData, dispatch]);

  // 选中标签时获取文档列表
  const fetchTagDocs = useCallback(
    (tagId: number, page: number) => {
      dispatch({
        type: 'tag/fetchTagDocs',
        payload: { id: tagId, page, page_size: pageSize },
      });
    },
    [dispatch, pageSize],
  );

  // ==================== 计算属性 ====================

  // 当前选中标签名称
  const selectedTagName = useMemo(() => {
    if (!selectedTagId) return '';
    for (const category of tagCategories) {
      const tag = category.tags?.find((t: TagItem) => t.id === selectedTagId);
      if (tag) return tag.name;
    }
    return '';
  }, [selectedTagId, tagCategories]);

  // ==================== 事件处理 ====================

  // 选择标签
  const handleSelectTag = (tagId: number | null) => {
    if (tagId) {
      fetchTagDocs(tagId, 1);
    } else {
      dispatch({ type: 'tag/setSelectedTag', payload: null });
      dispatch({ type: 'tag/saveTagDocList', payload: { list: [], total: 0, page: 1 } });
    }
  };

  // 翻页
  const handlePageChange = (page: number) => {
    if (selectedTagId) {
      fetchTagDocs(selectedTagId, page);
    }
  };

  // 查看文档
  const handleViewDoc = (doc: TagDocItem) => {
    history.push(`/doc/${doc.id}?project_id=${doc.project_id}`);
  };

  // ==================== 分类管理事件 ====================

  // 新建分类
  const handleCreateCategory = useCallback(
    (name: string, parent_id: number) => {
      dispatch({
        type: 'tag/createTagCategory',
        payload: { name, parent_id, type: 'doc' },
      });
    },
    [dispatch],
  );

  // 重命名分类
  const handleRenameCategory = useCallback(
    (id: number, name: string) => {
      dispatch({
        type: 'tag/updateTagCategory',
        payload: { id, name },
      });
    },
    [dispatch],
  );

  // 删除分类
  const handleDeleteCategory = useCallback(
    (id: number) => {
      dispatch({
        type: 'tag/deleteTagCategory',
        payload: { id },
      });
    },
    [dispatch],
  );

  // 分类排序（同级上下移动）
  const handleMoveCategory = useCallback(
    (id: number, direction: 'up' | 'down') => {
      dispatch({
        type: 'tag/moveTagCategory',
        payload: { id, direction },
      });
    },
    [dispatch],
  );

  // ==================== 标签管理事件 ====================

  // 新建标签
  const handleCreateTag = useCallback(
    (name: string, categoryId: number, color?: string) => {
      dispatch({
        type: 'tag/createTag',
        payload: { name, category_id: categoryId, color, type: 'doc' },
      });
    },
    [dispatch],
  );

  // 修改标签
  const handleUpdateTag = useCallback(
    (id: number, name: string, color?: string) => {
      dispatch({
        type: 'tag/updateTag',
        payload: { id, name, color },
      });
    },
    [dispatch],
  );

  // 删除标签
  const handleDeleteTag = useCallback(
    (id: number) => {
      // 如果删除的是当前选中的标签，先取消选中
      if (selectedTagId === id) {
        dispatch({ type: 'tag/setSelectedTag', payload: null });
        dispatch({ type: 'tag/saveTagDocList', payload: { list: [], total: 0, page: 1 } });
      }
      dispatch({
        type: 'tag/deleteTag',
        payload: { id },
      });
    },
    [dispatch, selectedTagId],
  );

  // ==================== 页面布局（左右布局，兼容移动端） ====================
  return (
    <div className="tags-page">
      <Row gutter={16}>
        {/* 左侧标签分类面板 */}
        <Col xs={24} sm={24} md={8} lg={6} xl={5}>
          <TagCategoryPanel
            categories={tagCategories}
            loading={tagCategoriesLoading}
            selectedTagId={selectedTagId}
            onSelectTag={handleSelectTag}
            onOpenCategoryManager={() => setCategoryManagerOpen(true)}
            onCreateTag={handleCreateTag}
            onUpdateTag={handleUpdateTag}
            onDeleteTag={handleDeleteTag}
            tagSubmitting={tagSubmitting}
          />
        </Col>

        {/* 右侧标签文档列表 */}
        <Col xs={24} sm={24} md={16} lg={18} xl={19}>
          <TagDocList
            list={tagDocList}
            loading={tagDocLoading}
            total={tagDocTotal}
            page={tagDocPage}
            pageSize={pageSize}
            selectedTagName={selectedTagName}
            onPageChange={handlePageChange}
            onView={handleViewDoc}
            onClearTag={() => handleSelectTag(null)}
          />
        </Col>
      </Row>

      {/* 标签分类管理器弹窗 */}
      <TagCategoryManager
        open={categoryManagerOpen}
        categories={tagCategories}
        loading={tagCategoriesLoading}
        submitting={tagCategorySubmitting}
        onClose={() => setCategoryManagerOpen(false)}
        onCreate={handleCreateCategory}
        onRename={handleRenameCategory}
        onDelete={handleDeleteCategory}
        onMove={handleMoveCategory}
      />
    </div>
  );
};

export default TagsPage;
