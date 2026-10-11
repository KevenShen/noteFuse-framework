/**
 * L5 运维管理层 - 集群管理 Mixin
 * 
 * 包含：集群健康检查、集群状态、节点信息、索引统计、分片信息、集群设置等
 */

import type { MixinConstructor } from './mixin.types';

/**
 * 集群管理 Mixin
 * 
 * @param Base 基类
 * @returns 增强后的类
 */
export function WithCluster<T extends MixinConstructor>(Base: T) {
  return class ClusterMixin extends Base {
    // ==================== 集群健康检查 ====================

    /**
     * 获取集群健康状态
     * 
     * @param indexName 索引名（可选，不指定则返回整个集群的健康状态）
     * @returns 集群健康状态
     */
    clusterHealth(indexName?: string): {
      cluster_name: string;
      status: 'green' | 'yellow' | 'red';
      timed_out: boolean;
      number_of_nodes: number;
      number_of_data_nodes: number;
      active_primary_shards: number;
      active_shards: number;
      relocating_shards: number;
      initializing_shards: number;
      unassigned_shards: number;
      delayed_unassigned_shards: number;
      number_of_pending_tasks: number;
      number_of_in_flight_fetch: number;
      task_max_waiting_in_queue_millis: number;
      active_shards_percent_as_number: number;
    } {
      const indices = indexName
        ? [(this as any).indices.get(indexName)].filter(Boolean)
        : Array.from((this as any).indices.values());

      const totalShards = indices.length * 5; // 假设每个索引5个主分片
      const activeShards = totalShards; // Mock 环境下所有分片都活跃

      // 计算状态：有索引则 green，否则 yellow
      const status: 'green' | 'yellow' | 'red' = indices.length > 0 ? 'green' : 'yellow';

      return {
        cluster_name: (this as any).clusterName || 'mock-cluster',
        status,
        timed_out: false,
        number_of_nodes: 1,
        number_of_data_nodes: 1,
        active_primary_shards: totalShards,
        active_shards: activeShards,
        relocating_shards: 0,
        initializing_shards: 0,
        unassigned_shards: 0,
        delayed_unassigned_shards: 0,
        number_of_pending_tasks: 0,
        number_of_in_flight_fetch: 0,
        task_max_waiting_in_queue_millis: 0,
        active_shards_percent_as_number: 100.0,
      };
    }

    // ==================== 集群状态 ====================

    /**
     * 获取集群状态
     * 
     * @param options 选项
     * @returns 集群状态
     */
    clusterState(options: {
      metric?: string[];
      index?: string;
      flat_settings?: boolean;
      wait_for_metadata_version?: number;
      wait_for_timeout?: string;
      ignore_unavailable?: boolean;
      allow_no_indices?: boolean;
      expand_wildcards?: string;
      local?: boolean;
    } = {}): {
      cluster_name: string;
      cluster_uuid: string;
      version: number;
      state_uuid: string;
      master_node: string;
      blocks: Record<string, any>;
      nodes: Record<string, any>;
      metadata: {
        cluster_uuid: string;
        templates: Record<string, any>;
        indices: Record<string, any>;
        [key: string]: any;
      };
      routing_table: Record<string, any>;
      routing_nodes: Record<string, any>;
      [key: string]: any;
    } {
      const indicesMetadata: Record<string, any> = {};

      for (const [indexName, index] of (this as any).indices) {
        indicesMetadata[indexName] = {
          state: 'open',
          settings: {
            index: {
              creation_date: index.creationDate || Date.now(),
              number_of_shards: '5',
              number_of_replicas: '1',
              uuid: index.uuid || `${indexName}-uuid`,
              version: {
                created: '8000099',
              },
            },
          },
          mappings: index.mapping || {},
          aliases: index.aliases ? Object.fromEntries(index.aliases) : {},
        };
      }

      return {
        cluster_name: (this as any).clusterName || 'mock-cluster',
        cluster_uuid: (this as any).clusterUuid || 'mock-cluster-uuid',
        version: 1,
        state_uuid: 'mock-state-uuid',
        master_node: 'mock-node-1',
        blocks: {},
        nodes: {
          'mock-node-1': {
            name: 'mock-node-1',
            ephemeral_id: 'mock-ephemeral-id',
            transport_address: '127.0.0.1:9300',
            attributes: {
              'ml.machine_memory': '17179869184',
              'ml.max_open_jobs': '20',
              'xpack.installed': 'true',
            },
            roles: ['master', 'data', 'ingest', 'ml', 'remote_cluster_client'],
          },
        },
        metadata: {
          cluster_uuid: (this as any).clusterUuid || 'mock-cluster-uuid',
          templates: {},
          indices: indicesMetadata,
        },
        routing_table: {
          indices: {},
        },
        routing_nodes: {
          nodes: {
            'mock-node-1': [],
          },
        },
      };
    }

    // ==================== 节点信息 ====================

    /**
     * 获取节点信息
     * 
     * @param nodeId 节点ID（可选，不指定则返回所有节点）
     * @param metric 指标（可选）
     * @returns 节点信息
     */
    nodesInfo(
      nodeId?: string,
      metric?: string[],
    ): {
      _nodes: {
        total: number;
        successful: number;
        failed: number;
      };
      cluster_name: string;
      nodes: Record<string, any>;
    } {
      const node = {
        name: 'mock-node-1',
        transport_address: '127.0.0.1:9300',
        host: '127.0.0.1',
        ip: '127.0.0.1',
        version: '8.0.0',
        build_flavor: 'default',
        build_type: 'tar',
        build_hash: 'mock-build-hash',
        build_date: '2023-01-01T00:00:00.000Z',
        build_snapshot: false,
        minimum_wire_compatibility_version: '7.17.0',
        minimum_index_compatibility_version: '7.0.0',
        roles: ['master', 'data', 'ingest', 'ml', 'remote_cluster_client'],
        attributes: {
          'ml.machine_memory': '17179869184',
          'ml.max_open_jobs': '20',
          'xpack.installed': 'true',
        },
        settings: {
          cluster: {
            name: (this as any).clusterName || 'mock-cluster',
          },
          node: {
            name: 'mock-node-1',
          },
          path: {
            home: '/usr/share/elasticsearch',
          },
        },
        os: {
          name: 'Linux',
          arch: 'amd64',
          version: '5.15.0',
          available_processors: 8,
          allocated_processors: 8,
        },
        process: {
          id: 12345,
          mlockall: false,
        },
        jvm: {
          pid: 12345,
          version: '17.0.1',
          vm_name: 'OpenJDK 64-Bit Server VM',
          vm_version: '17.0.1',
          vm_vendor: 'Eclipse Adoptium',
          start_time_in_millis: Date.now() - 3600000,
          mem: {
            heap_init_in_bytes: 1073741824,
            heap_max_in_bytes: 1073741824,
            non_heap_init_in_bytes: 7667712,
            non_heap_max_in_bytes: 0,
          },
        },
        thread_pool: {
          write: {
            type: 'fixed',
            size: 8,
            queue_size: 10000,
          },
          search: {
            type: 'fixed',
            size: 13,
            queue_size: 1000,
          },
          get: {
            type: 'fixed',
            size: 8,
            queue_size: 1000,
          },
        },
        transport: {
          bound_address: ['0.0.0.0:9300'],
          publish_address: '127.0.0.1:9300',
        },
        http: {
          bound_address: ['0.0.0.0:9200'],
          publish_address: '127.0.0.1:9200',
        },
      };

      const nodes: Record<string, any> = {};
      if (nodeId && nodeId !== '_all') {
        if (nodeId === 'mock-node-1' || nodeId === '_local') {
          nodes['mock-node-1'] = node;
        }
      } else {
        nodes['mock-node-1'] = node;
      }

      return {
        _nodes: {
          total: Object.keys(nodes).length,
          successful: Object.keys(nodes).length,
          failed: 0,
        },
        cluster_name: (this as any).clusterName || 'mock-cluster',
        nodes,
      };
    }

    /**
     * 获取节点统计信息
     * 
     * @param nodeId 节点ID（可选）
     * @param metric 指标（可选）
     * @returns 节点统计信息
     */
    nodesStats(
      nodeId?: string,
      metric?: string[],
    ): {
      _nodes: {
        total: number;
        successful: number;
        failed: number;
      };
      cluster_name: string;
      nodes: Record<string, any>;
    } {
      const nodeStats = {
        timestamp: Date.now(),
        name: 'mock-node-1',
        transport_address: '127.0.0.1:9300',
        host: '127.0.0.1',
        ip: '127.0.0.1:9200',
        roles: ['master', 'data', 'ingest', 'ml', 'remote_cluster_client'],
        indices: {
          docs: {
            count: this.getTotalDocumentCount(),
            deleted: 0,
          },
          store: {
            size_in_bytes: this.getTotalDocumentCount() * 1024,
          },
          indexing: {
            index_total: 0,
            index_time_in_millis: 0,
            index_current: 0,
            delete_total: 0,
            delete_time_in_millis: 0,
            delete_current: 0,
          },
          search: {
            query_total: 0,
            query_time_in_millis: 0,
            query_current: 0,
            fetch_total: 0,
            fetch_time_in_millis: 0,
            fetch_current: 0,
          },
        },
        os: {
          timestamp: Date.now(),
          cpu: {
            percent: 10,
            load_average: {
              '1m': 1.5,
              '5m': 1.2,
              '15m': 1.0,
            },
          },
          mem: {
            total_in_bytes: 17179869184,
            free_in_bytes: 8589934592,
            used_in_bytes: 8589934592,
            free_percent: 50,
            used_percent: 50,
          },
          swap: {
            total_in_bytes: 0,
            free_in_bytes: 0,
            used_in_bytes: 0,
          },
        },
        process: {
          timestamp: Date.now(),
          open_file_descriptors: 1024,
          max_file_descriptors: 65535,
          cpu: {
            percent: 5,
            total_in_millis: 3600000,
          },
          mem: {
            total_virtual_in_bytes: 2147483648,
          },
        },
        jvm: {
          timestamp: Date.now(),
          uptime_in_millis: 3600000,
          mem: {
            heap_used_in_bytes: 536870912,
            heap_used_percent: 50,
            heap_committed_in_bytes: 1073741824,
            heap_max_in_bytes: 1073741824,
            non_heap_used_in_bytes: 134217728,
            non_heap_committed_in_bytes: 134217728,
            pools: {
              young: {
                used_in_bytes: 268435456,
                max_in_bytes: 268435456,
                peak_used_in_bytes: 268435456,
                peak_max_in_bytes: 268435456,
              },
              old: {
                used_in_bytes: 268435456,
                max_in_bytes: 805306368,
                peak_used_in_bytes: 268435456,
                peak_max_in_bytes: 805306368,
              },
            },
          },
          gc: {
            collectors: {
              young: {
                collection_count: 100,
                collection_time_in_millis: 5000,
              },
              old: {
                collection_count: 10,
                collection_time_in_millis: 1000,
              },
            },
          },
          threads: {
            count: 100,
            peak_count: 150,
          },
        },
        thread_pool: {
          write: {
            threads: 8,
            queue: 0,
            active: 0,
            rejected: 0,
            largest: 8,
            completed: 0,
          },
          search: {
            threads: 13,
            queue: 0,
            active: 0,
            rejected: 0,
            largest: 13,
            completed: 0,
          },
        },
        fs: {
          timestamp: Date.now(),
          total: {
            total_in_bytes: 536870912000,
            free_in_bytes: 268435456000,
            available_in_bytes: 268435456000,
          },
          io_stats: {
            devices: [],
            total: {
              operations: 0,
              read_operations: 0,
              write_operations: 0,
              read_kilobytes: 0,
              write_kilobytes: 0,
            },
          },
        },
      };

      const nodes: Record<string, any> = {};
      if (nodeId && nodeId !== '_all') {
        if (nodeId === 'mock-node-1' || nodeId === '_local') {
          nodes['mock-node-1'] = nodeStats;
        }
      } else {
        nodes['mock-node-1'] = nodeStats;
      }

      return {
        _nodes: {
          total: Object.keys(nodes).length,
          successful: Object.keys(nodes).length,
          failed: 0,
        },
        cluster_name: (this as any).clusterName || 'mock-cluster',
        nodes,
      };
    }

    // ==================== 索引统计 ====================

    /**
     * 获取索引统计信息
     * 
     * @param indexName 索引名（可选，不指定则返回所有索引的统计）
     * @returns 索引统计信息
     */
    getIndicesStats(indexName?: string): {
      _shards: {
        total: number;
        successful: number;
        failed: number;
      };
      _all: {
        primaries: any;
        total: any;
      };
      indices: Record<string, any>;
    } {
      const indices: Record<string, any> = {};
      let totalDocs = 0;
      let totalSize = 0;

      const indexNames = indexName
        ? [indexName]
        : Array.from((this as any).indices.keys()) as string[];

      for (const name of indexNames) {
        const index = (this as any).indices.get(name);
        if (!index) continue;

        const docCount = index.documents ? index.documents.size : 0;
        const sizeInBytes = docCount * 1024; // 假设每个文档1KB
        totalDocs += docCount;
        totalSize += sizeInBytes;

        indices[name] = {
          primaries: {
            docs: {
              count: docCount,
              deleted: 0,
            },
            store: {
              size_in_bytes: sizeInBytes,
            },
            indexing: {
              index_total: 0,
              index_time_in_millis: 0,
              index_current: 0,
              delete_total: 0,
              delete_time_in_millis: 0,
              delete_current: 0,
            },
            search: {
              query_total: 0,
              query_time_in_millis: 0,
              query_current: 0,
              fetch_total: 0,
              fetch_time_in_millis: 0,
              fetch_current: 0,
            },
          },
          total: {
            docs: {
              count: docCount,
              deleted: 0,
            },
            store: {
              size_in_bytes: sizeInBytes,
            },
            indexing: {
              index_total: 0,
              index_time_in_millis: 0,
              index_current: 0,
              delete_total: 0,
              delete_time_in_millis: 0,
              delete_current: 0,
            },
            search: {
              query_total: 0,
              query_time_in_millis: 0,
              query_current: 0,
              fetch_total: 0,
              fetch_time_in_millis: 0,
              fetch_current: 0,
            },
          },
        };
      }

      return {
        _shards: {
          total: indexNames.length * 5,
          successful: indexNames.length * 5,
          failed: 0,
        },
        _all: {
          primaries: {
            docs: {
              count: totalDocs,
              deleted: 0,
            },
            store: {
              size_in_bytes: totalSize,
            },
          },
          total: {
            docs: {
              count: totalDocs,
              deleted: 0,
            },
            store: {
              size_in_bytes: totalSize,
            },
          },
        },
        indices,
      };
    }

    // ==================== 分片信息 ====================

    /**
     * 获取分片信息
     * 
     * @param indexName 索引名（可选）
     * @returns 分片信息
     */
    catShards(indexName?: string): Array<{
      index: string;
      shard: string;
      prirep: 'p' | 'r';
      state: string;
      docs: number;
      store: string;
      ip: string;
      node: string;
    }> {
      const shards: Array<{
        index: string;
        shard: string;
        prirep: 'p' | 'r';
        state: string;
        docs: number;
        store: string;
        ip: string;
        node: string;
      }> = [];

      const indexNames = indexName
        ? [indexName]
        : Array.from((this as any).indices.keys()) as string[];

      for (const name of indexNames) {
        const index = (this as any).indices.get(name);
        if (!index) continue;

        const docCount = index.documents ? index.documents.size : 0;
        const docsPerShard = Math.ceil(docCount / 5);
        const sizePerShard = Math.ceil((docCount * 1024) / 5);

        for (let i = 0; i < 5; i++) {
          shards.push({
            index: name,
            shard: String(i),
            prirep: 'p',
            state: 'STARTED',
            docs: i === 4 ? docCount - docsPerShard * 4 : docsPerShard,
            store: `${(sizePerShard / 1024).toFixed(1)}kb`,
            ip: '127.0.0.1',
            node: 'mock-node-1',
          });
        }
      }

      return shards;
    }

    /**
     * 获取索引列表（cat indices）
     * 
     * @param indexName 索引名（可选，支持通配符）
     * @returns 索引列表
     */
    catIndices(indexName?: string): Array<{
      health: 'green' | 'yellow' | 'red';
      status: 'open' | 'close';
      index: string;
      uuid: string;
      pri: string;
      rep: string;
      'docs.count': string;
      'docs.deleted': string;
      'store.size': string;
      'pri.store.size': string;
    }> {
      const indices: Array<{
        health: 'green' | 'yellow' | 'red';
        status: 'open' | 'close';
        index: string;
        uuid: string;
        pri: string;
        rep: string;
        'docs.count': string;
        'docs.deleted': string;
        'store.size': string;
        'pri.store.size': string;
      }> = [];

      for (const [name, index] of (this as any).indices) {
        if (indexName && !name.includes(indexName.replace(/\*/g, ''))) continue;

        const docCount = index.documents ? index.documents.size : 0;
        const sizeInBytes = docCount * 1024;

        indices.push({
          health: 'green',
          status: index.status || 'open',
          index: name,
          uuid: index.uuid || `${name}-uuid`,
          pri: '5',
          rep: '1',
          'docs.count': String(docCount),
          'docs.deleted': '0',
          'store.size': `${(sizeInBytes / 1024).toFixed(1)}kb`,
          'pri.store.size': `${(sizeInBytes / 1024).toFixed(1)}kb`,
        });
      }

      return indices;
    }

    // ==================== 工具方法 ====================

    /**
     * 获取总文档数
     * 
     * @returns 总文档数
     */
    protected getTotalDocumentCount(): number {
      let total = 0;
      for (const index of (this as any).indices.values()) {
        if (index.documents) {
          total += index.documents.size;
        }
      }
      return total;
    }
  };
}
