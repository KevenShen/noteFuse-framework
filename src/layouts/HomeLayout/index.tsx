// src/layouts/HomeLayout/index.tsx
// 首页布局：顶部头部 + Tab 导航 + 内容区域 + 底部页脚

import { Outlet } from '@umijs/max';
import React from 'react';
import Header from './components/Header';
import MainTabs from './components/MainTabs';
import Footer from './components/Footer';
import './index.less';

/**
 * 首页布局组件
 *
 * 结构：
 * - 顶部头部（Header）：Logo + 搜索按钮 + 用户菜单/登录按钮
 * - Tab 导航（MainTabs）：根据当前路由自动生成 Tab 导航
 * - 内容区域（Outlet）：子路由渲染区域
 * - 底部页脚（Footer）：版权信息
 */
const HomeLayout: React.FC = () => {
  return (
    <div className="home-layout">
      {/* 顶部头部 */}
      <div className="page-header">
        <div className="header-container">
          <Header />
          {/* Tab 导航 */}
          <MainTabs />
        </div>
      </div>

      {/* 内容区域 */}
      <div className="page-content">
        <Outlet />
      </div>

      {/* 底部页脚 */}
      <Footer />
    </div>
  );
};

export default HomeLayout;
