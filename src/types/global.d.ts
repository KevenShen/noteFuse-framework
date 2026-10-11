/** 识别静态资源 */
declare module '*.css';
declare module '*.less';
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.gif';
declare module '*.svg' {
  import type React from 'react';
  export function ReactComponent(
    props: React.SVGProps<SVGSVGElement>,
  ): React.ReactElement;
  const src: string;
  export default src;
}
/** 扩展window全局变量 */
interface Window {
  /** 示例：埋点全局方法 */
  track?: (eventName: string, data?: Record<string, any>) => void;
}

/** 无类型第三方包临时兼容 */
// declare module 'some-package-without-types';

// ✅ global.d.ts 允许写的内容（只做 3 件事）
// 静态资源模块声明（png/svg/css/less）
// 扩展全局 Window 对象
// 缺少类型第三方包简易声明 declare module 'xxx'
// ❌ global.d.ts 严禁写入
// 后端接口实体：Project、Doc、CurrentUser、Response<T>
// 组件 Props、页面状态、枚举
// declare namespace API {} 大规模业务命名空间（重点！）
