// src/components/IconPicker/index.tsx
// 通用图标选择器 - 带搜索、分类 Tab、网格展示
// 可在文集、分类、文档等多个页面复用
import { SearchOutlined } from '@ant-design/icons';
import { Input, Modal, Tabs } from 'antd';
import React, { useMemo, useState } from 'react';
import { iconCategories, iconList, getIconComponent, getIconLabel } from './iconData';
import './index.less';

// 重新导出工具函数，方便外部使用（如图标预览）
export { getIconComponent, getIconLabel, iconList, iconCategories };

export interface IconPickerProps {
  /** 当前选中的图标名称 */
  value?: string;
  /** 选择图标回调 */
  onChange?: (value: string) => void;
  /** 弹窗标题 */
  title?: string;
  /** 触发按钮占位文字 */
  placeholder?: string;
  /** 弹窗宽度 */
  width?: number;
}

const IconPicker: React.FC<IconPickerProps> = ({
  value,
  onChange,
  title = '选择图标',
  placeholder = '请选择图标',
  width = 640,
}) => {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [activeCategory, setActiveCategory] = useState('全部');

  const CurrentIcon = value ? getIconComponent(value) : null;

  // 过滤图标
  const filteredIcons = useMemo(() => {
    return iconList.filter((item) => {
      const matchCategory =
        activeCategory === '全部' || item.category === activeCategory;
      const matchKeyword =
        !keyword ||
        item.name.toLowerCase().includes(keyword.toLowerCase()) ||
        item.label.includes(keyword);
      return matchCategory && matchKeyword;
    });
  }, [activeCategory, keyword]);

  const handleSelect = (name: string) => {
    onChange?.(name);
    setOpen(false);
    setKeyword('');
    setActiveCategory('全部');
  };

  const handleCancel = () => {
    setOpen(false);
    setKeyword('');
    setActiveCategory('全部');
  };

  const content = (
    <div className="icon-picker-panel">
      {/* 搜索框 */}
      <Input
        className="icon-picker-search"
        placeholder="搜索图标名称 / 中文"
        prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        allowClear
      />

      {/* 分类 Tab */}
      <Tabs
        className="icon-picker-tabs"
        activeKey={activeCategory}
        onChange={setActiveCategory}
        items={iconCategories.map((cat) => ({
          key: cat,
          label: cat,
        }))}
      />

      {/* 图标网格 */}
      <div className="icon-picker-grid">
        {filteredIcons.map((item) => {
          const IconComp = item.component;
          const isSelected = value === item.name;
          return (
            <div
              key={item.name}
              className={`icon-picker-item ${isSelected ? 'selected' : ''}`}
              onClick={() => handleSelect(item.name)}
              title={item.label}
            >
              <IconComp style={{ fontSize: 20 }} />
              <span className="icon-picker-label">{item.label}</span>
            </div>
          );
        })}
        {filteredIcons.length === 0 && (
          <div className="icon-picker-empty">未找到匹配的图标</div>
        )}
      </div>

      {/* 底部计数 */}
      <div className="icon-picker-footer">
        共 {filteredIcons.length} 个图标
      </div>
    </div>
  );

  return (
    <>
      <div
        className="icon-picker-trigger"
        onClick={() => setOpen(true)}
      >
        {CurrentIcon ? (
          <CurrentIcon style={{ fontSize: 18 }} />
        ) : (
          <span style={{ color: '#bfbfbf' }}>选择图标</span>
        )}
        <span className="icon-picker-trigger-label">
          {value ? getIconLabel(value) : placeholder}
        </span>
      </div>
      <Modal
        open={open}
        onCancel={handleCancel}
        footer={null}
        centered
        width={width}
        title={title}
        destroyOnClose
        className="icon-picker-modal"
      >
        {content}
      </Modal>
    </>
  );
};

export default IconPicker;
