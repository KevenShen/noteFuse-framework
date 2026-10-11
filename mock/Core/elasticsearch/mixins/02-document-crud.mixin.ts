/**
 * L1 基础层 - 文档 CRUD Mixin
 * 
 * 包含：索引文档、获取文档、更新文档、删除文档、按查询更新/删除、文档存在性检查等
 */

import type { MixinConstructor } from './mixin.types';
import type {
  Document,
  IndexData,
  QueryDSL,
  CountResult,
} from '../types';

import { generateUUID, matchesQuery, setNestedValue } from '../utils';

/**
 * 文档 CRUD Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithDocumentCRUD<T extends MixinConstructor>(Base: T) {
  return class DocumentCRUDMixin extends Base {
    // ==================== 索引文档（创建/覆盖） ====================

    /**
     * 索引文档（创建或覆盖）
     * 
     * @param indexName 索引名
     * @param document 文档内容
     * @param options 选项
     * @returns 索引后的文档
     */
    index(
      indexName: string,
      document: Record<string, any>,
      options: {
        id?: string;
        version?: number;
        routing?: string;
        op_type?: 'index' | 'create';
        refresh?: boolean;
      } = {},
    ): Document {
      const startTime = Date.now();

      // 确保索引存在
      if (!this.indices.has(indexName)) {
        (this as any).createIndex?.(indexName);
      }

      const indexData = this.getIndexData(indexName)!;

      // 检查索引是否打开
      if (indexData.metadata.state === 'close') {
        throw new Error(`索引已关闭: ${indexName}`);
      }

      // 生成或使用指定的文档ID
      const docId = options.id || this.generateDocId();

      // 检查 op_type=create 时文档是否已存在
      if (options.op_type === 'create' && indexData.documents.has(docId)) {
        throw new Error(`文档已存在: ${indexName}/${docId}`);
      }

      // 版本检查
      const existingDoc = indexData.documents.get(docId);
      const currentVersion = existingDoc?._version || 0;
      if (options.version !== undefined && options.version !== currentVersion) {
        throw new Error(`版本冲突: 期望 ${options.version}, 实际 ${currentVersion}`);
      }

      // 递增序列号和版本号
      indexData.seqNo++;
      const newVersion = currentVersion + 1;

      // 创建文档
      const doc: Document = {
        _index: indexName,
        _id: docId,
        _version: newVersion,
        _seq_no: indexData.seqNo,
        _primary_term: indexData.primaryTerm,
        _source: { ...document },
        _routing: options.routing,
      };

      // 保存文档
      this.saveDocument(indexName, doc);

      // 刷新（如果需要）
      if (options.refresh) {
        this.refresh?.(indexName);
      }

      // 记录索引操作
      this.recordIndexingOperation(Date.now() - startTime);

      this.debugLog(`索引文档: ${indexName}/${docId}`, { version: newVersion });

      return doc;
    }

    /**
     * 批量索引文档
     * 
     * @param indexName 索引名
     * @param documents 文档列表
     * @param options 选项
     * @returns 索引后的文档列表
     */
    bulkIndex(
      indexName: string,
      documents: Array<{
        document: Record<string, any>;
        id?: string;
        routing?: string;
      }>,
      options: { refresh?: boolean } = {},
    ): Document[] {
      const results: Document[] = [];
      for (const { document, id, routing } of documents) {
        results.push(this.index(indexName, document, { id, routing, refresh: options.refresh }));
      }
      return results;
    }

    // ==================== 获取文档 ====================

    /**
     * 获取文档
     * 
     * @param indexName 索引名
     * @param docId 文档ID
     * @param options 选项
     * @returns 文档或 null
     */
    get(
      indexName: string,
      docId: string,
      options: {
        routing?: string;
        _source?: string[] | boolean;
        _source_excludes?: string[];
        _source_includes?: string[];
        stored_fields?: string[];
        version?: number;
        preference?: string;
        realtime?: boolean;
        refresh?: boolean;
      } = {},
    ): Document | null {
      const doc = this.getDocument(indexName, docId);
      if (!doc) return null;

      // 版本检查
      if (options.version !== undefined && options.version !== doc._version) {
        return null;
      }

      // 深拷贝文档
      const result = this.deepClone(doc);

      // 字段过滤
      if (options._source !== undefined) {
        if (options._source === false) {
          result._source = {} as any;
        } else if (Array.isArray(options._source)) {
          const filtered: Record<string, any> = {};
          for (const field of options._source) {
            const value = this.getNestedValue(result._source, field);
            if (value !== undefined) {
              setNestedValue(filtered, field, value);
            }
          }
          result._source = filtered;
        }
      }

      // 包含/排除字段
      if (options._source_includes && options._source_includes.length > 0) {
        const filtered: Record<string, any> = {};
        for (const field of options._source_includes) {
          const value = this.getNestedValue(result._source, field);
          if (value !== undefined) {
            setNestedValue(filtered, field, value);
          }
        }
        result._source = filtered;
      }

      if (options._source_excludes && options._source_excludes.length > 0) {
        for (const field of options._source_excludes) {
          delete result._source[field];
        }
      }

      return result;
    }

    /**
     * 批量获取文档
     * 
     * @param indexName 索引名
     * @param docIds 文档ID列表
     * @param options 选项
     * @returns 文档列表
     */
    mget(
      indexName: string,
      docIds: string[],
      options: {
        _source?: string[] | boolean;
        routing?: string;
      } = {},
    ): Document[] {
      const results: Document[] = [];
      for (const docId of docIds) {
        const doc = this.get(indexName, docId, options);
        if (doc) {
          results.push(doc);
        }
      }
      return results;
    }

    /**
     * 检查文档是否存在
     * 
     * @param indexName 索引名
     * @param docId 文档ID
     * @param options 选项
     * @returns 是否存在
     */
    exists(
      indexName: string,
      docId: string,
      options: { routing?: string; version?: number } = {},
    ): boolean {
      const doc = this.getDocument(indexName, docId);
      if (!doc) return false;
      if (options.version !== undefined && options.version !== doc._version) {
        return false;
      }
      return true;
    }

    // ==================== 更新文档 ====================

    /**
     * 更新文档（部分更新）
     * 
     * @param indexName 索引名
     * @param docId 文档ID
     * @param update 更新内容或脚本
     * @param options 选项
     * @returns 更新后的文档或 null
     */
    update(
      indexName: string,
      docId: string,
      update: {
        doc?: Record<string, any>;
        doc_as_upsert?: boolean;
        script?: {
          source: string;
          lang?: string;
          params?: Record<string, any>;
        };
        scripted_upsert?: boolean;
        upsert?: Record<string, any>;
      },
      options: {
        routing?: string;
        version?: number;
        retry_on_conflict?: number;
        refresh?: boolean;
        _source?: boolean | string[];
        timeout?: string;
        wait_for_active_shards?: string;
      } = {},
    ): Document | null {
      const startTime = Date.now();

      const existingDoc = this.getDocument(indexName, docId);

      // 文档不存在时的处理
      if (!existingDoc) {
        // upsert 处理
        if (update.upsert) {
          return this.index(indexName, update.upsert, {
            id: docId,
            routing: options.routing,
            refresh: options.refresh,
          });
        }

        // doc_as_upsert 处理
        if (update.doc && update.doc_as_upsert) {
          return this.index(indexName, update.doc, {
            id: docId,
            routing: options.routing,
            refresh: options.refresh,
          });
        }

        // scripted_upsert 处理
        if (update.script && update.scripted_upsert) {
          return this.index(indexName, {}, {
            id: docId,
            routing: options.routing,
            refresh: options.refresh,
          });
        }

        this.debugLog(`文档不存在，无法更新: ${indexName}/${docId}`);
        return null;
      }

      // 版本检查（带重试）
      let currentDoc = existingDoc;
      let attempts = 0;
      const maxAttempts = (options.retry_on_conflict || 0) + 1;

      while (attempts < maxAttempts) {
        if (options.version !== undefined && options.version !== currentDoc._version) {
          attempts++;
          if (attempts >= maxAttempts) {
            throw new Error(`版本冲突: ${indexName}/${docId}`);
          }
          // 重新获取文档
          currentDoc = this.getDocument(indexName, docId)!;
          continue;
        }
        break;
      }

      // 合并更新内容
      let newSource = { ...currentDoc._source };

      if (update.doc) {
        newSource = { ...newSource, ...update.doc };
      }

      if (update.script) {
        // 简化脚本处理：支持简单的参数合并
        if (update.script.params) {
          newSource = { ...newSource, ...update.script.params };
        }
      }

      // 创建更新后的文档
      const indexData = this.getIndexData(indexName)!;
      indexData.seqNo++;

      const updatedDoc: Document = {
        ...currentDoc,
        _version: currentDoc._version + 1,
        _seq_no: indexData.seqNo,
        _source: newSource,
      };

      // 保存文档
      this.saveDocument(indexName, updatedDoc);

      // 刷新
      if (options.refresh) {
        this.refresh?.(indexName);
      }

      // 记录索引操作
      this.recordIndexingOperation(Date.now() - startTime);

      this.debugLog(`更新文档: ${indexName}/${docId}`, { version: updatedDoc._version });

      return updatedDoc;
    }

    /**
     * 按查询更新文档
     * 
     * @param indexName 索引名
     * @param query 查询条件
     * @param update 更新内容或脚本
     * @param options 选项
     * @returns 更新的文档数
     */
    updateByQuery(
      indexName: string,
      query: QueryDSL,
      update: {
        doc?: Record<string, any>;
        script?: {
          source: string;
          lang?: string;
          params?: Record<string, any>;
        };
      },
      options: {
        conflicts?: 'abort' | 'proceed';
        refresh?: boolean;
        wait_for_completion?: boolean;
        scroll_size?: number;
        requests_per_second?: number;
        slices?: number | string;
        max_docs?: number;
      } = {},
    ): number {
      const indexData = this.getIndexData(indexName);
      if (!indexData) return 0;

      let count = 0;
      const conflicts = options.conflicts || 'abort';
      const maxDocs = options.max_docs || Infinity;

      for (const [docId, doc] of Array.from(indexData.documents.entries())) {
        if (count >= maxDocs) break;

        try {
          if (matchesQuery(doc, query)) {
            const result = this.update(indexName, docId, update, {
              refresh: options.refresh,
            });
            if (result) {
              count++;
            }
          }
        } catch (error) {
          if (conflicts === 'abort') {
            throw error;
          }
          // proceed: 跳过冲突
        }
      }

      this.debugLog(`按查询更新: ${indexName}`, { count, query });
      return count;
    }

    // ==================== 删除文档 ====================

    /**
     * 删除文档
     * 
     * @param indexName 索引名
     * @param docId 文档ID
     * @param options 选项
     * @returns 是否删除成功
     */
    delete(
      indexName: string,
      docId: string,
      options: {
        routing?: string;
        version?: number;
        version_type?: 'internal' | 'external' | 'external_gte' | 'force';
        refresh?: boolean;
        wait_for_active_shards?: string;
        timeout?: string;
      } = {},
    ): boolean {
      const startTime = Date.now();

      const existingDoc = this.getDocument(indexName, docId);
      if (!existingDoc) {
        this.debugLog(`文档不存在，无法删除: ${indexName}/${docId}`);
        return false;
      }

      // 版本检查
      if (options.version !== undefined) {
        if (options.version_type === 'external' || options.version_type === 'external_gte') {
          if (options.version <= existingDoc._version) {
            throw new Error(`版本冲突: 外部版本 ${options.version} <= 当前版本 ${existingDoc._version}`);
          }
        } else if (options.version !== existingDoc._version) {
          throw new Error(`版本冲突: 期望 ${options.version}, 实际 ${existingDoc._version}`);
        }
      }

      // 删除文档
      const success = this.deleteDocument(indexName, docId);

      // 刷新
      if (options.refresh && success) {
        this.refresh?.(indexName);
      }

      // 记录索引操作
      this.recordIndexingOperation(Date.now() - startTime);

      if (success) {
        this.debugLog(`删除文档: ${indexName}/${docId}`);
      }

      return success;
    }

    /**
     * 按查询删除文档
     * 
     * @param indexName 索引名
     * @param query 查询条件
     * @param options 选项
     * @returns 删除的文档数
     */
    deleteByQuery(
      indexName: string,
      query: QueryDSL,
      options: {
        conflicts?: 'abort' | 'proceed';
        refresh?: boolean;
        wait_for_completion?: boolean;
        scroll_size?: number;
        requests_per_second?: number;
        slices?: number | string;
        max_docs?: number;
      } = {},
    ): number {
      const indexData = this.getIndexData(indexName);
      if (!indexData) return 0;

      let count = 0;
      const conflicts = options.conflicts || 'abort';
      const maxDocs = options.max_docs || Infinity;

      // 收集需要删除的文档ID（避免在遍历时修改Map）
      const toDelete: string[] = [];
      for (const [docId, doc] of indexData.documents) {
        if (count >= maxDocs) break;
        if (matchesQuery(doc, query)) {
          toDelete.push(docId);
          count++;
        }
      }

      // 删除文档
      for (const docId of toDelete) {
        try {
          this.delete(indexName, docId, { refresh: options.refresh });
        } catch (error) {
          if (conflicts === 'abort') {
            throw error;
          }
        }
      }

      this.debugLog(`按查询删除: ${indexName}`, { count, query });
      return count;
    }

    // ==================== 文档计数 ====================

    /**
     * 统计文档数量
     * 
     * @param indexName 索引名
     * @param query 查询条件（可选）
     * @returns 计数结果
     */
    count(
      indexName: string,
      query?: QueryDSL,
    ): CountResult {
      const indexData = this.getIndexData(indexName);
      if (!indexData) {
        return {
          count: 0,
          _shards: {
            total: 0,
            successful: 0,
            skipped: 0,
            failed: 0,
          },
        };
      }

      let count = 0;
      if (query) {
        for (const doc of indexData.documents.values()) {
          if (matchesQuery(doc, query)) {
            count++;
          }
        }
      } else {
        count = indexData.documents.size;
      }

      return {
        count,
        _shards: {
          total: indexData.metadata.settings.number_of_shards || 1,
          successful: indexData.metadata.settings.number_of_shards || 1,
          skipped: 0,
          failed: 0,
        },
      };
    }

    // ==================== 文档版本 ====================

    /**
     * 获取文档版本
     * 
     * @param indexName 索引名
     * @param docId 文档ID
     * @returns 版本号或 null
     */
    getVersion(indexName: string, docId: string): number | null {
      const doc = this.getDocument(indexName, docId);
      return doc?._version || null;
    }

    // ==================== 文档源数据 ====================

    /**
     * 获取文档源数据
     * 
     * @param indexName 索引名
     * @param docId 文档ID
     * @returns 源数据或 null
     */
    getSource(indexName: string, docId: string): Record<string, any> | null {
      const doc = this.getDocument(indexName, docId);
      return doc?._source || null;
    }

    /**
     * 检查文档源数据是否存在
     * 
     * @param indexName 索引名
     * @param docId 文档ID
     * @returns 是否存在
     */
    sourceExists(indexName: string, docId: string): boolean {
      return this.exists(indexName, docId);
    }
  };
}
