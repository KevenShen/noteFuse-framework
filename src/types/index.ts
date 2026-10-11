export * from './layout/layout-home';


// src/
// ├── types/                     # ✅ 【全局共享类型：跨模块复用】
// │   ├── index.ts
// │   ├── global.d.ts
// │   ├── request/               # 通用响应结构体、分页基础类型（通用契约）
// │   ├── model/                 # 全局App状态、用户、权限（根应用全局状态）
// │   ├── component-props/       # 全局公共组件、布局组件Props（src/components下组件）
// │   ├── utils/                 # 通用工具类型、全局枚举
// │   └── page/                  # 页面通用基础状态（ModalState等通用结构）
// ├── components/                # 全局公共组件
// ├── modules/                   # 🎯【业务域模块，替代传统pages扁平结构】
// │   ├── ProjectManage/         # 业务模块：文集管理
// │   │   ├── index.tsx
// │   │   ├── components/        # 当前模块局部组件
// │   │   ├── services.ts        # 当前模块接口请求
// │   │   └── types.ts           # ⭐【模块私有类型，仅本模块使用】
// │   ├── DocumentEdit/
// │   │   ├── index.tsx
// │   │   ├── components/
// │   │   ├── services.ts
// │   │   └── types.ts
// └── pages/                     # 顶层路由页面/根路由（少量）

// 类型边界铁律（大厂强制 CodeReview 标准）
// 一个类型只在一个模块使用 → 写在模块内 types.ts，禁止上移全局
// ≥2 个业务模块同时引用 → 迁移到 src/types 对应分类
// modules/xxx/types.ts 可以 import @/types；
// 全局 src/types 禁止反向 import 任何 modules 内类型，杜绝循环依赖与耦合
// modules/xxx/types.ts 里面放什么？
// 当前模块独有的接口入参、实体（不通用的业务接口）
// 当前页面查询表单、弹窗状态
// 当前模块局部组件 Props
// 模块内部枚举


// 一、大厂标准：类型严格分层命名 & 职责定义（统一术语）
// 1. src/types/request（全局接口契约层）
// 只存放后端通用基础结构体
// ✅ 允许：ApiResponse<T>、PageQueryParams、PageResult<T>
// ❌ 禁止：存放某个业务独有的 ProjectItem、DocumentParams
// 业务独有实体，放在对应模块 modules/xxx/types.ts
// 2. src/types/component-props
// 只存放 src/components/** 全局公共组件 Props
// ✅ 布局组件、CommonTable、CommonModal、全局业务组件
// ❌ 禁止存放 modules/xxx/components 局部组件 Props（就近写模块 types.ts）
// 3. src/types/model
// 仅存放 Umi useModel 全局根状态
// 用户信息、全局菜单、全局权限、全局 App 配置
// 模块内部局部状态（页面 useState 类型）不进入此处
// 4. src/types/page
// 页面通用基础结构：通用弹窗类型 ModalState<T>、通用筛选结构
// 页面独有表单、弹窗状态留在模块内
// 5. src/types/utils
// 通用工具泛型、全局枚举、基础工具类型
// 6. modules/xxx/types.ts（模块私有域）
// 存放：
// 当前模块专属接口入参、返回实体
// 当前页面查询表单类型
// 当前页面弹窗状态
// 当前模块内部组件 Props

// 二、导出规范（大厂统一标准，避开新手常见坑）
// ❌ 禁止：import.meta.glob 自动扫描导出用于类型入口
// 所有对外导出全部静态手写 index.ts
// 理由：
// TS LSP 跳转、重构 rename、eslint、微前端构建、类型检查全部兼容；动态 glob 会破坏静态分析，线上构建偶发类型丢失，大厂规范直接禁用。
// ✅ 标准分层导出模式
// 每个目录建立 index.ts，聚合当前目录所有类型
// ts
// // src/types/component-props/index.ts
// export * from './layout';
// export * from './base';
// export * from './business';
// export * from './common';
// 顶层总入口 src/types/index.ts
// ts
// export * from './component-props';
// export * from './request';
// export * from './model';
// export * from './page';
// export * from './utils';
// 使用 import type {} from '@/types'
// 模块私有类型不要从 @/types 导入，直接相对导入
// ts
// // modules/ProjectManage/index.tsx
// import type { ProjectListParams, ProjectModalState } from './types';
// 三、导入依赖单向原则（CodeReview 高频卡点）
// plaintext
// modules/*/types.ts → 可以依赖 src/types
// src/types 内部各目录之间允许有限依赖
// ❌ 严禁 src/types → import modules 内任何类型
// ❌ 严禁 component-props → 被 request/model 反向导入
// 目的：防止循环依赖、类型打包体积无限膨胀、模块无法独立抽离成微前端子应用。
// 四、文件与命名规范（通用大厂规约）
// Interface 大驼峰，统一语义后缀
// HomeLayoutProps ✅
// UserListParams ✅
// UserItem 后端实体 ✅
// ModalState 页面状态 ✅
// 类型文件统一 .ts，不要滥用 .d.ts
// 仅全局扩展 window、路由声明放在 global.d.ts
// 一个文件尽量一类实体，避免超大文件
// 优先使用 type 复用、交叉类型 &、继承 extends，减少重复定义

// 六、额外大厂进阶最佳实践（大型项目必备）
// 通用基础类型抽至独立公共包
// 超大型组织：通用分页、响应结构体、基础组件类型抽成独立 npm 包 @company/types，多个前端项目共享。
// 你当前项目单仓库，暂时不需要。
// 区分「契约类型」和「视图类型」
// 契约：后端原始结构 UserItem（request 层，不轻易修改）
// 视图：前端格式化之后用于渲染的类型，尽量不要直接修改契约类型，优先派生新类型
// 不要滥用全局类型
// 很多开发者习惯所有类型全部全局导入，导致无法判断类型使用范围；
// CodeReview 标准：能就近就就近，能不上升全局就不上。
// 七、给你一套可直接落地的混合过渡目录（适配你现在架构，预留微前端扩展）
// plaintext
// src/
// ├── types/                     # 全局共享类型
// │   ├── index.ts
// │   ├── global.d.ts
// │   ├── request/
// │   │   ├── index.ts
// │   │   └── base.ts           # ApiResponse、PageQueryParams 通用基础
// │   ├── model/
// │   │   ├── index.ts
// │   │   ├── user.ts
// │   │   └── app.ts
// │   ├── component-props/
// │   │   ├── index.ts
// │   │   ├── common.ts
// │   │   ├── layout/
// │   │   ├── base/
// │   │   └── business/
// │   ├── page/
// │   │   ├── index.ts
// │   │   └── base-page.ts
// │   └── utils/
// │       ├── index.ts
// │       └── enum.ts
// ├── components/                # 全局公共组件
// ├── modules/                   # 业务模块（后续推荐替代pages）
// │   ├── ProjectManage/
// │   │   ├── index.tsx
// │   │   ├── components/
// │   │   ├── services.ts
// │   │   └── types.ts           # 模块私有类型
// ├── pages/                     # 顶层路由页面
// └── layouts/