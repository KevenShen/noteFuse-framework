// src/pages/Quick/components/QuickGrid.tsx
// 快捷操作页面 - 快捷操作卡片网格（组件自治：直接从 Dva model 取数 + 分组筛选 + 点击 + 右键菜单）
import { useShallowSelector } from '@/hooks';
import { Dropdown, Empty, MenuProps, message, Skeleton } from 'antd';
import { Col, Row } from 'antd';
import { history, useDispatch } from '@umijs/max';
import React, { useCallback, useMemo } from 'react';
import type { QuickGroup, QuickItem } from '../types';

// ==================== Action 路由映射表 ====================
const ACTION_ROUTE_MAP: Record<string, string> = {
  createDoc: '/DocEditor',
  createProject: '/Project',
  searchDoc: '/Project',
  docHistory: '/Project',
  exportPdf: '/Project',
  exportMarkdown: '/Project',
  shareDoc: '/Project',
  jsonFormatter: '/Quick',
  regexTester: '/Quick',
};

interface QuickGridProps {
  selectedGroupId: number | 'all';
}

const QuickGrid: React.FC<QuickGridProps> = ({ selectedGroupId }) => {
  const dispatch = useDispatch();

  // 直接从 Dva model 取数
  const {
    quickItems: items,
    quickGroups: groups,
    quickItemsLoading: loading,
  } = useShallowSelector((state: any) => state.quick);

  // 根据分组筛选后的操作项
  const filteredItems = useMemo(() => {
    if (selectedGroupId === 'all') {
      return items || [];
    }
    const group = (groups || []).find(
      (g: QuickGroup) => g.id === selectedGroupId,
    );
    return group?.items || [];
  }, [items, groups, selectedGroupId]);

  // 点击快捷操作项
  const handleItemClick = useCallback((item: QuickItem) => {
    if (item.type === 'link' && item.url) {
      history.push(item.url);
    } else if (item.type === 'action' && item.action) {
      const targetRoute = ACTION_ROUTE_MAP[item.action];
      if (targetRoute) {
        history.push(targetRoute);
      } else {
        message.info(`「${item.name}」功能开发中，敬请期待`);
      }
    } else if (item.type === 'template' && item.template_id) {
      history.push(`/DocEditor?template_id=${item.template_id}`);
    } else {
      message.info('该操作暂不支持');
    }
  }, []);

  // 添加操作项到分组
  const handleAddToGroup = useCallback(
    (item: QuickItem, groupId: number) => {
      dispatch({
        type: 'quick/addQuickItemToGroup',
        payload: { group_id: groupId, item_id: item.id },
      });
    },
    [dispatch],
  );

  // 卡片右键菜单：添加到分组
  const getCardContextMenu = (item: QuickItem): MenuProps['items'] => [
    {
      key: 'add-to-group',
      label: '添加到分组',
      children: (groups || []).map((g: QuickGroup) => ({
        key: String(g.id),
        label: g.name,
        onClick: () => handleAddToGroup(item, g.id),
      })),
    },
  ];

  // 加载中骨架屏
  if (loading) {
    return (
      <Row gutter={[12, 12]}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Col xs={12} sm={8} md={6} lg={4} key={i}>
            <Skeleton active paragraph={{ rows: 2 }} />
          </Col>
        ))}
      </Row>
    );
  }

  if (filteredItems.length === 0) {
    return (
      <Empty
        description="该分类下暂无快捷操作"
        style={{ padding: '60px 0' }}
      />
    );
  }

  return (
    <Row gutter={[12, 12]}>
      {filteredItems.map((item: QuickItem) => (
        <Col xs={12} sm={8} md={6} lg={4} key={item.id}>
          <Dropdown
            menu={{ items: getCardContextMenu(item) }}
            trigger={['contextMenu']}
          >
            <div
              className="quick-card"
              onClick={() => handleItemClick(item)}
            >
              <div className={`quick-card-type-badge quick-card-type-${item.type}`}>
                {item.type === 'link' ? '跳转' : item.type === 'action' ? '动作' : '模板'}
              </div>
              <div className="quick-card-icon">{item.icon}</div>
              <div className="quick-card-name">{item.name}</div>
              <div className="quick-card-desc">{item.description}</div>
            </div>
          </Dropdown>
        </Col>
      ))}
    </Row>
  );
};

export default QuickGrid;
