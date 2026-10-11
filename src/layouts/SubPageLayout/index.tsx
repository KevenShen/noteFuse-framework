import {
  HomeOutlined,
  LogoutOutlined,
  RightOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Outlet, history, useAppData, useDispatch, useLocation, useModel, useSelector } from '@umijs/max';
import { getPurePath, joinPath } from '@/constants/auth';
import {
  Avatar,
  Breadcrumb,
  Button,
  Dropdown,
  MenuProps,
  Space,
  Typography,
} from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import './index.less';

const { Text } = Typography;

interface SubPageLayoutProps {
  /** 页面大标题，不传则不显示 */
  pageTitle?: string;
  /** 页面副标题/描述 */
  pageSubtitle?: string;
  /** 标题右侧操作区 */
  headerExtra?: React.ReactNode;
  /** 是否显示底部页脚 */
  showFooter?: boolean;
  /** 内容区最大宽度，默认 1200px */
  contentMaxWidth?: number | string;
}

interface BreadcrumbItem {
  label: string;
  path?: string;
}

/**
 * 递归遍历路由树，构建目标路径的面包屑链路（从根到目标）
 */
function getBreadcrumbChain(
  routes: any[],
  targetPath: string,
  basePath: string = '',
  chain: Array<{ path: string; title: string }> = [],
): boolean {
  for (const route of routes) {
    const fullPath = route.path.startsWith('/')
      ? route.path
      : joinPath(basePath, route.path);

    if (fullPath === targetPath && route.title) {
      chain.unshift({ path: fullPath, title: route.title });
      return true;
    }

    if (route.routes) {
      const found = getBreadcrumbChain(
        route.routes,
        targetPath,
        fullPath,
        chain,
      );
      if (found) {
        if (route.title && !route.redirect) {
          chain.unshift({ path: fullPath, title: route.title });
        }
        return true;
      }
    }
  }
  return false;
}

const SubPageLayout: React.FC<SubPageLayoutProps> = ({
  pageTitle,
  pageSubtitle,
  headerExtra,
  showFooter = true,
  contentMaxWidth = 1200,
}) => {
  const location = useLocation();
  const dispatch = useDispatch();
  // 双源读取：优先 Dva model（登录后更新），兜底 initialState（启动时同步获取，无闪烁）
  const { initialState, setInitialState } = useModel('@@initialState');
  const dvaCurrentUser = useSelector((state: any) => state.user.currentUser);
  const currentUser = dvaCurrentUser || initialState?.currentUser;
  const pureLocationPath = getPurePath(location.pathname);
  const { clientRoutes } = useAppData();
  const [isMobile, setIsMobile] = useState(false);

  // 有 token 但两边都没有用户信息时，从 Dva model 获取（兜底）
  useEffect(() => {
    const token = localStorage.getItem('note_fuse_token');
    if (token && !currentUser) {
      dispatch({ type: 'userLogin/fetchCurrentUser' });
    }
  }, [currentUser, dispatch]);

  // 响应式：监听窗口尺寸
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const breadcrumbItems = useMemo(() => {
    const chain: Array<{ path: string; title: string }> = [];
    const list: BreadcrumbItem[] = [{ label: '首页', path: '/' }];

    if (Array.isArray(clientRoutes)) {
      getBreadcrumbChain(clientRoutes, pureLocationPath, '', chain);
      chain.forEach((item) => {
        list.push({ label: item.title, path: item.path });
      });
    }

    return list.map((item, index) => ({
      title: item.path ? (
        <a
          onClick={() => history.push(item.path!)}
          style={{ cursor: 'pointer' }}
        >
          {index === 0 && !isMobile && <HomeOutlined style={{ marginRight: 4 }} />}
          {item.label}
        </a>
      ) : (
        <Text strong>{item.label}</Text>
      ),
    }));
  }, [clientRoutes, pureLocationPath, isMobile]);

  const userMenuItems: MenuProps['items'] = [
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
        setInitialState((s: any) => ({ ...s, currentUser: null }));
        dispatch({ type: 'userLogin/handleLogout' });
      },
    },
  ];

  return (
    <div className="sub-page-layout">
      {/* 顶部导航栏 */}
      <header className="sub-page-header">
        <div
          className="sub-page-header-inner"
          style={{ maxWidth: contentMaxWidth }}
        >
          <div
            className="sub-page-logo"
            onClick={() => history.push('/')}
            style={{ cursor: 'pointer' }}
          >
            <span className="logo-icon">N</span>
            <span className="logo-text">NoteFuse</span>
          </div>

          {!isMobile && breadcrumbItems.length > 1 && (
            <div className="sub-page-breadcrumb">
              <Breadcrumb
                items={breadcrumbItems}
                separator={<RightOutlined style={{ fontSize: 12 }} />}
              />
            </div>
          )}

          <div className="sub-page-user">
            {currentUser ? (
              <Dropdown
                menu={{ items: userMenuItems }}
                placement="bottomRight"
                arrow
              >
                <div
                  className="user-avatar-wrapper"
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <Avatar
                    size={isMobile ? 28 : 32}
                    src={currentUser.avatar || undefined}
                    style={{ backgroundColor: currentUser.avatar ? 'transparent' : '#1890ff' }}
                    icon={!currentUser.avatar && <UserOutlined />}
                  >
                    {!currentUser.avatar && (currentUser.nickname || currentUser.username || 'U').charAt(0).toUpperCase()}
                  </Avatar>
                  {!isMobile && <span className="user-name">{currentUser.nickname || currentUser.username}</span>}
                </div>
              </Dropdown>
            ) : (
              <Button
                type="primary"
                size={isMobile ? 'small' : 'middle'}
                icon={<UserOutlined />}
                onClick={() => history.push('/login')}
              >
                {!isMobile && '登录'}
              </Button>
            )}
          </div>
        </div>
      </header>

      {isMobile && breadcrumbItems.length > 1 && (
        <div
          className="sub-page-mobile-breadcrumb"
          style={{ maxWidth: contentMaxWidth }}
        >
          <Breadcrumb
            items={breadcrumbItems}
            separator={<RightOutlined style={{ fontSize: 10 }} />}
          />
        </div>
      )}

      {pageTitle && (
        <div
          className="sub-page-title-bar"
          style={{ maxWidth: contentMaxWidth }}
        >
          <div className="title-info">
            <h1 className="page-title">{pageTitle}</h1>
            {pageSubtitle && <p className="page-subtitle">{pageSubtitle}</p>}
          </div>
          {headerExtra && <div className="title-extra">{headerExtra}</div>}
        </div>
      )}

      <main className="sub-page-content" style={{ maxWidth: contentMaxWidth }}>
        <Outlet />
      </main>

      {showFooter && (
        <footer className="sub-page-footer">
          <div className="footer-inner" style={{ maxWidth: contentMaxWidth }}>
            <Space
              direction="vertical"
              size={4}
              align="center"
              style={{ width: '100%' }}
            >
              <Text type="secondary" style={{ fontSize: 12 }}>
                © 2026 NoteFuse · 一站式文档管理平台
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                基于 React + Umi Max + Ant Design Pro 构建
              </Text>
            </Space>
          </div>
        </footer>
      )}
    </div>
  );
};

export default SubPageLayout;
