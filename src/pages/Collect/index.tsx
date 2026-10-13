// src/pages/Collect/index.tsx
// 收藏页面 - Dva Hooks + 组件自治 + clientLoader 预加载
// Tab：收藏文集 / 收藏文档（均带分组管理，统一收藏接口，type 区分）
// index.tsx 仅负责：clientLoader 预加载、数据同步到 model、Tab/分组状态、Tab 切换加载、页面布局
// 数据获取、翻页、查看、取消收藏、移动分组、分组管理等逻辑已下沉到子组件自治
import { fetchCollectGroups, fetchCollectList } from '@/services';
import { useClientLoaderSync } from '@/hooks';
import {
  extractListWithPagination,
  extractResponseData,
} from '@/utils/clientLoader';
import { FolderOpenOutlined, StarOutlined } from '@ant-design/icons';
import { useClientLoaderData, useDispatch } from '@umijs/max';
import { useSetState } from 'ahooks';
import { Col, Row, Tabs } from 'antd';
import React, { useEffect, useRef } from 'react';
import {
  CollectDocList,
  CollectProjectList,
  CollectSidebar,
  GroupManagerModal,
} from './components';
import './index.less';
import type { CollectTabType } from './types';

// ==================== clientLoader：页面渲染前并行预加载初始 tab 数据 ====================
// 初始 tab 为收藏文集（type=project）
// 不传 user_id，后端从 token 解析当前用户（mock 环境兜底 user_id=1）
export async function clientLoader() {
  try {
    const [groupsRes, listRes] = await Promise.all([
      fetchCollectGroups({ type: 'project' }),
      fetchCollectList({
        page: 1,
        page_size: 10,
        group_id: -1,
        type: 'project',
      }),
    ]);
    const groupsData = extractResponseData<any>(groupsRes, {});
    const { list, total, page } = extractListWithPagination<any>(listRes);
    return {
      collectGroups: groupsData.list || [],
      collectUngroupedCount: groupsData.ungrouped_count || 0,
      collectTotalCount: groupsData.total_count || 0,
      collectList: list,
      collectTotal: total,
      collectPage: page,
    };
  } catch (e) {
    return {
      collectGroups: [],
      collectUngroupedCount: 0,
      collectTotalCount: 0,
      collectList: [],
      collectTotal: 0,
      collectPage: 1,
    };
  }
}

const CollectPage: React.FC = () => {
  const dispatch = useDispatch();

  // useClientLoaderData 返回 { data: clientLoader返回值 }
  const { data: clientLoaderData } = useClientLoaderData() as {
    data: {
      collectGroups: any[];
      collectUngroupedCount: number;
      collectTotalCount: number;
      collectList: any[];
      collectTotal: number;
      collectPage: number;
    };
  };

  // ==================== 页面状态 ====================
  const [state, setState] = useSetState({
    activeTab: 'project' as CollectTabType,
    // 当前激活分组（两个 tab 各自维护）
    activeGroupMap: { project: -1, doc: -1 } as Record<CollectTabType, number>,
    // 分组管理弹窗（两个 tab 各自维护）
    groupModalMap: { project: false, doc: false } as Record<
      CollectTabType,
      boolean
    >,
  });
  const { activeTab, activeGroupMap, groupModalMap } = state;
  const activeGroupId = activeGroupMap[activeTab];

  // ==================== 数据同步：clientLoader 预加载数据 → Dva model ====================
  // 只同步一次，避免后续交互更新被覆盖
  useClientLoaderSync({
    clientLoaderData,
    actionType: 'collect/saveCollectInitialData',
    mapData: (data) => ({
      groups: {
        list: data.collectGroups,
        ungrouped_count: data.collectUngroupedCount,
        total_count: data.collectTotalCount,
      },
      list: {
        list: data.collectList,
        total: data.collectTotal,
        page: data.collectPage,
      },
    }),
    hasData: (data) => data?.collectGroups?.length > 0,
  });

  // ==================== 数据加载 ====================
  const fetchGroups = (type: CollectTabType) => {
    dispatch({ type: 'collect/fetchCollectGroups', payload: { type } });
  };

  const fetchList = (type: CollectTabType, page: number, groupId: number) => {
    dispatch({
      type: 'collect/fetchCollectList',
      payload: { page, page_size: 10, group_id: groupId, type },
    });
  };

  // Tab 切换时加载对应数据（初始 tab 数据由 clientLoader 预加载）
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return; // 初始加载由 clientLoader 完成
    }
    fetchGroups(activeTab);
    fetchList(activeTab, 1, activeGroupMap[activeTab]);
  }, [activeTab, activeGroupMap]);

  // ==================== 事件处理 ====================

  // 选择分组
  const handleSelectGroup = (groupId: number) => {
    setState((prev) => ({
      activeGroupMap: { ...prev.activeGroupMap, [activeTab]: groupId },
    }));
    fetchList(activeTab, 1, groupId);
  };

  // 删除分组后，如果当前选中的是被删除的分组，重置为全部
  const handleDeleteGroup = (id: number) => {
    if (activeGroupId === id) {
      setState((prev) => ({
        activeGroupMap: { ...prev.activeGroupMap, [activeTab]: -1 },
      }));
    }
  };

  // Tab 配置
  const tabItems = [
    {
      key: 'project',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FolderOpenOutlined />
          收藏文集
        </span>
      ),
    },
    {
      key: 'doc',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <StarOutlined />
          收藏文档
        </span>
      ),
    },
  ];

  // ==================== 页面布局 ====================
  return (
    <div className="collect-page">
      {/* 顶部 Tab */}
      <div className="collect-tabs-wrapper">
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setState({ activeTab: key as CollectTabType })}
          items={tabItems}
          className="collect-tabs"
        />
      </div>

      {/* 左右分栏（两个 tab 共用布局，根据 activeTab 渲染不同列表组件） */}
      <Row gutter={16}>
        <Col xs={24} sm={24} md={8} lg={6} xl={5}>
          <CollectSidebar
            activeGroupId={activeGroupId}
            onSelectGroup={handleSelectGroup}
            onOpenGroupManager={() =>
              setState((prev) => ({
                groupModalMap: {
                  ...prev.groupModalMap,
                  [activeTab]: true,
                },
              }))
            }
          />
        </Col>
        <Col xs={24} sm={24} md={16} lg={18} xl={19}>
          {activeTab === 'project' ? (
            <CollectProjectList activeGroupId={activeGroupId} />
          ) : (
            <CollectDocList activeGroupId={activeGroupId} />
          )}
        </Col>
      </Row>

      {/* 分组管理弹窗（两个 tab 共用，根据 activeTab 传递不同 type） */}
      <GroupManagerModal
        visible={groupModalMap[activeTab]}
        activeTab={activeTab}
        onClose={() =>
          setState((prev) => ({
            groupModalMap: { ...prev.groupModalMap, [activeTab]: false },
          }))
        }
        onDeleteGroup={handleDeleteGroup}
      />
    </div>
  );
};

export default CollectPage;
