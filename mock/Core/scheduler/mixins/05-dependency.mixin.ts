/**
 * L3 高级层 - 任务依赖 Mixin
 * 包含：addDependency / removeDependency / getDependencies / getDependents / checkDependencies / getDependencyGraph
 *
 * 【职责】
 * - 任务依赖管理（DAG 有向无环图）
 * - 依赖关系查询
 * - 循环依赖检测
 * - 依赖完成检查
 */

import type { MixinConstructor } from './mixin.types';
import type { TaskDefinition } from '../types';

export function WithDependency<T extends MixinConstructor>(Base: T) {
  return class DependencyMixin extends Base {
    /**
     * 添加依赖（taskId 依赖 dependencyId）
     * @param taskId 当前任务 ID
     * @param dependencyId 依赖的任务 ID
     */
    addDependency(taskId: string, dependencyId: string): void {
      const task = this.tasks.get(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      const dependencyTask = this.tasks.get(dependencyId);
      if (!dependencyTask) {
        throw new Error(`Dependency task not found: ${dependencyId}`);
      }

      // 检查是否已存在依赖
      if (task.dependencies.includes(dependencyId)) {
        return; // 已存在，不重复添加
      }

      // 检查循环依赖
      if (this.checkCircularDependency(taskId, dependencyId)) {
        throw new Error(
          `Circular dependency detected: ${taskId} -> ${dependencyId}`,
        );
      }

      task.dependencies.push(dependencyId);
      this.updateTaskTimestamp(taskId);
    }

    /**
     * 移除依赖
     * @param taskId 当前任务 ID
     * @param dependencyId 要移除的依赖任务 ID
     * @returns 是否成功移除
     */
    removeDependency(taskId: string, dependencyId: string): boolean {
      const task = this.tasks.get(taskId);
      if (!task) return false;

      const index = task.dependencies.indexOf(dependencyId);
      if (index === -1) return false;

      task.dependencies.splice(index, 1);
      this.updateTaskTimestamp(taskId);
      return true;
    }

    /**
     * 获取任务的依赖列表
     * @param id 任务 ID
     * @returns 依赖的任务 ID 列表
     */
    getDependencies(id: string): string[] {
      const task = this.tasks.get(id);
      return task ? [...task.dependencies] : [];
    }

    /**
     * 获取依赖该任务的任务列表（被依赖者）
     * @param id 任务 ID
     * @returns 依赖该任务的任务 ID 列表
     */
    getDependents(id: string): string[] {
      const dependents: string[] = [];
      for (const [taskId, task] of this.tasks.entries()) {
        if (task.dependencies.includes(id)) {
          dependents.push(taskId);
        }
      }
      return dependents;
    }

    /**
     * 检查任务的依赖是否全部完成
     * @param id 任务 ID
     * @returns 依赖是否全部完成
     */
    checkDependencies(id: string): boolean {
      const task = this.tasks.get(id);
      if (!task || task.dependencies.length === 0) return true;

      return task.dependencies.every((depId: string) => {
        const depTask = this.tasks.get(depId);
        if (!depTask) return false; // 依赖任务不存在，视为未完成
        return depTask.status === 'success';
      });
    }

    /**
     * 获取未完成的依赖列表
     * @param id 任务 ID
     * @returns 未完成的依赖任务 ID 列表
     */
    getUnfinishedDependencies(id: string): string[] {
      const task = this.tasks.get(id);
      if (!task) return [];

      return task.dependencies.filter((depId: string) => {
        const depTask = this.tasks.get(depId);
        return !depTask || depTask.status !== 'success';
      });
    }

    /**
     * 获取依赖图（用于调试）
     * @returns 依赖图（任务 ID -> 依赖的任务 ID 列表）
     */
    getDependencyGraph(): Record<string, string[]> {
      const graph: Record<string, string[]> = {};
      for (const [taskId, task] of this.tasks.entries()) {
        if (task.dependencies.length > 0) {
          graph[taskId] = [...task.dependencies];
        }
      }
      return graph;
    }

    /**
     * 检查是否存在循环依赖
     * @param taskId 当前任务 ID
     * @param dependencyId 要添加的依赖任务 ID
     * @returns 是否存在循环依赖
     */
    hasCircularDependency(taskId: string, dependencyId: string): boolean {
      return this.checkCircularDependency(taskId, dependencyId);
    }

    /**
     * 获取任务的所有祖先依赖（递归）
     * @param id 任务 ID
     * @returns 所有祖先依赖的任务 ID 列表
     */
    getAllAncestors(id: string): string[] {
      const ancestors = new Set<string>();
      const stack = [...this.getDependencies(id)];

      while (stack.length > 0) {
        const current = stack.pop()!;
        if (ancestors.has(current)) continue;
        ancestors.add(current);
        stack.push(...this.getDependencies(current));
      }

      return Array.from(ancestors);
    }

    /**
     * 获取任务的所有后代（递归）
     * @param id 任务 ID
     * @returns 所有后代的任务 ID 列表
     */
    getAllDescendants(id: string): string[] {
      const descendants = new Set<string>();
      const stack = [...this.getDependents(id)];

      while (stack.length > 0) {
        const current = stack.pop()!;
        if (descendants.has(current)) continue;
        descendants.add(current);
        stack.push(...this.getDependents(current));
      }

      return Array.from(descendants);
    }

    /**
     * 批量设置任务依赖
     * @param id 任务 ID
     * @param dependencies 依赖的任务 ID 列表
     */
    setDependencies(id: string, dependencies: string[]): void {
      const task = this.tasks.get(id);
      if (!task) {
        throw new Error(`Task not found: ${id}`);
      }

      // 验证所有依赖任务都存在
      for (const depId of dependencies) {
        if (!this.tasks.has(depId)) {
          throw new Error(`Dependency task not found: ${depId}`);
        }
        // 检查循环依赖
        if (this.checkCircularDependency(id, depId)) {
          throw new Error(`Circular dependency detected: ${id} -> ${depId}`);
        }
      }

      task.dependencies = [...dependencies];
      this.updateTaskTimestamp(id);
    }

    /**
     * 清除任务的所有依赖
     * @param id 任务 ID
     */
    clearDependencies(id: string): void {
      const task = this.tasks.get(id);
      if (task) {
        task.dependencies = [];
        this.updateTaskTimestamp(id);
      }
    }

    /**
     * 获取可以立即执行的任务（依赖已全部完成且已调度）
     * @returns 可以立即执行的任务列表
     */
    getReadyTasks(): TaskDefinition[] {
      return this.listTasks('scheduled').filter(
        (t: TaskDefinition) =>
          t.nextRunAt !== undefined &&
          t.nextRunAt <= Date.now() &&
          this.checkDependencies(t.id),
      );
    }
  };
}
