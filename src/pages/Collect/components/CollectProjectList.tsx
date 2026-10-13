// src/pages/Collect/components/CollectProjectList.tsx
// 收藏页面 - 收藏文集列表（组件自治：直接从 Dva model 取数 + 翻页 + 查看 + 取消收藏 + 移动分组）
import {
  DeleteOutlined,
  EyeOutlined,
  FolderOpenOutlined,
  StarFilled,
  SwapOutlined,
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
import type { CollectGroup } from '../types';

const { Text } = Typography;

/** 收藏文集项 */
export interface CollectProjectItem {
  id: number;
  name: string;
  description: string;
  project_category_id: number;
  category_name: string;
  cover: string;
  doc_count: number;
  author_name: string;
  author_id: number;
  collect_id: number;
  group_id: number;
  group_name: string;
  collect_time: number;
}

interface CollectProjectListProps {
  activeGroupId: number;
  pageSize?: number;
}

const CollectProjectList: React.FC<CollectProjectListProps> = ({
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
          type: 'project',
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

  // 查看文集
  const handleView = (project: CollectProjectItem) => {
    history.push(`/projectDetail/${project.id}`);
  };

  // 取消收藏
  const handleCancelCollect = (project: CollectProjectItem) => {
    dispatch({
      type: 'collect/cancelCollect',
      payload: {
        id: project.collect_id,
        group_id: activeGroupId,
        page,
        page_size: pageSize,
        type: 'project',
      },
    });
  };

  // 移动分组
  const handleMoveGroup = (project: CollectProjectItem, groupId: number) => {
    dispatch({
      type: 'collect/moveCollect',
      payload: {
        id: project.collect_id,
        group_id: groupId,
        currentGroupId: activeGroupId,
        page,
        page_size: pageSize,
        type: 'project',
      },
    });
  };

  // 移动分组的下拉菜单
  const getMoveMenuItems = (project: CollectProjectItem) => {
    const otherGroups = (groups || []).filter(
      (g: CollectGroup) => g.id !== project.group_id,
    );
    return [
      {
        key: '0',
        label: '移至未分组',
        onClick: () => handleMoveGroup(project, 0),
      },
      ...otherGroups.map((g: CollectGroup) => ({
        key: String(g.id),
        label: g.name,
        onClick: () => handleMoveGroup(project, g.id),
      })),
    ];
  };

  const showMove = activeGroupId !== -1;

  return (
    <Card
      size="small"
      className="collect-project-card"
      title={
        <Space size={8}>
          <StarFilled className="collect-icon-gold" />
          <span>{activeGroupName}</span>
          <Tag color="gold">{total} 个</Tag>
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
              description="暂无收藏文集"
              className="collect-empty"
            />
          ),
        }}
        renderItem={(project: CollectProjectItem) => (
          <List.Item
            className="collect-project-item"
            actions={[
              <Tooltip key="view" title="查看文集">
                <Button
                  type="text"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => handleView(project)}
                >
                  查看
                </Button>
              </Tooltip>,
              ...(showMove
                ? [
                    <Dropdown
                      key="move"
                      menu={{ items: getMoveMenuItems(project) }}
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
                title="确定取消收藏该文集？"
                onConfirm={() => handleCancelCollect(project)}
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
                  icon={<FolderOpenOutlined />}
                  className="collect-project-avatar"
                  size={40}
                />
              }
              title={
                <Space size={8} wrap>
                  <a
                    onClick={() => handleView(project)}
                    className="collect-item-title"
                  >
                    {project.name}
                  </a>
                  <Tag color="purple" className="collect-item-tag">{project.group_name}</Tag>
                  <Tag color="blue">{project.doc_count || 0} 篇文档</Tag>
                </Space>
              }
              description={
                <Space size={12} wrap className="collect-item-meta">
                  <span>👤 {project.author_name}</span>
                  <span>⭐ 收藏于 {dayjs(project.collect_time).format('YYYY-MM-DD')}</span>
                  {project.description && (
                    <Text type="secondary" className="collect-item-summary">
                      {project.description.length > 60
                        ? project.description.slice(0, 60) + '...'
                        : project.description}
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

export default CollectProjectList;
