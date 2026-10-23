import { defineConfig } from '@umijs/max';

export default defineConfig({
  define: {
    // 将环境变量注入到全局 process.env 中
    // API_BASE_URL: process.env.NODE_ENV === 'production' ? '/api' : '/api',
    // 'process.env.API_BASE_PORT': process.env.UMI_APP_LOCAL_PORT,
  },
  antd: {
    configProvider: {
      componentSize: 'middle',
    },
    dark: false,
    compact: true,
    import: false,
    style: 'less',
  },
  model: {
    exclude: ['initialState', 'access'],
  },
  dva: {
    immer: {}, // 推荐开启，方便修改 reducer
    hmr: true, // 开启热更新
  },
  access: {}, // 权限配置
  initialState: {},
  request: {},
  qiankun: {
    master: {
      apps: [
        // {
        //   name: 'snippet',
        //   entry:
        //     process.env.NODE_ENV === 'production'
        //       ? 'http://localhost:3001'
        //       : 'http://localhost:8001',
        // },
        // {
        //   name: 'vscodeBuilder',
        //   entry:
        //     process.env.NODE_ENV === 'production'
        //       ? 'http://localhost:3002'
        //       : 'http://localhost:8002',
        // },
      ],
      sandbox: {
        strictStyleIsolation: false,
        experimentalStyleIsolation: false,
      },
      prefetch: false,
    },
  },
  routes: [
    {
      path: '/register',
      component: './Register',
    },
    {
      path: '/login',
      component: './Login',
    },
    {
      path: '/forget-password',
      component: './ForgetPassword',
    },
    {
      path: '/user',
      component: '@/layouts/SubPageLayout',
      routes: [
        {
          path: 'center',
          component: './UserCenter',
        },
        {
          path: 'settings',
          component: './UserCenter/UserSettings',
        },
      ],
    },
    {
      path: '/',
      component: '@/layouts/HomeLayout',
      routes: [
        { path: '', redirect: '/project' },
        {
          path: 'project',
          component: './Project',
          title: '文集',
          icon: 'CodeOutlined',
        },
        {
          path: 'recent',
          component: './Recent',
          title: '最近使用',
          icon: 'SyncOutlined',
        },
        {
          path: 'collect',
          component: './Collect',
          title: '收藏片段',
          icon: 'HeartOutlined',
        },
        {
          path: 'tags',
          component: './Tags',
          title: '标签',
          icon: 'TagOutlined',
        },
        {
          path: 'quick',
          component: './Quick',
          title: '快捷操作',
          icon: 'ThunderboltOutlined',
        },
      ],
    },
    {
      path: '/projects',
      component: '@/layouts/SubPageLayout',
      routes: [
        {
          path: 'category',
          component: './ProjectCategory',
          title: '文集分类',
          icon: 'FolderOutlined',
        },
      ],
    },
    {
      path: '/docs',
      component: '@/layouts/SubPageLayout',
      routes: [
        {
          path: 'categoryManager',
          component: './DocCategoryManager',
          title: '文档分类',
          icon: 'FolderOutlined',
        },
      ],
    },
    {
      path: '/projectDetail/:id',
      component: './ProjectDetail',
    },
    {
      path: '/doc/:id',
      component: './Doc',
    },
    {
      path: '/docEdit/:id',
      component: './DocEditor',
    },
  ],
  clientLoader: {},
  npmClient: 'pnpm',
  esbuildMinifyIIFE: true,
  mock: {
    include: ['mock/**/*.ts'],
    exclude: [
      // 核心架构目录（非 mock 路由配置）
      '**/Core/**',
      // 实体数据目录（非 mock 路由配置）
      '**/Entities/**',
      // 任务调度目录（非 mock 路由配置）
      '**/Tasks/**',
      // 独立服务器目录（Koa 模式专用，Umi 模式不需要加载）
      '**/server/**',
      // 消息队列目录（非 mock 路由配置）
      '**/Mq/**',
      // 旧的数据目录（已迁移）
      '**/data.ts',
      '**/data/**',
      // 六层架构中的非 mock 路由配置文件
      '**/controller.ts',
      '**/service.ts',
      '**/*.controller.ts',
      '**/*.service.ts',
      '**/dto.ts',
      '**/*.dto.ts',
      '**/validator.ts',
      '**/*.validator.ts',
      '**/middleware.ts',
      // 数据访问层（非 mock 路由配置）
      '**/repository.ts',
      '**/*.repository.ts',
    ],
  }, // mock 配置
  // mock:false,
  proxy: {
    '/api': {
      // target: 'http://localhost:8000',
      target:
        process.env.NODE_ENV === 'production'
          ? process.env.UMI_APP_PROD_API_BASE_URL
          : process.env.UMI_APP_LOCAL_API_BASE_URL,
      changeOrigin: true,
    },
  },
  mfsu: false, // 关闭mfsu，所有文件都从磁盘读取
  hash: true, // 开启hash，避免浏览器缓存问题
  history: { type: 'browser' }, // 使用浏览器路由模式，避免刷新页面时出现404问题
  publicPath: '/',
  alias: {
    '@': './src',
  },
  // 移动端viewport
  metas: [
    {
      name: 'viewport',
      content:
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no',
    },
  ], // Umi 顶层原生配置，用于自动向打包输出的 index.html 插入 <meta> 标签。
  styles: [
    `
      @media screen and (max-width: 768px) {
        .ant-pro-page-container-children-container {
          padding: 12px !important;
        }
        .ant-card-body {
          padding: 16px !important;
        }
        .ant-pro-grid-content {
          padding: 0 !important;
        }
      }
    `,
  ],
});
