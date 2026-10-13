// src/pages/Recent/components/RecentDocList.tsx
// 最近使用页面 - 文档列表（组件自治：直接从 Dva model 取数 + 时间筛选 + 翻页 + 查看/编辑）
import {
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import {
  Avatar,
  Button,
  Card,
  Empty,
  List,
  message,
  Pagination,
  Space,
  Tag,
  Tooltip,
} from 'antd';
import { history, useDispatch } from '@umijs/max';
import { useShallowSelector } from '@/hooks';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import React, { useCallback, useMemo } from 'react';
import type { RecentDocItem, RecentTabType, TimeFilterType } from '../types';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

interface RecentDocListProps {
  activeTab: RecentTabType;
  timeFilter: TimeFilterType;
  pageSize?: number;
}

const RecentDocList: React.FC<RecentDocListProps> = ({
  activeTab,
  timeFilter,
  pageSize = 10,
}) => {
  const dispatch = useDispatch();

  // ==================== 直接从 Dva model 取数 ====================
  const {
    recentCreatedList,
    recentCreatedTotal,
    recentCreatedPage,
    recentCreatedLoading,
    recentUpdatedList,
    recentUpdatedTotal,
    recentUpdatedPage,
    recentUpdatedLoading,
    recentBrowsedList,
    recentBrowsedTotal,
    recentBrowsedPage,
    recentBrowsedLoading,
  } = useShallowSelector((state: any) => state.recent);

  // 当前登录用户（用于权限判断）
  const { currentUser } = useShallowSelector((state: any) => state.user);
  const currentUserId = currentUser?.id || 1;

  // ==================== 数据加载 ====================
  const fetchData = useCallback(
    (tab: RecentTabType, page: number) => {
      const params = { page, page_size: pageSize };
      if (tab === 'created') {
        dispatch({ type: 'recent/fetchRecentCreated', payload: params });
      } else if (tab === 'updated') {
        dispatch({ type: 'recent/fetchRecentUpdated', payload: params });
      } else {
        dispatch({ type: 'recent/fetchRecentBrowsed', payload: params });
      }
    },
    [dispatch, pageSize],
  );

  // ==================== 时间筛选（前端过滤） ====================
  const filterByTime = useCallback(
    (list: RecentDocItem[]): RecentDocItem[] => {
      if (timeFilter === 'all') return list;
      const now = Date.now();
      const thresholds: Record<TimeFilterType, number> = {
        all: 0,
        today: 86400000,
        week: 86400000 * 7,
        month: 86400000 * 30,
      };
      const threshold = thresholds[timeFilter];
      return list.filter((doc) => {
        let time: number;
        if (activeTab === 'browsed') {
          time = doc.browse_time || 0;
        } else if (activeTab === 'created') {
          time = doc.create_time ? new Date(doc.create_time).getTime() : 0;
        } else {
          time = doc.update_time ? new Date(doc.update_time).getTime() : 0;
        }
        return now - time < threshold;
      });
    },
    [timeFilter, activeTab],
  );

  // ==================== 当前 Tab 的数据 ====================
  const currentData = useMemo(() => {
    if (activeTab === 'created') {
      return {
        list: filterByTime(recentCreatedList as RecentDocItem[]),
        total: recentCreatedTotal,
        page: recentCreatedPage,
        loading: recentCreatedLoading,
      };
    }
    if (activeTab === 'updated') {
      return {
        list: filterByTime(recentUpdatedList as RecentDocItem[]),
        total: recentUpdatedTotal,
        page: recentUpdatedPage,
        loading: recentUpdatedLoading,
      };
    }
    return {
      list: filterByTime(recentBrowsedList as RecentDocItem[]),
      total: recentBrowsedTotal,
      page: recentBrowsedPage,
      loading: recentBrowsedLoading,
    };
  }, [
    activeTab,
    recentCreatedList,
    recentCreatedTotal,
    recentCreatedPage,
    recentCreatedLoading,
    recentUpdatedList,
    recentUpdatedTotal,
    recentUpdatedPage,
    recentUpdatedLoading,
    recentBrowsedList,
    recentBrowsedTotal,
    recentBrowsedPage,
    recentBrowsedLoading,
    filterByTime,
  ]);

  // ==================== 事件处理 ====================

  // 翻页
  const handlePageChange = (page: number) => {
    fetchData(activeTab, page);
  };

  // 查看文档（跳转到 /doc/:id，并刷新最近浏览列表）
  const handleView = (doc: RecentDocItem) => {
    dispatch({
      type: 'recent/fetchRecentBrowsed',
      payload: { page: 1, page_size: pageSize },
    });
    history.push(`/doc/${doc.id}?project_id=${doc.project_id}`);
  };

  // 编辑文档（仅创建者可编辑，跳转到 /docEdit/:id）
  const handleEdit = (doc: RecentDocItem) => {
    if (doc.author_id !== currentUserId) {
      message.warning('仅文档创建者可编辑');
      return;
    }
    history.push(`/docEdit/${doc.id}?project_id=${doc.project_id}`);
  };

  // ==================== 渲染辅助 ====================

  // 时间字段根据 tab 类型选择
  const getTimeField = (doc: RecentDocItem): number | string => {
    if (activeTab === 'browsed') return doc.browse_time || 0;
    if (activeTab === 'created') return doc.create_time || doc.modify_time || 0;
    return doc.update_time || doc.modify_time || 0;
  };

  // 格式化时间显示
  const formatTime = (doc: RecentDocItem): string => {
    const time = getTimeField(doc);
    if (!time) return '-';
    return dayjs(time).fromNow();
  };

  // 判断是否可编辑
  const canEdit = (doc: RecentDocItem): boolean => {
    return doc.author_id === currentUserId;
  };

  // 列表项渲染
  const renderItem = (doc: RecentDocItem) => {
    const editable = canEdit(doc);
    return (
      <List.Item
        className="recent-doc-item"
        actions={[
          <Tooltip key="view" title="查看文档">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleView(doc)}
            >
              查看
            </Button>
          </Tooltip>,
          editable ? (
            <Tooltip key="edit" title="编辑文档">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(doc)}
              >
                编辑
              </Button>
            </Tooltip>
          ) : (
            <Tooltip key="edit-disabled" title="仅创建者可编辑">
              <Button type="text" size="small" icon={<EditOutlined />} disabled>
                编辑
              </Button>
            </Tooltip>
          ),
        ]}
      >
        <List.Item.Meta
          avatar={
            <Avatar
              icon={<FileTextOutlined />}
              className="recent-doc-avatar"
              size={40}
            />
          }
          title={
            <Space size={8} wrap>
              <a onClick={() => handleView(doc)} className="recent-doc-title">
                {doc.name}
              </a>
              {activeTab === 'browsed' && (
                <Tag color="orange" className="recent-doc-tag">已浏览</Tag>
              )}
              {activeTab === 'created' && (
                <Tag color="blue" className="recent-doc-tag">我创建</Tag>
              )}
            </Space>
          }
          description={
            <Space size={12} wrap className="recent-doc-meta">
              <span>📁 {doc.project_name || '未知文集'}</span>
              <span>👤 {doc.author_name || '未知'}</span>
              <span>🕐 {formatTime(doc)}</span>
              {doc.summary && (
                <span className="recent-doc-summary">
                  {doc.summary.length > 50
                    ? doc.summary.slice(0, 50) + '...'
                    : doc.summary}
                </span>
              )}
            </Space>
          }
        />
      </List.Item>
    );
  };

  return (
    <Card
      size="small"
      className="recent-doc-card"
      bodyStyle={{ padding: 0 }}
    >
      <List
        loading={currentData.loading}
        dataSource={currentData.list}
        renderItem={renderItem}
        locale={{
          emptyText: (
            <Empty
              description={
                activeTab === 'browsed' ? '暂无浏览记录' : '暂无文档'
              }
              className="recent-doc-empty"
            />
          ),
        }}
      />
      {currentData.total > 0 && (
        <div className="recent-doc-pagination">
          <Pagination
            current={currentData.page}
            pageSize={pageSize}
            total={currentData.total}
            onChange={handlePageChange}
            showSizeChanger={false}
            showQuickJumper
            showTotal={(t) => `共 ${t} 条`}
          />
        </div>
      )}
    </Card>
  );
};

export default RecentDocList;
