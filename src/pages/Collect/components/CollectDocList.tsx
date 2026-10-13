// src/pages/Collect/components/CollectDocList.tsx
// 收藏页面 - 收藏文档列表（组件自治：直接从 Dva model 取数 + 翻页 + 查看 + 取消收藏 + 移动分组）
import {
  DeleteOutlined,
  EyeOutlined,
  SwapOutlined,
  StarFilled,
} from '@ant-design/icons';
import { useShallowSelector } from '@/hooks';
import {
  Avatar,
  Button,
  Card,
  Dropdown,
  Empty,
  List,
  Pagination,
  Popconfirm,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { history, useDispatch } from '@umijs/max';
import dayjs from 'dayjs';
import React, { useCallback, useMemo } from 'react';
import type { CollectDocItem, CollectGroup } from '../types';

const { Text } = Typography;

interface CollectDocListProps {
  activeGroupId: number;
  pageSize?: number;
}

const CollectDocList: React.FC<CollectDocListProps> = ({
  activeGroupId,
  pageSize = 10,
}) => {
  const dispatch = useDispatch();

  // 直接从 Dva model 取数
  const {
    collectList: list,
    collectLoading: loading,
    collectTotal: total,
    collectPage: page,
    collectGroups: groups,
  } = useShallowSelector((state: any) => state.collect);

  // 当前分组名称
  const activeGroupName = useMemo(() => {
    if (activeGroupId === -1) return '全部收藏';
    if (activeGroupId === 0) return '未分组';
    const group = (groups || []).find(
      (g: CollectGroup) => g.id === activeGroupId,
    );
    return group?.name || '未知分组';
  }, [activeGroupId, groups]);

  // ==================== 数据加载 ====================
  const fetchList = useCallback(
    (pageNum: number) => {
      dispatch({
        type: 'collect/fetchCollectList',
        payload: {
          page: pageNum,
          page_size: pageSize,
          group_id: activeGroupId,
          type: 'doc',
        },
      });
    },
    [dispatch, pageSize, activeGroupId],
  );

  // ==================== 事件处理 ====================

  // 翻页
  const handlePageChange = (pageNum: number) => {
    fetchList(pageNum);
  };

  // 查看文档
  const handleView = (doc: CollectDocItem) => {
    history.push(`/doc/${doc.id}?project_id=${doc.project_id}`);
  };

  // 取消收藏
  const handleCancelCollect = (doc: CollectDocItem) => {
    dispatch({
      type: 'collect/cancelCollect',
      payload: {
        id: doc.collect_id,
        group_id: activeGroupId,
        page,
        page_size: pageSize,
        type: 'doc',
      },
    });
  };

  // 移动分组
  const handleMoveGroup = (doc: CollectDocItem, groupId: number) => {
    dispatch({
      type: 'collect/moveCollect',
      payload: {
        id: doc.collect_id,
        group_id: groupId,
        currentGroupId: activeGroupId,
        page,
        page_size: pageSize,
        type: 'doc',
      },
    });
  };

  // 移动分组的下拉菜单
  const getMoveMenuItems = (doc: CollectDocItem) => {
    const otherGroups = (groups || []).filter(
      (g: CollectGroup) => g.id !== doc.group_id,
    );
    return [
      {
        key: '0',
        label: '移至未分组',
        onClick: () => handleMoveGroup(doc, 0),
      },
      ...otherGroups.map((g: CollectGroup) => ({
        key: String(g.id),
        label: g.name,
        onClick: () => handleMoveGroup(doc, g.id),
      })),
    ];
  };

  const showMove = activeGroupId !== -1;

  return (
    <Card
      size="small"
      className="collect-doc-card"
      title={
        <Space size={8}>
          <StarFilled className="collect-icon-gold" />
          <span>{activeGroupName}</span>
          <Tag color="gold">{total} 篇</Tag>
        </Space>
      }
      bodyStyle={{ padding: 0 }}
    >
      <List
        loading={loading}
        dataSource={list}
        locale={{
          emptyText: (
            <Empty
              description="暂无收藏文档"
              className="collect-empty"
            />
          ),
        }}
        renderItem={(doc: CollectDocItem) => (
          <List.Item
            className="collect-doc-item"
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
              ...(showMove
                ? [
                    <Dropdown
                      key="move"
                      menu={{ items: getMoveMenuItems(doc) }}
                      trigger={['click']}
                      disabled={!groups || groups.length === 0}
                    >
                      <Tooltip title="移动分组">
                        <Button type="text" size="small" icon={<SwapOutlined />}>
                          移动
                        </Button>
                      </Tooltip>
                    </Dropdown>,
                  ]
                : []),
              <Popconfirm
                key="cancel"
                title="确定取消收藏该文档？"
                onConfirm={() => handleCancelCollect(doc)}
                okText="确定"
                cancelText="取消"
              >
                <Tooltip title="取消收藏">
                  <Button type="text" size="small" danger icon={<DeleteOutlined />}>
                    取消
                  </Button>
                </Tooltip>
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta
              avatar={
                <Avatar
                  icon={<StarFilled />}
                  className="collect-doc-avatar"
                  size={40}
                />
              }
              title={
                <Space size={8} wrap>
                  <a
                    onClick={() => handleView(doc)}
                    className="collect-item-title"
                  >
                    {doc.name}
                  </a>
                  <Tag color="blue" className="collect-item-tag">{doc.group_name}</Tag>
                </Space>
              }
              description={
                <Space size={12} wrap className="collect-item-meta">
                  <span>📁 {doc.project_name}</span>
                  <span>👤 {doc.author_name}</span>
                  <span>⭐ 收藏于 {dayjs(doc.collect_time).format('YYYY-MM-DD')}</span>
                  {doc.summary && (
                    <Text type="secondary" className="collect-item-summary">
                      {doc.summary.length > 60 ? doc.summary.slice(0, 60) + '...' : doc.summary}
                    </Text>
                  )}
                </Space>
              }
            />
          </List.Item>
        )}
      />
      {total > 0 && (
        <div className="collect-pagination">
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
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

export default CollectDocList;
