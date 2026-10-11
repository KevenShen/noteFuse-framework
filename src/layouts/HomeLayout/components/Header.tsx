// src/layouts/HomeLayout/components/Header.tsx
// 顶部头部组件：Logo + 搜索按钮 + 用户菜单/登录按钮

import {
  LogoutOutlined,
  SearchOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { history, useDispatch, useModel } from '@umijs/max';
import { Avatar, Button, Dropdown, MenuProps, Space } from 'antd';
import React, { useMemo } from 'react';
import { useCurrentUser, useMobile } from '@/hooks';

/** 移动端断点 */
const MOBILE_BREAKPOINT = 768;

export interface HeaderProps {
  /** Logo 点击跳转路径 */
  logoPath?: string;
  /** 搜索页面路径 */
  searchPath?: string;
}

/**
 * 顶部头部组件
 * 包含：Logo（点击返回首页）、搜索按钮、用户下拉菜单（已登录）/登录按钮（未登录）
 */
const Header: React.FC<HeaderProps> = ({
  logoPath = '/',
  searchPath = '/search',
}) => {
  const dispatch = useDispatch();
  const isMobile = useMobile(MOBILE_BREAKPOINT);
  // 当前登录用户（封装双源取数 + 兜底获取）
  const { currentUser } = useCurrentUser();
  // setInitialState 用于退出登录时清除 initialState
  const { setInitialState } = useModel('@@initialState');

  // 用户下拉菜单项（使用 useMemo 缓存，避免每次渲染重建）
  const userMenuItems = useMemo<MenuProps['items']>(
    () => [
      {
        key: 'center',
        icon: <UserOutlined />,
        label: '个人中心',
        onClick: () => history.push('/user/center'),
      },
      {
        key: 'settings',
        icon: <SettingOutlined />,
        label: '个人设置',
        onClick: () => history.push('/user/settings'),
      },
      { type: 'divider' },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
        danger: true,
        onClick: () => {
          // 清除 initialState 中的用户信息
          setInitialState((s: any) => ({ ...s, currentUser: null }));
          // 调用 Dva model 的退出登录 effect（清除 token、跳转登录页）
          dispatch({ type: 'user/handleLogout' });
        },
      },
    ],
    [dispatch, setInitialState],
  );

  return (
    <div className="header-top">
      {/* Logo 区域（点击返回首页） */}
      <div className="logo-wrapper" onClick={() => history.push(logoPath)}>
        <div className="logo-icon">N</div>
        <span className="logo-text">NoteFuse</span>
        {!isMobile && <span className="logo-subtitle">文档管理系统</span>}
      </div>

      {/* 右侧操作区域 */}
      <Space size={isMobile ? 4 : 8}>
        {/* 搜索按钮 */}
        <Button
          type="text"
          icon={<SearchOutlined />}
          onClick={() => history.push(searchPath)}
        />

        {/* 已登录：显示用户头像 + 下拉菜单 */}
        {currentUser ? (
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div className="user-info-wrapper">
              <Avatar
                size={isMobile ? 'small' : 'default'}
                src={currentUser.avatar || undefined}
                className={currentUser.avatar ? 'user-avatar-with-image' : 'user-avatar-default'}
                icon={!currentUser.avatar && <UserOutlined />}
              >
                {!currentUser.avatar &&
                  (currentUser.nickname || currentUser.username || 'U')
                    .charAt(0)
                    .toUpperCase()}
              </Avatar>
              {!isMobile && (
                <span className="user-name-text">
                  {currentUser.nickname || currentUser.username}
                </span>
              )}
            </div>
          </Dropdown>
        ) : (
          /* 未登录：显示登录按钮 */
          <Button
            type="primary"
            size={isMobile ? 'small' : 'middle'}
            icon={<UserOutlined />}
            onClick={() => history.push('/login')}
          >
            {!isMobile && '登录'}
          </Button>
        )}
      </Space>
    </div>
  );
};

export default Header;
