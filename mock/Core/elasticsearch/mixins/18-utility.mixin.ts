/**
 * L5 运维管理层 - 工具方法 Mixin
 * 
 * 包含：通用工具方法、文档工具、查询工具、性能监控、任务管理等
 */

import type { MixinConstructor } from './mixin.types';
import type { Document } from '../types';

/**
 * 工具方法 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithUtility<T extends MixinConstructor>(Base: T) {
  return class UtilityMixin extends Base {
    // ==================== 通用工具方法 ====================

    /**
     * 生成唯一ID
     * 
     * @returns 唯一ID
     */
    generateId(): string {
      return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
    }

    /**
     * 深拷贝对象
     * 
     * @param obj 对象
     * @returns 深拷贝后的对象
     */
    deepClone<T>(obj: T): T {
      if (obj === null || typeof obj !== 'object') {
        return obj;
      }
      return JSON.parse(JSON.stringify(obj));
    }

    /**
     * 安全获取嵌套属性
     * 
     * @param obj 对象
     * @param path 路径（点号分隔）
     * @param defaultValue 默认值
     * @returns 属性值或默认值
     */
    safeGet(
      obj: any,
      path: string,
      defaultValue: any = undefined,
    ): any {
      if (!obj || !path) return defaultValue;

      const parts = path.split('.');
      let current = obj;

      for (const part of parts) {
        if (current === null || current === undefined) {
          return defaultValue;
        }
        current = current[part];
      }

      return current === undefined ? defaultValue : current;
    }

    /**
     * 安全设置嵌套属性
     * 
     * @param obj 对象
     * @param path 路径（点号分隔）
     * @param value 值
     */
    safeSet(obj: any, path: string, value: any): void {
      if (!obj || !path) return;

      const parts = path.split('.');
      let current = obj;

      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }

      current[parts[parts.length - 1]] = value;
    }

    // ==================== 文档工具 ====================

    /**
     * 从文档中提取字段值
     * 
     * @param doc 文档
     * @param field 字段名（支持点号嵌套）
     * @returns 字段值
     */
    extractFieldValue(doc: Document, field: string): any {
      return (this as any).getNestedValue(doc._source, field);
    }

    /**
     * 验证文档ID
     * 
     * @param id 文档ID
     * @returns 是否有效
     */
    isValidDocumentId(id: string): boolean {
      if (!id || typeof id !== 'string') return false;
      // 不允许包含 #、\、/、*、?、"、<、>、|、空格
      const invalidChars = /[#\\/*?"<>|\s]/;
      return !invalidChars.test(id);
    }

    /**
     * 规范化文档
     * 
     * @param doc 文档
     * @returns 规范化后的文档
     */
    normalizeDocument(doc: Partial<Document>): Document {
      return {
        _id: doc._id || this.generateId(),
        _index: doc._index || '',
        _source: doc._source || {},
        _version: doc._version || 1,
        _seq_no: doc._seq_no || 0,
        _primary_term: doc._primary_term || 1,
        _score: doc._score,
        _routing: doc._routing,
      };
    }

    /**
     * 比较两个文档是否相同
     * 
     * @param doc1 文档1
     * @param doc2 文档2
     * @returns 是否相同
     */
    isDocumentEqual(doc1: Document, doc2: Document): boolean {
      return doc1._id === doc2._id &&
        JSON.stringify(doc1._source) === JSON.stringify(doc2._source);
    }

    // ==================== 查询工具 ====================

    /**
     * 验证查询DSL
     * 
     * @param query 查询
     * @returns 验证结果
     */
    validateQuery(query: any): {
      valid: boolean;
      error?: string;
    } {
      if (!query || typeof query !== 'object') {
        return { valid: false, error: 'Query must be an object' };
      }

      // 检查是否包含有效的查询类型
      const validQueryTypes = [
        'match_all', 'match', 'match_phrase', 'match_phrase_prefix',
        'multi_match', 'common', 'query_string', 'simple_query_string',
        'term', 'terms', 'terms_set', 'range', 'exists', 'prefix',
        'wildcard', 'regexp', 'fuzzy', 'type', 'ids',
        'bool', 'boosting', 'constant_score', 'dis_max', 'function_score',
        'nested', 'has_child', 'has_parent', 'parent_id',
        'geo_bounding_box', 'geo_distance', 'geo_polygon', 'geo_shape',
        'span_containing', 'span_within', 'span_first', 'span_multi',
        'span_near', 'span_not', 'span_or', 'span_term',
        'percolate', 'wrapper', 'script', 'script_score',
        'distance_feature', 'more_like_this', 'template', 'knn',
      ];

      const keys = Object.keys(query);
      if (keys.length === 0) {
        return { valid: false, error: 'Query must contain at least one clause' };
      }

      for (const key of keys) {
        if (!validQueryTypes.includes(key)) {
          return { valid: false, error: `Unknown query type: ${key}` };
        }
      }

      return { valid: true };
    }

    /**
     * 重写查询（用于查询优化）
     * 
     * @param query 查询
     * @returns 优化后的查询
     */
    rewriteQuery(query: any): any {
      // 简化实现：直接返回原查询
      return this.deepClone(query);
    }

    // ==================== 性能监控 ====================

    /**
     * 开始性能计时
     * 
     * @param label 标签
     * @returns 计时ID
     */
    startPerformanceTimer(label: string): string {
      if (!(this as any).performanceTimers) {
        (this as any).performanceTimers = new Map();
      }

      const timerId = this.generateId();
      (this as any).performanceTimers.set(timerId, {
        label,
        startTime: Date.now(),
      });

      return timerId;
    }

    /**
     * 结束性能计时
     * 
     * @param timerId 计时ID
     * @returns 耗时（毫秒）
     */
    endPerformanceTimer(timerId: string): number {
      if (!(this as any).performanceTimers) return 0;

      const timer = (this as any).performanceTimers.get(timerId);
      if (!timer) return 0;

      const duration = Date.now() - timer.startTime;
      (this as any).performanceTimers.delete(timerId);

      // 记录性能统计
      if (!(this as any).performanceStats) {
        (this as any).performanceStats = new Map();
      }

      const stats = (this as any).performanceStats.get(timer.label) || {
        count: 0,
        totalTime: 0,
        minTime: Infinity,
        maxTime: 0,
      };

      stats.count++;
      stats.totalTime += duration;
      stats.minTime = Math.min(stats.minTime, duration);
      stats.maxTime = Math.max(stats.maxTime, duration);

      (this as any).performanceStats.set(timer.label, stats);

      return duration;
    }

    /**
     * 获取性能统计
     * 
     * @returns 性能统计
     */
    getPerformanceStats(): Record<string, {
      count: number;
      total_time: number;
      avg_time: number;
      min_time: number;
      max_time: number;
    }> {
      const result: Record<string, any> = {};

      if ((this as any).performanceStats) {
        for (const [label, stats] of (this as any).performanceStats) {
          result[label] = {
            count: stats.count,
            total_time: stats.totalTime,
            avg_time: stats.count > 0 ? stats.totalTime / stats.count : 0,
            min_time: stats.minTime === Infinity ? 0 : stats.minTime,
            max_time: stats.maxTime,
          };
        }
      }

      return result;
    }

    // ==================== 任务管理 ====================

    /**
     * 创建任务
     * 
     * @param taskType 任务类型
     * @param params 参数
     * @returns 任务信息
     */
    createTask(
      taskType: string,
      params: Record<string, any> = {},
    ): {
      task: string;
      type: string;
      status: 'pending' | 'running' | 'completed' | 'failed';
      created_at: number;
      params: Record<string, any>;
    } {
      if (!(this as any).tasks) {
        (this as any).tasks = new Map();
      }

      const taskId = this.generateId();
      const task = {
        task: taskId,
        type: taskType,
        status: 'pending' as const,
        created_at: Date.now(),
        params,
      };

      (this as any).tasks.set(taskId, task);
      return task;
    }

    /**
     * 获取任务状态
     * 
     * @param taskId 任务ID
     * @returns 任务信息或 null
     */
    getTask(taskId: string): any | null {
      if (!(this as any).tasks) return null;
      return (this as any).tasks.get(taskId) || null;
    }

    /**
     * 更新任务状态
     * 
     * @param taskId 任务ID
     * @param status 状态
     * @param result 结果
     */
    updateTaskStatus(
      taskId: string,
      status: 'pending' | 'running' | 'completed' | 'failed',
      result?: any,
    ): void {
      if (!(this as any).tasks) return;

      const task = (this as any).tasks.get(taskId);
      if (task) {
        task.status = status;
        task.updated_at = Date.now();
        if (result !== undefined) {
          task.result = result;
        }
      }
    }

    /**
     * 取消任务
     * 
     * @param taskId 任务ID
     * @returns 是否成功
     */
    cancelTask(taskId: string): boolean {
      if (!(this as any).tasks) return false;

      const task = (this as any).tasks.get(taskId);
      if (!task) return false;

      if (task.status === 'running') {
        task.status = 'failed';
        task.cancelled = true;
        return true;
      }

      return false;
    }

    /**
     * 获取任务列表
     * 
     * @param options 选项
     * @returns 任务列表
     */
    listTasks(options: {
      status?: string;
      type?: string;
      size?: number;
    } = {}): any[] {
      if (!(this as any).tasks) return [];

      let tasks = Array.from((this as any).tasks.values()) as any[];

      if (options.status) {
        tasks = tasks.filter((t: any) => t.status === options.status);
      }

      if (options.type) {
        tasks = tasks.filter((t: any) => t.type === options.type);
      }

      if (options.size) {
        tasks = tasks.slice(0, options.size);
      }

      return tasks;
    }

    // ==================== 版本管理 ====================

    /**
     * 获取版本信息
     * 
     * @returns 版本信息
     */
    getVersionInfo(): {
      number: string;
      build_flavor: string;
      build_type: string;
      build_hash: string;
      build_date: string;
      build_snapshot: boolean;
      lucene_version: string;
      minimum_wire_compatibility_version: string;
      minimum_index_compatibility_version: string;
    } {
      return {
        number: '8.0.0',
        build_flavor: 'default',
        build_type: 'tar',
        build_hash: 'mock-build-hash',
        build_date: '2023-01-01T00:00:00.000Z',
        build_snapshot: false,
        lucene_version: '9.0.0',
        minimum_wire_compatibility_version: '7.17.0',
        minimum_index_compatibility_version: '7.0.0',
      };
    }

    /**
     * 检查版本兼容性
     * 
     * @param version 版本号
     * @returns 是否兼容
     */
    isVersionCompatible(version: string): boolean {
      // 简化实现：检查主版本号
      const majorVersion = parseInt(version.split('.')[0], 10);
      return majorVersion >= 7;
    }
  };
}
