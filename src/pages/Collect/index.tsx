// src/pages/Collect/index.tsx
// 收藏页面 - Dva Hooks + 组件化拆分 + clientLoader 预加载
// Tab：收藏文集 / 收藏文档（均带分组管理，统一收藏接口，type 区分）
import { fetchCollectGroups, fetchCollectList } from '@/services';
import { FolderOpenOutlined, StarOutlined } from '@ant-design/icons';
import {
  history,
  useClientLoaderData,
  useDispatch,
  useSelector,
} from '@umijs/max';
import { Col, Row, Tabs } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CollectDocList,
  CollectProjectList,
  CollectSidebar,
  GroupManagerModal,
} from './components';
import type { CollectProjectItem } from './components/CollectProjectList';
import './index.less';
import type { CollectDocItem, CollectGroup } from './types';

type CollectTabType = 'project' | 'doc';

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
    // 兼容多种返回结构（service 泛型与实际返回结构可能不一致）
    const groupsData: any = groupsRes?.data ?? groupsRes ?? {};
    const listData: any = listRes?.data ?? listRes ?? {};
    return {
      collectGroups: groupsData.list || [],
      collectUngroupedCount: groupsData.ungrouped_count || 0,
      collectTotalCount: groupsData.total_count || 0,
      collectList: listData.list || [],
      collectTotal: listData.total || 0,
      collectPage: listData.page || 1,
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

  // ==================== Dva Hooks 取数（统一收藏 state） ====================
  const {
    collectGroups: modelGroups,
    collectGroupLoading,
    collectUngroupedCount: modelUngroupedCount,
    collectTotalCount: modelTotalCount,
    collectList: modelList,
    collectTotal: modelTotal,
    collectPage: modelPage,
    collectLoading,
  } = useSelector((state: any) => state.collect);

  // 优先 model 数据（交互更新后），兜底 clientLoader 预加载数据（首屏）
  const {
    collectGroups,
    collectUngroupedCount,
    collectTotalCount,
    collectList,
    collectTotal,
    collectPage,
  } = useMemo(() => {
    const useModel = modelGroups?.length > 0 || modelList?.length > 0;
    const src = useModel
      ? {
          g: modelGroups,
          uc: modelUngroupedCount,
          tc: modelTotalCount,
          l: modelList,
          lt: modelTotal,
          lp: modelPage,
        }
      : {
          g: clientLoaderData?.collectGroups,
          uc: clientLoaderData?.collectUngroupedCount,
          tc: clientLoaderData?.collectTotalCount,
          l: clientLoaderData?.collectList,
          lt: clientLoaderData?.collectTotal,
          lp: clientLoaderData?.collectPage,
        };
    return {
      collectGroups: src.g || [],
      collectUngroupedCount: src.uc ?? 0,
      collectTotalCount: src.tc ?? 0,
      collectList: src.l || [],
      collectTotal: src.lt ?? 0,
      collectPage: src.lp ?? 1,
    };
  }, [
    modelGroups,
    modelUngroupedCount,
    modelTotalCount,
    modelList,
    modelTotal,
    modelPage,
    clientLoaderData,
  ]);

  // ==================== 页面状态 ====================
  const [activeTab, setActiveTab] = useState<CollectTabType>('project');
  // 当前激活分组（两个 tab 各自维护）
  const [activeGroupMap, setActiveGroupMap] = useState<
    Record<CollectTabType, number>
  >({
    project: -1,
    doc: -1,
  });
  // 分组管理弹窗（两个 tab 各自维护）
  const [groupModalMap, setGroupModalMap] = useState<
    Record<CollectTabType, boolean>
  >({
    project: false,
    doc: false,
  });
  const [pageSize] = useState(10);

  const activeGroupId = activeGroupMap[activeTab];

  // ==================== 数据加载（统一接口，type 区分） ====================

  // 获取分组列表（不传 user_id，后端从 token 解析）
  const fetchGroups = useCallback(
    (type: CollectTabType) => {
      dispatch({
        type: 'collect/fetchCollectGroups',
        payload: { type },
      });
    },
    [dispatch],
  );

  // 获取收藏列表（不传 user_id，后端从 token 解析）
  const fetchList = useCallback(
    (type: CollectTabType, page: number, groupId: number) => {
      dispatch({
        type: 'collect/fetchCollectList',
        payload: {
          page,
          page_size: pageSize,
          group_id: groupId,
          type,
        },
      });
    },
    [dispatch, pageSize],
  );

  // ==================== 数据同步：clientLoader 预加载数据 → Dva model ====================
  // 用 useRef 标记，避免 setState 导致额外渲染
  const syncedRef = React.useRef(false);
  useEffect(() => {
    if (syncedRef.current) return;
    if (clientLoaderData?.collectGroups?.length) {
      // 合并 dispatch，一次更新 model，减少渲染次数
      dispatch({
        type: 'collect/saveCollectInitialData',
        payload: {
          groups: {
            list: clientLoaderData.collectGroups,
            ungrouped_count: clientLoaderData.collectUngroupedCount,
            total_count: clientLoaderData.collectTotalCount,
          },
          list: {
            list: clientLoaderData.collectList,
            total: clientLoaderData.collectTotal,
            page: clientLoaderData.collectPage,
          },
        },
      });
      syncedRef.current = true;
    }
  }, [clientLoaderData, dispatch]);

  // 切换 tab 时加载对应数据（初始 tab 数据由 clientLoader 预加载）
  const initializedRef = React.useRef(false);
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return; // 初始加载由 clientLoader 完成
    }
    fetchGroups(activeTab);
    fetchList(activeTab, 1, activeGroupMap[activeTab]);
  }, [activeTab, fetchGroups, fetchList, activeGroupMap]);

  // ==================== 计算属性 ====================

  // 当前分组名称
  const activeGroupName = useMemo(() => {
    if (activeGroupId === -1) return '全部收藏';
    if (activeGroupId === 0) return '未分组';
    const group = collectGroups.find(
      (g: CollectGroup) => g.id === activeGroupId,
    );
    return group?.name || '未知分组';
  }, [activeGroupId, collectGroups]);

  // ==================== 事件处理 ====================

  // 选择分组
  const handleSelectGroup = (groupId: number) => {
    setActiveGroupMap((prev) => ({ ...prev, [activeTab]: groupId }));
  };

  // 翻页
  const handlePageChange = (page: number) => {
    fetchList(activeTab, page, activeGroupId);
  };

  // 查看文档
  const handleViewDoc = (doc: CollectDocItem) => {
    history.push(`/doc/${doc.id}?project_id=${doc.project_id}`);
  };

  // 查看文集
  const handleViewProject = (project: CollectProjectItem) => {
    history.push(`/projectDetail/${project.id}`);
  };

  // 取消收藏（统一接口，不传 user_id，后端从 token 解析）
  const handleCancelCollect = (item: any) => {
    dispatch({
      type: 'collect/cancelCollect',
      payload: {
        id: item.collect_id,
        group_id: activeGroupId,
        page: collectPage,
        page_size: pageSize,
        type: activeTab,
      },
    });
  };

  // 移动分组（调用统一接口，不传 user_id，后端从 token 解析）
  const handleMoveGroup = (item: any, groupId: number) => {
    dispatch({
      type: 'collect/moveCollect',
      payload: {
        id: item.collect_id,
        group_id: groupId, // 目标分组
        currentGroupId: activeGroupId, // 当前选中分组（刷新列表用）
        page: collectPage,
        page_size: pageSize,
        type: activeTab,
      },
    });
  };

  // 分组管理（统一接口，type 区分，不传 user_id，后端从 token 解析）
  const handleCreateGroup = (data: { name: string; description: string }) => {
    dispatch({
      type: 'collect/createCollectGroup',
      payload: { ...data, type: activeTab },
    });
  };

  const handleUpdateGroup = (
    id: number,
    data: { name: string; description: string },
  ) => {
    dispatch({
      type: 'collect/updateCollectGroup',
      payload: { id, ...data },
    });
  };

  const handleDeleteGroup = (id: number) => {
    dispatch({
      type: 'collect/deleteCollectGroup',
      payload: { id },
    });
    if (activeGroupId === id) {
      setActiveGroupMap((prev) => ({ ...prev, [activeTab]: -1 }));
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
          <span
            className={`collect-tab-count ${
              activeTab === 'project' && collectTotalCount > 0
                ? 'has-count'
                : ''
            }`}
          >
            {activeTab === 'project' ? collectTotalCount : ''}
          </span>
        </span>
      ),
    },
    {
      key: 'doc',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <StarOutlined />
          收藏文档
          <span
            className={`collect-tab-count ${
              activeTab === 'doc' && collectTotalCount > 0 ? 'has-count' : ''
            }`}
          >
            {activeTab === 'doc' ? collectTotalCount : ''}
          </span>
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
          onChange={(key) => setActiveTab(key as CollectTabType)}
          items={tabItems}
          className="collect-tabs"
        />
      </div>

      {/* 左右分栏（两个 tab 共用布局，根据 activeTab 渲染不同列表组件） */}
      <Row gutter={16}>
        <Col xs={24} sm={24} md={8} lg={6} xl={5}>
          <CollectSidebar
            groups={collectGroups}
            loading={collectGroupLoading}
            activeGroupId={activeGroupId}
            totalCount={collectTotalCount}
            ungroupedCount={collectUngroupedCount}
            onSelectGroup={handleSelectGroup}
            onOpenGroupManager={() =>
              setGroupModalMap((prev) => ({ ...prev, [activeTab]: true }))
            }
          />
        </Col>
        <Col xs={24} sm={24} md={16} lg={18} xl={19}>
          {activeTab === 'project' ? (
            <CollectProjectList
              list={collectList}
              loading={collectLoading}
              total={collectTotal}
              page={collectPage}
              pageSize={pageSize}
              activeGroupName={activeGroupName}
              groups={collectGroups}
              showMove={activeGroupId !== -1}
              onPageChange={handlePageChange}
              onView={handleViewProject}
              onCancelCollect={handleCancelCollect}
              onMoveGroup={handleMoveGroup}
            />
          ) : (
            <CollectDocList
              list={collectList}
              loading={collectLoading}
              total={collectTotal}
              page={collectPage}
              pageSize={pageSize}
              activeGroupName={activeGroupName}
              groups={collectGroups}
              showMove={activeGroupId !== -1}
              onPageChange={handlePageChange}
              onView={handleViewDoc}
              onCancelCollect={handleCancelCollect}
              onMoveGroup={handleMoveGroup}
            />
          )}
        </Col>
      </Row>

      {/* 分组管理弹窗（两个 tab 共用，根据 activeTab 传递不同回调） */}
      <GroupManagerModal
        visible={groupModalMap[activeTab]}
        groups={collectGroups}
        onClose={() =>
          setGroupModalMap((prev) => ({ ...prev, [activeTab]: false }))
        }
        onCreate={handleCreateGroup}
        onUpdate={handleUpdateGroup}
        onDelete={handleDeleteGroup}
      />
    </div>
  );
};

export default CollectPage;
