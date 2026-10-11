/**
 * L1 基础层 - 索引管理 Mixin
 * 
 * 包含：创建索引、删除索引、检查索引存在、获取索引信息、列出索引、打开/关闭索引、克隆索引等
 */

import type { MixinConstructor } from './mixin.types';
import type {
  IndexSettings,
  IndexMappings,
  IndexMetadata,
  IndexData,
  IndexStats,
} from '../types';

import { generateUUID } from '../utils';

/**
 * 索引管理 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithIndexManagement<T extends MixinConstructor>(Base: T) {
  return class IndexManagementMixin extends Base {
    // ==================== 索引创建 ====================

    /**
     * 创建索引
     * 
     * @param indexName 索引名
     * @param settings 索引设置
     * @param mappings 字段映射
     * @returns 是否创建成功
     */
    createIndex(
      indexName: string,
      settings: IndexSettings = {},
      mappings: IndexMappings = {},
    ): boolean {
      if (this.indices.has(indexName)) {
        this.debugLog(`索引已存在: ${indexName}`);
        return false;
      }

      // 验证索引名
      if (!this.validateIndexName(indexName)) {
        throw new Error(`无效的索引名: ${indexName}`);
      }

      const indexData = this.createIndexData(indexName, settings, mappings);

      // 应用分析设置
      if (settings.analysis) {
        this.applyAnalysisSettings(settings.analysis);
      }

      this.debugLog(`创建索引: ${indexName}`, {
        settings: indexData.metadata.settings,
        mappings: indexData.metadata.mappings,
      });

      return true;
    }

    /**
     * 创建索引（带选项）
     * 
     * @param indexName 索引名
     * @param options 选项
     * @returns 是否创建成功
     */
    createIndexWithOptions(
      indexName: string,
      options: {
        settings?: IndexSettings;
        mappings?: IndexMappings;
        aliases?: Record<string, any>;
      } = {},
    ): boolean {
      const { settings = {}, mappings = {}, aliases = {} } = options;

      const success = this.createIndex(indexName, settings, mappings);
      if (!success) return false;

      // 创建别名
      for (const aliasName of Object.keys(aliases)) {
        (this as any).putAlias?.(indexName, aliasName);
      }

      return true;
    }

    // ==================== 索引删除 ====================

    /**
     * 删除索引
     * 
     * @param indexName 索引名（支持通配符）
     * @returns 是否删除成功
     */
    deleteIndex(indexName: string): boolean {
      // 支持通配符删除
      if (indexName.includes('*')) {
        const pattern = new RegExp('^' + indexName.replace(/\*/g, '.*') + '$');
        let deleted = false;
        for (const name of Array.from(this.indices.keys())) {
          if (pattern.test(name)) {
            if (this.deleteIndexData(name)) {
              deleted = true;
            }
          }
        }
        return deleted;
      }

      if (!this.indices.has(indexName)) {
        this.debugLog(`索引不存在: ${indexName}`);
        return false;
      }

      const success = this.deleteIndexData(indexName);
      if (success) {
        this.debugLog(`删除索引: ${indexName}`);
      }

      return success;
    }

    /**
     * 批量删除索引
     * 
     * @param indexNames 索引名列表
     * @returns 删除成功的索引数
     */
    deleteIndices(indexNames: string[]): number {
      let count = 0;
      for (const name of indexNames) {
        if (this.deleteIndex(name)) {
          count++;
        }
      }
      return count;
    }

    // ==================== 索引存在性检查 ====================

    /**
     * 检查索引是否存在
     * 
     * @param indexName 索引名（支持别名）
     * @returns 是否存在
     */
    indexExists(indexName: string): boolean {
      // 检查别名
      if (this.aliases.has(indexName)) {
        return true;
      }
      return this.indices.has(indexName);
    }

    /**
     * 批量检查索引存在性
     * 
     * @param indexNames 索引名列表
     * @returns 存在的索引名列表
     */
    indicesExist(indexNames: string[]): string[] {
      return indexNames.filter(name => this.indexExists(name));
    }

    // ==================== 索引信息获取 ====================

    /**
     * 获取索引元数据
     * 
     * @param indexName 索引名
     * @returns 索引元数据或 null
     */
    getIndex(indexName: string): IndexMetadata | null {
      const indexData = this.getIndexData(indexName);
      if (!indexData) return null;
      return this.deepClone(indexData.metadata);
    }

    /**
     * 获取索引设置
     * 
     * @param indexName 索引名
     * @returns 索引设置或 null
     */
    getIndexSettings(indexName: string): IndexSettings | null {
      const indexData = this.getIndexData(indexName);
      if (!indexData) return null;
      return this.deepClone(indexData.metadata.settings);
    }

    /**
     * 获取索引映射
     * 
     * @param indexName 索引名
     * @returns 索引映射或 null
     */
    getIndexMappings(indexName: string): IndexMappings | null {
      const indexData = this.getIndexData(indexName);
      if (!indexData) return null;
      return this.deepClone(indexData.metadata.mappings);
    }

    /**
     * 获取索引统计
     * 
     * @param indexName 索引名
     * @returns 索引统计或 null
     */
    getIndexStats(indexName: string): IndexStats | null {
      return this.getIndexStats(indexName);
    }

    /**
     * 获取多个索引的统计
     * 
     * @param indexNames 索引名列表（可选，默认所有索引）
     * @returns 索引统计映射
     */
    getIndicesStats(indexNames?: string[]): Record<string, IndexStats> {
      const result: Record<string, IndexStats> = {};
      const names = indexNames || Array.from(this.indices.keys());

      for (const name of names) {
        const stats = this.getIndexStats(name);
        if (stats) {
          result[name] = stats;
        }
      }

      return result;
    }

    // ==================== 索引列表 ====================

    /**
     * 列出所有索引
     * 
     * @returns 索引名列表
     */
    listIndices(): string[] {
      return Array.from(this.indices.keys());
    }

    /**
     * 列出所有索引的元数据
     * 
     * @returns 索引元数据映射
     */
    listIndicesWithMetadata(): Record<string, IndexMetadata> {
      const result: Record<string, IndexMetadata> = {};
      for (const [name, data] of this.indices) {
        result[name] = this.deepClone(data.metadata);
      }
      return result;
    }

    /**
     * 列出所有索引的简要信息（cat indices 风格）
     * 
     * @returns 索引简要信息列表
     */
    catIndices(): Array<{
      health: string;
      status: string;
      index: string;
      uuid: string;
      pri: number;
      rep: number;
      'docs.count': number;
      'docs.deleted': number;
      'store.size': string;
      'pri.store.size': string;
    }> {
      const result: Array<{
        health: string;
        status: string;
        index: string;
        uuid: string;
        pri: number;
        rep: number;
        'docs.count': number;
        'docs.deleted': number;
        'store.size': string;
        'pri.store.size': string;
      }> = [];

      for (const [name, data] of this.indices) {
        const sizeBytes = this.estimateIndexSize(data);
        result.push({
          health: 'green',
          status: data.metadata.state,
          index: name,
          uuid: data.metadata.uuid,
          pri: data.metadata.settings.number_of_shards || 1,
          rep: data.metadata.settings.number_of_replicas || 0,
          'docs.count': data.documents.size,
          'docs.deleted': 0,
          'store.size': this.formatBytes(sizeBytes),
          'pri.store.size': this.formatBytes(sizeBytes),
        });
      }

      return result;
    }

    // ==================== 索引打开/关闭 ====================

    /**
     * 打开索引
     * 
     * @param indexName 索引名
     * @returns 是否成功
     */
    openIndex(indexName: string): boolean {
      const indexData = this.getIndexData(indexName);
      if (!indexData) return false;

      if (indexData.metadata.state === 'open') {
        return true;
      }

      indexData.metadata.state = 'open';
      this.clusterStateVersion++;
      this.debugLog(`打开索引: ${indexName}`);
      return true;
    }

    /**
     * 关闭索引
     * 
     * @param indexName 索引名
     * @returns 是否成功
     */
    closeIndex(indexName: string): boolean {
      const indexData = this.getIndexData(indexName);
      if (!indexData) return false;

      if (indexData.metadata.state === 'close') {
        return true;
      }

      indexData.metadata.state = 'close';
      this.clusterStateVersion++;
      this.debugLog(`关闭索引: ${indexName}`);
      return true;
    }

    // ==================== 索引克隆/复制 ====================

    /**
     * 克隆索引
     * 
     * @param sourceIndex 源索引名
     * @param targetIndex 目标索引名
     * @param options 选项
     * @returns 是否成功
     */
    cloneIndex(
      sourceIndex: string,
      targetIndex: string,
      options: {
        settings?: IndexSettings;
        mappings?: IndexMappings;
        copyData?: boolean;
      } = {},
    ): boolean {
      const sourceData = this.getIndexData(sourceIndex);
      if (!sourceData) {
        throw new Error(`源索引不存在: ${sourceIndex}`);
      }

      if (this.indices.has(targetIndex)) {
        throw new Error(`目标索引已存在: ${targetIndex}`);
      }

      const { settings = {}, mappings = {}, copyData = true } = options;

      // 合并设置和映射
      const mergedSettings = {
        ...sourceData.metadata.settings,
        ...settings,
      };
      const mergedMappings = {
        ...sourceData.metadata.mappings,
        ...mappings,
      };

      // 创建目标索引
      const success = this.createIndex(targetIndex, mergedSettings, mergedMappings);
      if (!success) return false;

      // 复制数据
      if (copyData) {
        const targetData = this.getIndexData(targetIndex)!;
        for (const [docId, doc] of sourceData.documents) {
          targetData.documents.set(docId, this.deepClone(doc));
          targetData.versionMap.set(docId, doc._version);
        }
        this.totalDocs += sourceData.documents.size;
      }

      this.debugLog(`克隆索引: ${sourceIndex} -> ${targetIndex}`, { copyData });
      return true;
    }

    /**
     * 重新索引（reindex）
     * 
     * @param sourceIndex 源索引名
     * @param targetIndex 目标索引名
     * @param options 选项
     * @returns 重新索引的文档数
     */
    reindex(
      sourceIndex: string,
      targetIndex: string,
      options: {
        query?: any;
        script?: any;
        conflicts?: 'abort' | 'proceed';
        dest?: {
          index: string;
          version_type?: 'internal' | 'external' | 'external_gte' | 'force';
          op_type?: 'index' | 'create';
        };
      } = {},
    ): number {
      const sourceData = this.getIndexData(sourceIndex);
      if (!sourceData) {
        throw new Error(`源索引不存在: ${sourceIndex}`);
      }

      // 确保目标索引存在
      if (!this.indices.has(targetIndex)) {
        this.createIndex(targetIndex);
      }

      let count = 0;
      for (const [docId, doc] of sourceData.documents) {
        // 应用查询过滤（简化处理）
        if (options.query) {
          // 这里可以调用 matchesQuery 进行过滤
          // 简化处理：全部复制
        }

        // 应用脚本转换（简化处理）
        let newDoc = this.deepClone(doc);
        if (options.script) {
          // 简化处理：不执行脚本
        }

        // 索引到目标索引
        (this as any).index(targetIndex, newDoc._source, { id: docId });
        count++;
      }

      this.debugLog(`重新索引: ${sourceIndex} -> ${targetIndex}`, { count });
      return count;
    }

    // ==================== 索引模板 ====================

    /**
     * 创建索引模板
     * 
     * @param templateName 模板名
     * @param template 模板配置
     * @returns 是否成功
     */
    putIndexTemplate(templateName: string, template: any): boolean {
      this.indexTemplates.set(templateName, template);
      this.debugLog(`创建索引模板: ${templateName}`);
      return true;
    }

    /**
     * 获取索引模板
     * 
     * @param templateName 模板名
     * @returns 模板配置或 null
     */
    getIndexTemplate(templateName: string): any | null {
      return this.indexTemplates.get(templateName) || null;
    }

    /**
     * 删除索引模板
     * 
     * @param templateName 模板名
     * @returns 是否成功
     */
    deleteIndexTemplate(templateName: string): boolean {
      return this.indexTemplates.delete(templateName);
    }

    /**
     * 列出所有索引模板
     * 
     * @returns 模板名列表
     */
    listIndexTemplates(): string[] {
      return Array.from(this.indexTemplates.keys());
    }

    // ==================== 索引验证 ====================

    /**
     * 验证索引名
     * 
     * @param indexName 索引名
     * @returns 是否有效
     */
    protected validateIndexName(indexName: string): boolean {
      if (!indexName || indexName.length === 0) return false;
      if (indexName.length > 255) return false;
      if (indexName.startsWith('_') || indexName.startsWith('-') || indexName.startsWith('+')) return false;
      if (indexName.includes(' ')) return false;
      if (indexName.includes('#')) return false;
      if (indexName.includes(':')) return false;
      if (indexName.includes('?')) return false;
      if (indexName.includes('"')) return false;
      if (indexName.includes('<')) return false;
      if (indexName.includes('>')) return false;
      if (indexName.includes('|')) return false;
      if (indexName !== indexName.toLowerCase()) return false;
      return true;
    }

    /**
     * 格式化字节数
     * 
     * @param bytes 字节数
     * @returns 格式化后的字符串
     */
    protected formatBytes(bytes: number): string {
      if (bytes === 0) return '0b';
      const k = 1024;
      const sizes = ['b', 'kb', 'mb', 'gb', 'tb'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
    }
  };
}
