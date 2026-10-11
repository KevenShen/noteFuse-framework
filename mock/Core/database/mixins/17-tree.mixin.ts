/**
 * 17 - 树形结构 Mixin
 * 包含：buildTree、getDescendants、getAncestors、getSiblings、isDescendant、getLeafNodes
 */
import type { FlatItem } from '../types/base.types';
import type { TreeNode } from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithTree<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** 构建树形结构 */
    buildTree(rootId?: number | string | null): TreeNode<any>[] {
      if (!(this as any).treeConfig.enabled) throw new Error('树形结构未启用');
      const parentIdField = (this as any).treeConfig.parentIdField || 'parent_id';
      const sortField = (this as any).treeConfig.sortField || 'sort';
      const rootParentId = (this as any).treeConfig.rootParentId ?? 0;
      
      const data = [...(this as any).data].sort((a: any, b: any) => (a[sortField] || 0) - (b[sortField] || 0));
      
      const buildNode = (item: any, depth: number, path: any[]): TreeNode<any> => {
        const children = data
          .filter((child: any) => child[parentIdField] === item.id)
          .map((child: any) => buildNode(child, depth + 1, [...path, item.id]));
        return { data: item, children, depth, path };
      };
      
      const rootItems = data.filter((item: any) => {
        const parentId = item[parentIdField];
        return rootId !== undefined ? parentId === rootId : parentId === rootParentId || parentId == null;
      });
      
      return rootItems.map((item: any) => buildNode(item, 0, []));
    }

    /** 获取所有后代节点 */
    getDescendants(id: number | string): any[] {
      if (!(this as any).treeConfig.enabled) throw new Error('树形结构未启用');
      const parentIdField = (this as any).treeConfig.parentIdField || 'parent_id';
      const descendants: any[] = [];
      const findChildren = (parentId: any) => {
        const children = (this as any).data.filter((item: any) => item[parentIdField] === parentId);
        for (const child of children) {
          descendants.push(child);
          findChildren(child.id);
        }
      };
      findChildren(id);
      return descendants;
    }

    /** 获取所有祖先节点 */
    getAncestors(id: number | string): any[] {
      if (!(this as any).treeConfig.enabled) throw new Error('树形结构未启用');
      const parentIdField = (this as any).treeConfig.parentIdField || 'parent_id';
      const ancestors: any[] = [];
      let currentId: any = id;
      while (currentId !== undefined) {
        const item = (this as any).data.find((i: any) => i.id === currentId);
        if (!item) break;
        const parentId = item[parentIdField];
        if (parentId == null || parentId === 0) break;
        const parent = (this as any).data.find((i: any) => i.id === parentId);
        if (parent) { ancestors.unshift(parent); currentId = parent.id; } else break;
      }
      return ancestors;
    }

    /** 获取兄弟节点 */
    getSiblings(id: number | string): any[] {
      if (!(this as any).treeConfig.enabled) throw new Error('树形结构未启用');
      const parentIdField = (this as any).treeConfig.parentIdField || 'parent_id';
      const item = (this as any).data.find((i: any) => i.id === id);
      if (!item) return [];
      return (this as any).data.filter((i: any) => i[parentIdField] === item[parentIdField] && i.id !== id);
    }

    /** 检查是否为后代节点 */
    isDescendant(ancestorId: number | string, descendantId: number | string): boolean {
      return this.getDescendants(ancestorId).some((item: any) => item.id === descendantId);
    }

    /** 获取叶子节点 */
    getLeafNodes(): any[] {
      if (!(this as any).treeConfig.enabled) throw new Error('树形结构未启用');
      const parentIdField = (this as any).treeConfig.parentIdField || 'parent_id';
      const childIds = new Set((this as any).data.map((item: any) => item[parentIdField]));
      return (this as any).data.filter((item: any) => !childIds.has(item.id));
    }
  };
}
