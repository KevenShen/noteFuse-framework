// src/pages/Quick/components/QuickGrid.tsx
// 快捷操作页面 - 快捷操作卡片网格
import { Col, Empty, Row, Skeleton } from 'antd';
import React from 'react';
import type { QuickGridProps } from '../types';

const QuickGrid: React.FC<QuickGridProps> = ({ items, loading, onItemClick }) => {
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

  if (items.length === 0) {
    return <Empty description="该分类下暂无快捷操作" style={{ padding: '60px 0' }} />;
  }

  return (
    <Row gutter={[12, 12]}>
      {items.map((item) => (
        <Col xs={12} sm={8} md={6} lg={4} key={item.id}>
          <div
            className="quick-card"
            onClick={() => onItemClick(item)}
          >
            <div className="quick-card-icon">{item.icon}</div>
            <div className="quick-card-name">{item.name}</div>
            <div className="quick-card-desc">{item.description}</div>
          </div>
        </Col>
      ))}
    </Row>
  );
};

export default QuickGrid;
