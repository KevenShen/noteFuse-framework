/**
 * L5 运维管理层 - 设置管理 Mixin
 * 
 * 包含：获取索引设置、更新索引设置、获取集群设置、更新集群设置、索引模板管理等
 */

import type { MixinConstructor } from './mixin.types';

/**
 * 设置管理 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithSettings<T extends MixinConstructor>(Base: T) {
  return class SettingsMixin extends Base {
    // ==================== 索引设置 ====================

    /**
     * 获取索引设置
     * 
     * @param indexName 索引名（可选，不指定则返回所有索引的设置）
     * @param options 选项
     * @returns 索引设置
     */
    getIndexSettings(
      indexName?: string,
      options: {
        flat_settings?: boolean;
        include_defaults?: boolean;
      } = {},
    ): Record<string, any> {
      const result: Record<string, any> = {};

      const indexNames = indexName
        ? [indexName]
        : Array.from((this as any).indices.keys()) as string[];

      for (const name of indexNames) {
        const index = (this as any).indices.get(name);
        if (!index) continue;

        const settings = index.settings || this.getDefaultIndexSettings(name);

        if (options.flat_settings) {
          result[name] = {
            settings: this.flattenSettings(settings),
          };
        } else {
          result[name] = { settings };
        }

        if (options.include_defaults) {
          result[name].defaults = this.getDefaultIndexSettings(name);
        }
      }

      return result;
    }

    /**
     * 更新索引设置
     * 
     * @param indexName 索引名
     * @param settings 设置
     * @param options 选项
     * @returns 是否成功
     */
    updateIndexSettings(
      indexName: string,
      settings: Record<string, any>,
      options: {
        preserve_existing?: boolean;
        timeout?: string;
        master_timeout?: string;
      } = {},
    ): {
      acknowledged: boolean;
    } {
      const index = (this as any).indices.get(indexName);
      if (!index) {
        return { acknowledged: false };
      }

      if (!index.settings) {
        index.settings = this.getDefaultIndexSettings(indexName);
      }

      // 合并设置
      for (const [key, value] of Object.entries(settings)) {
        if (options.preserve_existing && index.settings[key] !== undefined) {
          continue;
        }
        this.setNestedSetting(index.settings, key, value);
      }

      return { acknowledged: true };
    }

    // ==================== 集群设置 ====================

    /**
     * 获取集群设置
     * 
     * @param options 选项
     * @returns 集群设置
     */
    getClusterSettings(options: {
      flat_settings?: boolean;
      include_defaults?: boolean;
    } = {}): {
      persistent: Record<string, any>;
      transient: Record<string, any>;
      defaults?: Record<string, any>;
    } {
      const persistent = (this as any).clusterSettings?.persistent || {};
      const transient = (this as any).clusterSettings?.transient || {};
      const defaults = this.getDefaultClusterSettings();

      const result: any = {
        persistent: options.flat_settings ? this.flattenSettings(persistent) : persistent,
        transient: options.flat_settings ? this.flattenSettings(transient) : transient,
      };

      if (options.include_defaults) {
        result.defaults = options.flat_settings ? this.flattenSettings(defaults) : defaults;
      }

      return result;
    }

    /**
     * 更新集群设置
     * 
     * @param settings 设置
     * @param options 选项
     * @returns 是否成功
     */
    updateClusterSettings(
      settings: {
        persistent?: Record<string, any>;
        transient?: Record<string, any>;
      },
      options: {
        flat_settings?: boolean;
        timeout?: string;
        master_timeout?: string;
      } = {},
    ): {
      acknowledged: boolean;
      persistent: Record<string, any>;
      transient: Record<string, any>;
    } {
      if (!(this as any).clusterSettings) {
        (this as any).clusterSettings = {
          persistent: {},
          transient: {},
        };
      }

      if (settings.persistent) {
        for (const [key, value] of Object.entries(settings.persistent)) {
          this.setNestedSetting((this as any).clusterSettings.persistent, key, value);
        }
      }

      if (settings.transient) {
        for (const [key, value] of Object.entries(settings.transient)) {
          this.setNestedSetting((this as any).clusterSettings.transient, key, value);
        }
      }

      return {
        acknowledged: true,
        persistent: (this as any).clusterSettings.persistent,
        transient: (this as any).clusterSettings.transient,
      };
    }

    // ==================== 索引模板管理 ====================

    /**
     * 创建索引模板
     * 
     * @param templateName 模板名
     * @param template 模板配置
     * @returns 是否成功
     */
    createIndexTemplate(
      templateName: string,
      template: {
        index_patterns: string[];
        priority?: number;
        template?: {
          settings?: Record<string, any>;
          mappings?: Record<string, any>;
          aliases?: Record<string, any>;
        };
        data_stream?: Record<string, any>;
        composed_of?: string[];
        version?: number;
        _meta?: Record<string, any>;
      },
    ): {
      acknowledged: boolean;
    } {
      if (!(this as any).indexTemplates) {
        (this as any).indexTemplates = new Map();
      }

      (this as any).indexTemplates.set(templateName, {
        name: templateName,
        index_patterns: template.index_patterns,
        priority: template.priority || 0,
        template: template.template || {},
        data_stream: template.data_stream,
        composed_of: template.composed_of || [],
        version: template.version,
        _meta: template._meta,
      });

      return { acknowledged: true };
    }

    /**
     * 获取索引模板
     * 
     * @param templateName 模板名（可选，支持通配符）
     * @returns 索引模板
     */
    getIndexTemplate(templateName?: string): {
      index_templates: Array<{
        name: string;
        index_template: any;
      }>;
    } {
      const templates: Array<{
        name: string;
        index_template: any;
      }> = [];

      if ((this as any).indexTemplates) {
        for (const [name, template] of (this as any).indexTemplates) {
          if (!templateName || name.includes(templateName.replace(/\*/g, ''))) {
            templates.push({
              name,
              index_template: template,
            });
          }
        }
      }

      return { index_templates: templates };
    }

    /**
     * 删除索引模板
     * 
     * @param templateName 模板名
     * @returns 是否成功
     */
    deleteIndexTemplate(templateName: string): {
      acknowledged: boolean;
    } {
      if (!(this as any).indexTemplates) {
        return { acknowledged: false };
      }

      const deleted = (this as any).indexTemplates.delete(templateName);
      return { acknowledged: deleted };
    }

    /**
     * 检查索引模板是否存在
     * 
     * @param templateName 模板名
     * @returns 是否存在
     */
    existsIndexTemplate(templateName: string): boolean {
      if (!(this as any).indexTemplates) return false;
      return (this as any).indexTemplates.has(templateName);
    }

    // ==================== 工具方法 ====================

    /**
     * 获取默认索引设置
     * 
     * @param indexName 索引名
     * @returns 默认索引设置
     */
    protected getDefaultIndexSettings(indexName: string): Record<string, any> {
      return {
        index: {
          creation_date: String(Date.now()),
          number_of_shards: '5',
          number_of_replicas: '1',
          uuid: `${indexName}-uuid`,
          version: {
            created: '8000099',
          },
          provided_name: indexName,
        },
      };
    }

    /**
     * 获取默认集群设置
     * 
     * @returns 默认集群设置
     */
    protected getDefaultClusterSettings(): Record<string, any> {
      return {
        cluster: {
          name: (this as any).clusterName || 'mock-cluster',
          routing: {
            allocation: {
              enable: 'all',
            },
          },
        },
        discovery: {
          type: 'single-node',
        },
        action: {
          destructive_requires_name: true,
        },
        indices: {
          recovery: {
            max_bytes_per_sec: '40mb',
          },
        },
      };
    }

    /**
     * 扁平化设置（将嵌套对象转换为点号分隔的键）
     * 
     * @param settings 设置
     * @param prefix 前缀
     * @returns 扁平化后的设置
     */
    protected flattenSettings(
      settings: Record<string, any>,
      prefix: string = '',
    ): Record<string, any> {
      const result: Record<string, any> = {};

      for (const [key, value] of Object.entries(settings)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (value && typeof value === 'object' && !Array.isArray(value)) {
          Object.assign(result, this.flattenSettings(value, fullKey));
        } else {
          result[fullKey] = value;
        }
      }

      return result;
    }

    /**
     * 设置嵌套设置（将点号分隔的键转换为嵌套对象）
     * 
     * @param settings 设置对象
     * @param key 键（支持点号嵌套）
     * @param value 值
     */
    protected setNestedSetting(
      settings: Record<string, any>,
      key: string,
      value: any,
    ): void {
      const parts = key.split('.');
      let current = settings;

      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }

      current[parts[parts.length - 1]] = value;
    }
  };
}
