// src/layouts/HomeLayout/components/Footer.tsx
// 底部页脚组件：显示版权信息和技术栈

import React from 'react';

/** 页脚文字常量 */
const FOOTER_TEXT = 'NoteFuse 文档管理系统 © 2026 · 基于 Umi Max + Ant Design';

/**
 * 底部页脚组件
 * 显示版权信息和技术栈
 */
const Footer: React.FC = () => {
  return <div className="page-footer">{FOOTER_TEXT}</div>;
};

export default Footer;
