// src/pages/Tags/index.tsx
// 标签页面 - Dva Hooks + 组件自治 + clientLoader 预加载
// 布局：左侧标签分类面板（Dropdown 三级分类 + 标签） + 右侧标签文档列表
// index.tsx 仅负责：clientLoader 预加载、数据同步到 model、分类管理弹窗状态、页面布局
// 标签选择、文档列表、分类管理等逻辑已下沉到子组件自治
import { fetchTagCategories } from '@/services';
import { useClientLoaderSync } from '@/hooks';
import { extractResponseData } from '@/utils/clientLoader';
import { useClientLoaderData } from '@umijs/max';
import { Col, Row } from 'antd';
import React, { useState } from 'react';
import { TagCategoryManager, TagCategoryPanel, TagDocList } from './components';
import './index.less';

// ==================== clientLoader：页面渲染前预加载标签分类 ====================
export async function clientLoader() {
  try {
    const res = await fetchTagCategories({ params: { type: 'doc' } });
    const tagCategories = extractResponseData<any[]>(res, []);
    return { tagCategories };
  } catch (e) {
    return { tagCategories: [] };
  }
}

const TagsPage: React.FC = () => {
  // useClientLoaderData 返回 { data: clientLoader返回值 }
  const { data: clientLoaderData } = useClientLoaderData() as {
    data: { tagCategories: any[] };
  };

  // ==================== 页面状态 ====================
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);

  // ==================== 数据同步：clientLoader 预加载数据 → Dva model ====================
  useClientLoaderSync({
    clientLoaderData,
    actionType: 'tag/saveTagCategories',
    mapData: (data) => data.tagCategories,
    hasData: (data) => data?.tagCategories?.length > 0,
  });

  // ==================== 页面布局（左右布局，兼容移动端） ====================
  return (
    <div className="tags-page">
      <Row gutter={16}>
        {/* 左侧标签分类面板 */}
        <Col xs={24} sm={24} md={8} lg={6} xl={5}>
          <TagCategoryPanel
            onOpenCategoryManager={() => setCategoryManagerOpen(true)}
          />
        </Col>

        {/* 右侧标签文档列表 */}
        <Col xs={24} sm={24} md={16} lg={18} xl={19}>
          <TagDocList />
        </Col>
      </Row>

      {/* 标签分类管理器弹窗 */}
      <TagCategoryManager
        open={categoryManagerOpen}
        onClose={() => setCategoryManagerOpen(false)}
      />
    </div>
  );
};

export default TagsPage;
