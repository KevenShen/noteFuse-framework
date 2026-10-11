// src/pages/Quick/index.tsx
// 快捷操作页面 - Dva Hooks + 组件化拆分 + clientLoader 并行预加载
// 布局：顶部分类筛选栏（分组select+管理） + 下方快捷操作卡片网格
import { fetchQuickGroups, fetchQuickItems } from '@/services';
import {
  history,
  useClientLoaderData,
  useDispatch,
  useSelector,
} from '@umijs/max';
import { Dropdown, MenuProps, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { QuickFilter, QuickGroupManager } from './components';
import './index.less';
import type { QuickGroup, QuickItem } from './types';

// ==================== Action 路由映射表 ====================
// 将 action 类型的快捷操作映射到实际路由或处理函数
const ACTION_ROUTE_MAP: Record<string, string> = {
  createDoc: '/DocEditor', // 新建文档
  createProject: '/Project', // 新建文集（页面内处理）
  searchDoc: '/Project', // 搜索文档（文集列表页搜索）
  docHistory: '/Project', // 文档历史（跳转文集列表选择文档）
  exportPdf: '/Project', // 导出 PDF（需选择文档）
  exportMarkdown: '/Project', // 导出 Markdown（需选择文档）
  shareDoc: '/Project', // 分享文档（需选择文档）
  jsonFormatter: '/Quick', // JSON 格式化（当前页占位，后续可独立页面）
  regexTester: '/Quick', // 正则测试（当前页占位，后续可独立页面）
};

// ==================== clientLoader：页面渲染前并行预加载初始数据 ====================
// 优势：两个请求并行发起，避免 useEffect 中的串行请求，减少首屏等待时间
// 不传 user_id，后端从 token 解析当前用户（mock 环境兜底 user_id=1）
export async function clientLoader() {
  try {
    // 并行发起两个请求
    const [itemsRes, groupsRes] = await Promise.all([
      fetchQuickItems(),
      fetchQuickGroups({}),
    ]);
    // 兼容多种返回结构：res.data（标准响应体）或 res 本身（拦截器已剥离）
    const quickItems = itemsRes?.data ?? itemsRes ?? [];
    const quickGroups = groupsRes?.data ?? groupsRes ?? [];
    return { quickItems, quickGroups };
  } catch (e) {
    return { quickItems: [], quickGroups: [] };
  }
}

const QuickPage: React.FC = () => {
  const dispatch = useDispatch();
  // useClientLoaderData 返回 { data: clientLoader返回值 }，直接解构 data
  const { data: clientLoaderData } = useClientLoaderData() as {
    data: { quickItems: any[]; quickGroups: any[] };
  };

  // ==================== Dva Hooks 取数 ====================
  const {
    quickItems: modelItems,
    quickGroups: modelGroups,
    quickItemsLoading,
    quickGroupsLoading,
    quickGroupSubmitting,
  } = useSelector((state: any) => state.quick);

  // 优先 model 数据（交互更新后），兜底 clientLoader 预加载数据（首屏）
  const { quickItems, quickGroups } = useMemo(() => {
    const useModel = modelItems?.length > 0 || modelGroups?.length > 0;
    const src = useModel
      ? { items: modelItems, groups: modelGroups }
      : { items: clientLoaderData?.quickItems, groups: clientLoaderData?.quickGroups };
    return {
      quickItems: src.items || [],
      quickGroups: src.groups || [],
    };
  }, [modelItems, modelGroups, clientLoaderData]);

  // ==================== 页面状态 ====================
  const [groupManagerOpen, setGroupManagerOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number | 'all'>('all');

  // ==================== 数据同步：clientLoader 预加载数据 → Dva model ====================
  // 用 useRef 标记，避免 setState 导致额外渲染
  const syncedRef = React.useRef(false);
  useEffect(() => {
    if (syncedRef.current) return;
    if (clientLoaderData?.quickItems?.length) {
      // 合并 dispatch，一次更新 model，减少渲染次数
      dispatch({
        type: 'quick/saveQuickInitialData',
        payload: {
          quickItems: clientLoaderData.quickItems,
          quickGroups: clientLoaderData.quickGroups,
        },
      });
      syncedRef.current = true;
    }
  }, [clientLoaderData, dispatch]);

  // ==================== 计算属性 ====================

  // 根据分组筛选后的操作项
  const filteredItems = useMemo(() => {
    if (selectedGroupId === 'all') {
      return quickItems || [];
    }
    const group = (quickGroups || []).find(
      (g: QuickGroup) => g.id === selectedGroupId,
    );
    return group?.items || [];
  }, [quickItems, quickGroups, selectedGroupId]);

  // ==================== 事件处理 ====================

  // 切换分组筛选
  const handleGroupChange = useCallback((groupId: number | 'all') => {
    setSelectedGroupId(groupId);
  }, []);

  // 点击快捷操作项
  const handleItemClick = useCallback((item: QuickItem) => {
    if (item.type === 'link' && item.url) {
      // link 类型：直接跳转路由
      history.push(item.url);
    } else if (item.type === 'action' && item.action) {
      // action 类型：根据映射表跳转
      const targetRoute = ACTION_ROUTE_MAP[item.action];
      if (targetRoute) {
        history.push(targetRoute);
      } else {
        // 未配置的 action，提示暂不支持
        message.info(`「${item.name}」功能开发中，敬请期待`);
      }
    } else if (item.type === 'template' && item.template_id) {
      // template 类型：使用模板创建文档
      history.push(`/DocEditor?template_id=${item.template_id}`);
    } else {
      message.info('该操作暂不支持');
    }
  }, []);

  // 添加操作项到分组（不传 user_id，后端从 token 解析）
  const handleAddToGroup = useCallback(
    (item: QuickItem, groupId: number) => {
      dispatch({
        type: 'quick/addQuickItemToGroup',
        payload: { group_id: groupId, item_id: item.id },
      });
    },
    [dispatch],
  );

  // 创建分组（不传 user_id，后端从 token 解析）
  const handleCreateGroup = useCallback(
    (name: string) => {
      dispatch({
        type: 'quick/createQuickGroup',
        payload: { name },
      });
    },
    [dispatch],
  );

  // 重命名分组（不传 user_id，后端从 token 解析）
  const handleRenameGroup = useCallback(
    (id: number, name: string) => {
      dispatch({
        type: 'quick/updateQuickGroup',
        payload: { id, name },
      });
    },
    [dispatch],
  );

  // 删除分组（不传 user_id，后端从 token 解析）
  const handleDeleteGroup = useCallback(
    (id: number) => {
      dispatch({
        type: 'quick/deleteQuickGroup',
        payload: { id },
      });
      // 如果删除的是当前选中的分组，重置为全部
      if (selectedGroupId === id) {
        setSelectedGroupId('all');
      }
    },
    [dispatch, selectedGroupId],
  );

  // 卡片右键菜单：添加到分组
  const getCardContextMenu = (item: QuickItem): MenuProps['items'] => [
    {
      key: 'add-to-group',
      label: '添加到分组',
      children: (quickGroups || []).map((g: QuickGroup) => ({
        key: String(g.id),
        label: g.name,
        onClick: () => handleAddToGroup(item, g.id),
      })),
    },
  ];

  // ==================== 页面布局 ====================
  return (
    <div className="quick-page">
      {/* 顶部分类筛选栏（分组select+管理按钮） */}
      <QuickFilter
        loading={quickGroupsLoading}
        totalCount={filteredItems.length}
        groups={quickGroups}
        selectedGroupId={selectedGroupId}
        onGroupChange={handleGroupChange}
        onOpenGroupManager={() => setGroupManagerOpen(true)}
      />

      {/* 快捷操作卡片网格（全宽） */}
      <div className="quick-grid-wrapper">
        {filteredItems.map((item: QuickItem) => (
          <Dropdown
            key={item.id}
            menu={{ items: getCardContextMenu(item) }}
            trigger={['contextMenu']}
          >
            <div className="quick-card" onClick={() => handleItemClick(item)}>
              <div className="quick-card-type-badge quick-card-type-{item.type}">
                {item.type === 'link' ? '跳转' : item.type === 'action' ? '动作' : '模板'}
              </div>
              <div className="quick-card-icon">{item.icon}</div>
              <div className="quick-card-name">{item.name}</div>
              <div className="quick-card-desc">{item.description}</div>
            </div>
          </Dropdown>
        ))}
        {quickItemsLoading && (
          <div className="quick-grid-loading">加载中...</div>
        )}
        {!quickItemsLoading && filteredItems.length === 0 && (
          <div className="quick-grid-empty">该分类下暂无快捷操作</div>
        )}
      </div>

      {/* 分组管理器弹窗 */}
      <QuickGroupManager
        open={groupManagerOpen}
        groups={quickGroups}
        loading={quickGroupsLoading}
        submitting={quickGroupSubmitting}
        onClose={() => setGroupManagerOpen(false)}
        onCreate={handleCreateGroup}
        onRename={handleRenameGroup}
        onDelete={handleDeleteGroup}
      />
    </div>
  );
};

export default QuickPage;
