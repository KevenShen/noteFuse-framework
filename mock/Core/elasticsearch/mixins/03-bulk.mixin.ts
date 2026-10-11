/**
 * L1 基础层 - 批量操作 Mixin
 * 
 * 包含：bulk 批量操作、mget 批量获取、msearch 批量搜索、mupdate 批量更新、mdelete 批量删除等
 */

import type { MixinConstructor } from './mixin.types';
import type {
  Document,
  BulkOperation,
  BulkResult,
  SearchRequest,
  SearchResult,
  QueryDSL,
} from '../types';

import { matchesQuery } from '../utils';

/**
 * 批量操作 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithBulk<T extends MixinConstructor>(Base: T) {
  return class BulkMixin extends Base {
    // ==================== bulk 批量操作 ====================

    /**
     * 批量操作
     * 
     * 支持 index、create、update、delete 四种操作
     * 
     * @param operations 操作列表
     * @param options 选项
     * @returns 批量操作结果
     */
    bulk(
      operations: BulkOperation[],
      options: {
        refresh?: boolean;
        timeout?: string;
        wait_for_active_shards?: string;
        require_alias?: boolean;
        pipeline?: string;
        _source?: boolean | string[];
        _source_excludes?: string[];
        _source_includes?: string[];
      } = {},
    ): BulkResult {
      const startTime = Date.now();
      const items: BulkResult['items'] = [];
      let hasErrors = false;

      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];

        try {
          // index 操作
          if (op.index) {
            const { _index, _id, _version, routing } = op.index;
            const document = operations[i + 1] as unknown as Record<string, any>;
            i++; // 跳过文档行

            const result = (this as any).index(_index, document, {
              id: _id,
              version: _version,
              routing,
              refresh: options.refresh,
            });

            items.push({
              index: {
                _index: result._index,
                _id: result._id,
                _version: result._version,
                result: 'created',
                _shards: { total: 1, successful: 1, failed: 0 },
                _seq_no: result._seq_no,
                _primary_term: result._primary_term,
                status: 201,
              },
            });
          }
          // create 操作
          else if (op.create) {
            const { _index, _id, _version, routing } = op.create;
            const document = operations[i + 1] as unknown as Record<string, any>;
            i++; // 跳过文档行

            const result = (this as any).index(_index, document, {
              id: _id,
              version: _version,
              routing,
              op_type: 'create',
              refresh: options.refresh,
            });

            items.push({
              create: {
                _index: result._index,
                _id: result._id,
                _version: result._version,
                result: 'created',
                _shards: { total: 1, successful: 1, failed: 0 },
                _seq_no: result._seq_no,
                _primary_term: result._primary_term,
                status: 201,
              },
            });
          }
          // update 操作
          else if (op.update) {
            const { _index, _id, _version, routing, retry_on_conflict } = op.update;
            const updateDoc = operations[i + 1] as unknown as {
              doc?: Record<string, any>;
              doc_as_upsert?: boolean;
              script?: any;
              upsert?: Record<string, any>;
            };
            i++; // 跳过文档行

            const result = (this as any).update(_index, _id, updateDoc, {
              version: _version,
              routing,
              retry_on_conflict,
              refresh: options.refresh,
            });

            if (result) {
              items.push({
                update: {
                  _index: result._index,
                  _id: result._id,
                  _version: result._version,
                  result: 'updated',
                  _shards: { total: 1, successful: 1, failed: 0 },
                  _seq_no: result._seq_no,
                  _primary_term: result._primary_term,
                  status: 200,
                },
              });
            } else {
              hasErrors = true;
              items.push({
                update: {
                  _index,
                  _id,
                  _version: 0,
                  status: 404,
                  error: { type: 'document_missing_exception', reason: 'document not found' },
                },
              });
            }
          }
          // delete 操作
          else if (op.delete) {
            const { _index, _id, _version, routing } = op.delete;

            const success = (this as any).delete(_index, _id, {
              version: _version,
              routing,
              refresh: options.refresh,
            });

            if (success) {
              items.push({
                delete: {
                  _index,
                  _id,
                  _version: _version ? _version + 1 : 1,
                  result: 'deleted',
                  _shards: { total: 1, successful: 1, failed: 0 },
                  status: 200,
                },
              });
            } else {
              hasErrors = true;
              items.push({
                delete: {
                  _index,
                  _id,
                  _version: 0,
                  status: 404,
                  error: { type: 'document_missing_exception', reason: 'document not found' },
                },
              });
            }
          }
        } catch (error: any) {
          hasErrors = true;
          const opType = op.index ? 'index' : op.create ? 'create' : op.update ? 'update' : 'delete';
          const opData = op[opType as keyof typeof op] as any;

          items.push({
            [opType]: {
              _index: opData?._index || '',
              _id: opData?._id || '',
              status: 400,
              error: {
                type: error.name || 'exception',
                reason: error.message || 'Unknown error',
              },
            },
          } as any);
        }
      }

      const duration = Date.now() - startTime;
      this.recordIndexingOperation(duration);

      this.debugLog(`批量操作完成`, {
        operations: operations.length,
        items: items.length,
        errors: hasErrors,
        duration,
      });

      return {
        took: duration,
        errors: hasErrors,
        items,
      };
    }

    /**
     * 批量索引（简化版）
     * 
     * @param indexName 索引名
     * @param documents 文档列表
     * @param options 选项
     * @returns 批量操作结果
     */
    bulkIndex(
      indexName: string,
      documents: Array<{
        id?: string;
        document: Record<string, any>;
        routing?: string;
      }>,
      options: { refresh?: boolean } = {},
    ): BulkResult {
      const operations: BulkOperation[] = [];

      for (const { id, document, routing } of documents) {
        operations.push({
          index: {
            _index: indexName,
            _id: id,
            routing,
          },
        });
        // 将文档作为下一个操作传入（模拟 Elasticsearch bulk API 格式）
        operations.push(document as unknown as BulkOperation);
      }

      return this.bulk(operations, options);
    }

    // ==================== mget 批量获取 ====================

    /**
     * 批量获取文档
     * 
     * @param indexName 默认索引名
     * @param ids 文档ID列表或文档描述列表
     * @param options 选项
     * @returns 文档列表
     */
    mget(
      indexName: string,
      ids: Array<string | {
        _index?: string;
        _id: string;
        _routing?: string;
        _source?: boolean | string[];
      }>,
      options: {
        _source?: boolean | string[];
        routing?: string;
        preference?: string;
        realtime?: boolean;
        refresh?: boolean;
      } = {},
    ): Document[] {
      const results: Document[] = [];

      for (const idItem of ids) {
        let docIndex = indexName;
        let docId: string;
        let docRouting = options.routing;
        let docSource = options._source;

        if (typeof idItem === 'string') {
          docId = idItem;
        } else {
          docIndex = idItem._index || indexName;
          docId = idItem._id;
          docRouting = idItem._routing || options.routing;
          docSource = idItem._source !== undefined ? idItem._source : options._source;
        }

        const doc = (this as any).get(docIndex, docId, {
          routing: docRouting,
          _source: docSource,
        });

        if (doc) {
          results.push(doc);
        }
      }

      this.debugLog(`批量获取: ${indexName}`, { count: results.length });
      return results;
    }

    // ==================== msearch 批量搜索 ====================

    /**
     * 批量搜索
     * 
     * @param requests 搜索请求列表（每个请求包含 header 和 body）
     * @param options 选项
     * @returns 搜索结果列表
     */
    msearch(
      requests: Array<{
        header: {
          index?: string | string[];
          search_type?: string;
          preference?: string;
          routing?: string;
        };
        body: SearchRequest;
      }>,
      options: {
        search_type?: string;
        max_concurrent_searches?: number;
        max_concurrent_shard_requests?: number;
        pre_filter_shard_size?: number;
        rest_total_hits_as_int?: boolean;
        ccs_minimize_roundtrips?: boolean;
      } = {},
    ): Array<SearchResult | { error: any }> {
      const results: Array<SearchResult | { error: any }> = [];

      for (const { header, body } of requests) {
        try {
          const index = header.index || body.index;
          const searchRequest: SearchRequest = {
            ...body,
            index,
          };

          const result = (this as any).search(searchRequest);
          results.push(result);
        } catch (error: any) {
          results.push({
            error: {
              type: error.name || 'exception',
              reason: error.message || 'Unknown error',
            },
          });
        }
      }

      this.debugLog(`批量搜索`, { count: results.length });
      return results;
    }

    // ==================== mupdate 批量更新 ====================

    /**
     * 批量更新文档
     * 
     * @param indexName 默认索引名
     * @param updates 更新列表
     * @param options 选项
     * @returns 批量操作结果
     */
    mupdate(
      indexName: string,
      updates: Array<{
        _index?: string;
        _id: string;
        doc?: Record<string, any>;
        doc_as_upsert?: boolean;
        script?: any;
        upsert?: Record<string, any>;
        _routing?: string;
      }>,
      options: {
        refresh?: boolean;
        retry_on_conflict?: number;
      } = {},
    ): BulkResult {
      const operations: BulkOperation[] = [];

      for (const update of updates) {
        operations.push({
          update: {
            _index: update._index || indexName,
            _id: update._id,
            routing: update._routing,
            retry_on_conflict: options.retry_on_conflict,
          },
        });

        const updateBody: Record<string, any> = {};
        if (update.doc) updateBody.doc = update.doc;
        if (update.doc_as_upsert) updateBody.doc_as_upsert = update.doc_as_upsert;
        if (update.script) updateBody.script = update.script;
        if (update.upsert) updateBody.upsert = update.upsert;

        operations.push(updateBody as unknown as BulkOperation);
      }

      return (this as any).bulk(operations, options);
    }

    // ==================== mdelete 批量删除 ====================

    /**
     * 批量删除文档
     * 
     * @param indexName 默认索引名
     * @param ids 文档ID列表或文档描述列表
     * @param options 选项
     * @returns 批量操作结果
     */
    mdelete(
      indexName: string,
      ids: Array<string | {
        _index?: string;
        _id: string;
        _routing?: string;
      }>,
      options: {
        refresh?: boolean;
      } = {},
    ): BulkResult {
      const operations: BulkOperation[] = [];

      for (const idItem of ids) {
        let docIndex = indexName;
        let docId: string;
        let docRouting: string | undefined;

        if (typeof idItem === 'string') {
          docId = idItem;
        } else {
          docIndex = idItem._index || indexName;
          docId = idItem._id;
          docRouting = idItem._routing;
        }

        operations.push({
          delete: {
            _index: docIndex,
            _id: docId,
            routing: docRouting,
          },
        });
      }

      return (this as any).bulk(operations, options);
    }

    // ==================== 批量工具方法 ====================

    /**
     * 从 bulk 操作结果中提取成功的操作
     * 
     * @param result bulk 操作结果
     * @returns 成功的操作列表
     */
    getSuccessfulBulkItems(result: BulkResult): BulkResult['items'] {
      return result.items.filter(item => {
        const opType = Object.keys(item)[0] as keyof typeof item;
        const opResult = item[opType] as any;
        return opResult.status < 400 && !opResult.error;
      });
    }

    /**
     * 从 bulk 操作结果中提取失败的操作
     * 
     * @param result bulk 操作结果
     * @returns 失败的操作列表
     */
    getFailedBulkItems(result: BulkResult): BulkResult['items'] {
      return result.items.filter(item => {
        const opType = Object.keys(item)[0] as keyof typeof item;
        const opResult = item[opType] as any;
        return opResult.status >= 400 || opResult.error;
      });
    }

    /**
     * 重试 bulk 操作中失败的项
     * 
     * @param result bulk 操作结果
     * @param documents 原始文档列表（用于重试）
     * @param options 选项
     * @returns 重试后的 bulk 操作结果
     */
    retryFailedBulkItems(
      result: BulkResult,
      documents: Record<string, any>[],
      options: { maxRetries?: number; refresh?: boolean } = {},
    ): BulkResult {
      const failedItems = this.getFailedBulkItems(result);
      if (failedItems.length === 0) return result;

      const retryOperations: BulkOperation[] = [];
      for (const item of failedItems) {
        const opType = Object.keys(item)[0];
        const opResult = item[opType as keyof typeof item] as any;

        // 找到对应的文档并重试
        const docIndex = documents.findIndex(d => d._id === opResult._id);
        if (docIndex >= 0) {
          retryOperations.push({
            [opType]: {
              _index: opResult._index,
              _id: opResult._id,
            },
          } as BulkOperation);
          retryOperations.push(documents[docIndex] as unknown as BulkOperation);
        }
      }

      if (retryOperations.length === 0) return result;

      return this.bulk(retryOperations, { refresh: options.refresh });
    }
  };
}
