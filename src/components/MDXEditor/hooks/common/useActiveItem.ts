/**
 * useActiveItem Hook
 * 通用的指令子项激活管理 hook，供 Tabs、Steps 等容器指令复用。
 * 封装：子项过滤、activeKey 管理、边界保护（子项减少时自动回退）。
 */
import { useState, useMemo, useEffect } from 'react';

export interface DirectiveItem {
  name: string;
  attributes?: Record<string, string>;
  children?: any[];
}

interface UseActiveItemResult {
  /** 过滤后的子项列表 */
  items: DirectiveItem[];
  /** 当前激活索引 */
  activeKey: number;
  /** 设置激活索引 */
  setActiveKey: (idx: number) => void;
}

/**
 * @param mdastNode 容器指令节点
 * @param itemName  子项指令名（如 'tab' / 'step'）
 */
export const useActiveItem = (mdastNode: any, itemName: string): UseActiveItemResult => {
  const [activeKey, setActiveKey] = useState(0);

  const items = useMemo<DirectiveItem[]>(() => {
    const children = mdastNode?.children || [];
    return children.filter((node: any) => node.name === itemName);
  }, [mdastNode, itemName]);

  // 边界保护：子项减少时，自动回退到最后一个有效索引
  useEffect(() => {
    if (items.length === 0) return;
    if (activeKey >= items.length) {
      setActiveKey(items.length - 1);
    }
  }, [items.length, activeKey]);

  return { items, activeKey, setActiveKey };
};
