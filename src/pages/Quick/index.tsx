// src/pages/Quick/index.tsx
// 快捷操作页面 - Dva Hooks + 组件自治 + clientLoader 并行预加载
// 布局：顶部分类筛选栏（分组select+管理） + 下方快捷操作卡片网格
// index.tsx 仅负责：clientLoader 预加载、数据同步到 model、selectedGroupId/groupManagerOpen 状态、页面布局
// 分组筛选、卡片点击、右键菜单、分组管理等逻辑已下沉到子组件自治
import { fetchQuickGroups, fetchQuickItems } from '@/services';
import { useClientLoaderSync } from '@/hooks';
import { extractResponseData } from '@/utils/clientLoader';
import { useClientLoaderData } from '@umijs/max';
import React, { useState } from 'react';
import { QuickFilter, QuickGrid, QuickGroupManager } from './components';
import './index.less';

// ==================== clientLoader：页面渲染前并行预加载初始数据 ====================
export async function clientLoader() {
  try {
    const [itemsRes, groupsRes] = await Promise.all([
      fetchQuickItems(),
      fetchQuickGroups({}),
    ]);
    const quickItems = extractResponseData<any[]>(itemsRes, []);
    const quickGroups = extractResponseData<any[]>(groupsRes, []);
    return { quickItems, quickGroups };
  } catch (e) {
    return { quickItems: [], quickGroups: [] };
  }
}

const QuickPage: React.FC = () => {
  // useClientLoaderData 返回 { data: clientLoader返回值 }
  const { data: clientLoaderData } = useClientLoaderData() as {
    data: { quickItems: any[]; quickGroups: any[] };
  };

  // ==================== 页面状态 ====================
  const [groupManagerOpen, setGroupManagerOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number | 'all'>('all');

  // ==================== 数据同步：clientLoader 预加载数据 → Dva model ====================
  useClientLoaderSync({
    clientLoaderData,
    actionType: 'quick/saveQuickInitialData',
    mapData: (data) => ({
      quickItems: data.quickItems,
      quickGroups: data.quickGroups,
    }),
    hasData: (data) => data?.quickItems?.length > 0,
  });

  // 删除分组后，如果删除的是当前选中的分组，重置为全部
  const handleDeleteGroup = (id: number) => {
    if (selectedGroupId === id) {
      setSelectedGroupId('all');
    }
  };

  // ==================== 页面布局 ====================
  return (
    <div className="quick-page">
      {/* 顶部分类筛选栏（分组select+管理按钮） */}
      <QuickFilter
        selectedGroupId={selectedGroupId}
        onGroupChange={setSelectedGroupId}
        onOpenGroupManager={() => setGroupManagerOpen(true)}
      />

      {/* 快捷操作卡片网格（全宽） */}
      <div className="quick-grid-wrapper">
        <QuickGrid selectedGroupId={selectedGroupId} />
      </div>

      {/* 分组管理器弹窗 */}
      <QuickGroupManager
        open={groupManagerOpen}
        onClose={() => setGroupManagerOpen(false)}
        onDeleteGroup={handleDeleteGroup}
      />
    </div>
  );
};

export default QuickPage;
