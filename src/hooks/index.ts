// src/hooks/index.ts
// 自定义 Hooks 统一导出入口

// 用户相关
export { default as useCurrentUser } from './useCurrentUser';

// 响应式相关
export { useMobile } from './useMobile';

// 性能优化相关
export { useShallowSelector } from './useShallowSelector';

// clientLoader 相关
export { default as useClientLoaderSync } from './useClientLoaderSync';
export { default as useMergedState } from './useMergedState';

// 生命周期相关
export { default as useUpdateEffect } from './useUpdateEffect';
