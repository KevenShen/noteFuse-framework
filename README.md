# 文集项目优化
```
优化目标：优化“文集”功能，即路由（/project），目录为 src/pages/Project
1.优化目标，优化为 Dva 的最新用法，最新用法核心在于 “插件化按需开启” 与 “全面拥抱 React Hooks”。按照最新的最新 Model 编写规范（配合 Immer）：namespace+state+reducers+effects，组件中的最新用法（Hooks 替代 Connect），在 Umi Max 中，强烈废弃传统的 connect 高阶组件，全面使用 @umijs/max 提供的 Hooks API。这不仅解决了 TypeScript 类型推导的痛点，也让代码更简洁。获取状态：使用 useSelector，触发更新：使用 useDispatch，数据严格在model上同步
2.完善mock数据，所有数据都在mock目录中，完善页面按钮所有功能，保持完整的格式，方便直接查看生成后端，mock数据放在/mock/Project,严格按照后端的样式，直接更换真实api地址可使用，数据必须遵循逻辑+data.js数据，通过从data 导入，支持跨接口数据联动。。
3.分类数据必须扁平化存储（分组 + 分类统一管理），即所有数据都在一个数组中，每个数据项都是一个对象，包含功能区、功能项、功能项的子项等。
3.“文集”即路由（/project）按照各区功能区分类（组件内渲染），完全功能分割为组件保存在src/pages/Project/components中并导入来实现完整功能,index为布局嵌入组件，使用Row+Col按照布局分别嵌入components各个组件（每个功能区对应一个组件，组件状态内渲染，组件之间必要的数据才通过props传递数据。），兼融移动端。
```