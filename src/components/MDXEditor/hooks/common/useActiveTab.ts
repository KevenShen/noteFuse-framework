/**
 * useActiveTab Hook
 * Tabs 指令专用，底层复用通用 useActiveItem，保持 API 兼容（tabItems 命名）。
 */
import { useActiveItem } from './useActiveItem';

export const useActiveTab = (mdastNode: any) => {
  const { items, activeKey, setActiveKey } = useActiveItem(mdastNode, 'tab');
  return { tabItems: items, activeKey, setActiveKey };
};
