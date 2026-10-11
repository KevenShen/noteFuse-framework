/**
 * Elasticsearch 集群类型定义
 * 
 * 包含：集群状态、集群健康、节点信息、节点统计、分片信息等类型定义
 */

import type { IndexMetadata } from './base.types';

// ==================== 集群状态类型 ====================

/** 集群健康状态 */
export type ClusterHealthStatus = 'green' | 'yellow' | 'red';

/** 集群状态 */
export interface ClusterState {
  /** 集群名 */
  cluster_name: string;
  /** 集群UUID */
  cluster_uuid: string;
  /** 版本号 */
  version: number;
  /** 主节点ID */
  master_node: string;
  /** 节点信息 */
  nodes: Record<string, NodeInfo>;
  /** 元数据 */
  metadata: {
    /** 集群UUID */
    cluster_uuid: string;
    /** 索引元数据 */
    indices: Record<string, IndexMetadata>;
    /** 模板 */
    templates: Record<string, any>;
    /** 索引模板 */
    index_templates: Record<string, any>;
    /** 组件模板 */
    component_templates: Record<string, any>;
    /** 集群设置 */
    settings: Record<string, any>;
  };
  /** 路由表 */
  routing_table: {
    /** 索引路由 */
    indices: Record<string, IndexRoutingTable>;
  };
  /** 路由节点 */
  routing_nodes: {
    /** 节点 */
    nodes: Record<string, NodeShardAllocation>;
  };
  /** 集群块 */
  blocks: Record<string, any>;
  /** 自定义 */
  customs: Record<string, any>;
  /** 状态 */
  state?: ClusterHealthStatus;
}

// ==================== 集群健康类型 ====================

/** 集群健康 */
export interface ClusterHealth {
  /** 集群名 */
  cluster_name: string;
  /** 状态 */
  status: ClusterHealthStatus;
  /** 是否超时 */
  timed_out: boolean;
  /** 节点数 */
  number_of_nodes: number;
  /** 数据节点数 */
  number_of_data_nodes: number;
  /** 活跃主分片数 */
  active_primary_shards: number;
  /** 活跃分片数 */
  active_shards: number;
  /** 重定位分片数 */
  relocating_shards: number;
  /** 初始化分片数 */
  initializing_shards: number;
  /** 未分配分片数 */
  unassigned_shards: number;
  /** 延迟未分配分片数 */
  delayed_unassigned_shards: number;
  /** 待处理任务数 */
  number_of_pending_tasks: number;
  /** 任务队列最大等待时间 */
  number_of_in_flight_fetch: number;
  /** 任务最大等待时间 */
  task_max_waiting_in_queue_millis: number;
  /** 活跃分片百分比 */
  active_shards_percent_as_number: number;
  /** 索引健康 */
  indices?: Record<string, IndexHealth>;
}

/** 索引健康 */
export interface IndexHealth {
  /** 状态 */
  status: ClusterHealthStatus;
  /** 分片数 */
  number_of_shards: number;
  /** 副本数 */
  number_of_replicas: number;
  /** 活跃主分片数 */
  active_primary_shards: number;
  /** 活跃分片数 */
  active_shards: number;
  /** 重定位分片数 */
  relocating_shards: number;
  /** 初始化分片数 */
  initializing_shards: number;
  /** 未分配分片数 */
  unassigned_shards: number;
}

// ==================== 节点信息类型 ====================

/** 节点角色 */
export type NodeRole =
  | 'master'
  | 'data'
  | 'data_content'
  | 'data_hot'
  | 'data_warm'
  | 'data_cold'
  | 'data_frozen'
  | 'ingest'
  | 'ml'
  | 'remote_cluster_client'
  | 'transform'
  | 'voting_only'
  | 'coordinating_only';

/** 节点信息 */
export interface NodeInfo {
  /** 节点名 */
  name: string;
  /** 节点ID */
  id?: string;
  /** 传输地址 */
  transport_address: string;
  /** 主机名 */
  host: string;
  /** IP地址 */
  ip: string;
  /** 版本 */
  version: string;
  /** 构建类型 */
  build_type: string;
  /** 构建哈希 */
  build_hash: string;
  /** 构建日期 */
  build_date: string;
  /** 是否为快照构建 */
  build_snapshot: boolean;
  /** Lucene版本 */
  lucene_version: string;
  /** 最低兼容版本 */
  minimum_wire_compatibility_version: string;
  /** 最低索引兼容版本 */
  minimum_index_compatibility_version: string;
  /** 角色 */
  roles: NodeRole[];
  /** 属性 */
  attributes: Record<string, string>;
  /** 设置 */
  settings?: Record<string, any>;
  /** OS信息 */
  os?: NodeOSInfo;
  /** 进程信息 */
  process?: NodeProcessInfo;
  /** JVM信息 */
  jvm?: NodeJVMInfo;
  /** 线程池 */
  thread_pool?: Record<string, any>;
  /** 传输 */
  transport?: Record<string, any>;
  /** HTTP */
  http?: NodeHTTPInfo;
  /** 插件 */
  plugins?: Array<Record<string, any>>;
  /** 模块 */
  modules?: Array<Record<string, any>>;
  /**  ingest */
  ingest?: Record<string, any>;
  /** 聚合分析 */
  aggregations?: Record<string, any>;
}

/** 节点OS信息 */
export interface NodeOSInfo {
  /** 刷新时间 */
  refresh_interval_in_millis: number;
  /** 名称 */
  name: string;
  /** 架构 */
  arch: string;
  /** 版本 */
  version: string;
  /** 可用处理器数 */
  available_processors: number;
  /** 分配处理器数 */
  allocated_processors: number;
}

/** 节点进程信息 */
export interface NodeProcessInfo {
  /** 刷新时间 */
  refresh_interval_in_millis: number;
  /** 进程ID */
  id: number;
  /** 是否为mlockall */
  mlockall: boolean;
}

/** 节点JVM信息 */
export interface NodeJVMInfo {
  /** 刷新时间 */
  refresh_interval_in_millis: number;
  /** PID */
  pid: number;
  /** 版本 */
  version: string;
  /** VM名称 */
  vm_name: string;
  /** VM版本 */
  vm_version: string;
  /** VM供应商 */
  vm_vendor: string;
  /** 启动时间 */
  start_time_in_millis: number;
  /** 内存 */
  mem: {
    /** 堆初始化 */
    heap_init_in_bytes: number;
    /** 堆最大值 */
    heap_max_in_bytes: number;
    /** 非堆初始化 */
    non_heap_init_in_bytes: number;
    /** 非堆最大值 */
    non_heap_max_in_bytes: number;
    /** 直接内存最大值 */
    direct_max_in_bytes: number;
  };
  /** GC收集器 */
  gc_collectors: string[];
  /** 内存池 */
  memory_pools: string[];
  /** 使用压缩普通对象指针 */
  using_compressed_ordinary_object_pointers: boolean;
  /** 输入参数 */
  input_arguments: string[];
}

/** 节点HTTP信息 */
export interface NodeHTTPInfo {
  /** 绑定地址 */
  bound_address: string[];
  /** 发布地址 */
  publish_address: string;
  /** 最大内容长度 */
  max_content_length_in_bytes: number;
}

// ==================== 节点统计类型 ====================

/** 节点统计 */
export interface NodeStats {
  /** 节点名 */
  name: string;
  /** 节点ID */
  id?: string;
  /** 集群名 */
  cluster_name?: string;
  /** 时间戳 */
  timestamp: number;
  /** 传输地址 */
  transport_address: string;
  /** 主机 */
  host: string;
  /** IP */
  ip: string;
  /** 角色 */
  roles: NodeRole[];
  /** 属性 */
  attributes: Record<string, string>;
  /** 索引统计 */
  indices?: NodeIndicesStats;
  /** OS统计 */
  os?: NodeOSStats;
  /** 进程统计 */
  process?: NodeProcessStats;
  /** JVM统计 */
  jvm?: NodeJVMStats;
  /** 线程池统计 */
  thread_pool?: Record<string, ThreadPoolStats>;
  /** 文件系统统计 */
  fs?: NodeFSStats;
  /** 传输统计 */
  transport?: NodeTransportStats;
  /** HTTP统计 */
  http?: NodeHTTPStats;
  /** 断路器统计 */
  breakers?: Record<string, BreakerStats>;
  /** 脚本统计 */
  script?: NodeScriptStats;
  /** 发现统计 */
  discovery?: NodeDiscoveryStats;
  /** Ingest统计 */
  ingest?: NodeIngestStats;
  /** 适配器统计 */
  adaptive_selection?: Record<string, any>;
  /** 脚本缓存统计 */
  script_cache?: Array<Record<string, any>>;
}

/** 节点索引统计 */
export interface NodeIndicesStats {
  /** 文档统计 */
  docs: {
    count: number;
    deleted: number;
  };
  /** 存储统计 */
  store: {
    size_in_bytes: number;
    reserved_in_bytes: number;
    total_data_set_size_in_bytes: number;
  };
  /** 索引统计 */
  indexing: {
    index_total: number;
    index_time_in_millis: number;
    index_current: number;
    index_failed: number;
    delete_total: number;
    delete_time_in_millis: number;
    delete_current: number;
    noop_update_total: number;
    is_throttled: boolean;
    throttle_time_in_millis: number;
  };
  /** 获取统计 */
  get: {
    total: number;
    time_in_millis: number;
    exists_total: number;
    exists_time_in_millis: number;
    missing_total: number;
    missing_time_in_millis: number;
    current: number;
  };
  /** 搜索统计 */
  search: {
    open_contexts: number;
    query_total: number;
    query_time_in_millis: number;
    query_current: number;
    fetch_total: number;
    fetch_time_in_millis: number;
    fetch_current: number;
    scroll_total: number;
    scroll_time_in_millis: number;
    scroll_current: number;
    suggest_total: number;
    suggest_time_in_millis: number;
    suggest_current: number;
  };
  /** 合并统计 */
  merges: {
    current: number;
    current_docs: number;
    current_size_in_bytes: number;
    total: number;
    total_time_in_millis: number;
    total_docs: number;
    total_size_in_bytes: number;
    total_stopped_time_in_millis: number;
    total_throttled_time_in_millis: number;
    total_auto_throttle_in_bytes: number;
  };
  /** 刷新统计 */
  refresh: {
    total: number;
    total_time_in_millis: number;
    external_total: number;
    external_total_time_in_millis: number;
    listeners: number;
  };
  /** 冲刷统计 */
  flush: {
    total: number;
    periodic: number;
    total_time_in_millis: number;
  };
  /** 段统计 */
  segments: {
    count: number;
    memory_in_bytes: number;
    terms_memory_in_bytes: number;
    stored_fields_memory_in_bytes: number;
    term_vectors_memory_in_bytes: number;
    norms_memory_in_bytes: number;
    points_memory_in_bytes: number;
    doc_values_memory_in_bytes: number;
    index_writer_memory_in_bytes: number;
    version_map_memory_in_bytes: number;
    fixed_bit_set_memory_in_bytes: number;
    max_unsafe_auto_id_timestamp: number;
    file_sizes: Record<string, number>;
  };
  /** 转储统计 */
  translog: {
    operations: number;
    size_in_bytes: number;
    uncommitted_operations: number;
    uncommitted_size_in_bytes: number;
    earliest_last_modified_age_in_millis: number;
  };
  /** 恢复统计 */
  recovery: {
    current_as_source: number;
    current_as_target: number;
  };
  /** 缓存统计 */
  query_cache: {
    memory_size_in_bytes: number;
    total_count: number;
    hit_count: number;
    miss_count: number;
    cache_size: number;
    cache_count: number;
    evictions: number;
  };
  /** 字段数据统计 */
  fielddata: {
    memory_size_in_bytes: number;
    evictions: number;
  };
  /** 完成统计 */
  completion: {
    size_in_bytes: number;
  };
  /**  warmer统计 */
  warmer: {
    current: number;
    total: number;
    total_time_in_millis: number;
  };
}

/** 节点OS统计 */
export interface NodeOSStats {
  /** 时间戳 */
  timestamp: number;
  /** CPU */
  cpu: {
    percent: number;
    load_average: {
      '1m': number;
      '5m': number;
      '15m': number;
    };
  };
  /** 内存 */
  mem: {
    total_in_bytes: number;
    free_in_bytes: number;
    used_in_bytes: number;
    free_percent: number;
    used_percent: number;
    actual_free_in_bytes: number;
    actual_used_in_bytes: number;
  };
  /** 交换空间 */
  swap: {
    total_in_bytes: number;
    free_in_bytes: number;
    used_in_bytes: number;
  };
  /** cgroup */
  cgroup?: Record<string, any>;
}

/** 节点进程统计 */
export interface NodeProcessStats {
  /** 时间戳 */
  timestamp: number;
  /** 打开文件描述符 */
  open_file_descriptors: number;
  /** 最大文件描述符 */
  max_file_descriptors: number;
  /** CPU */
  cpu: {
    percent: number;
    total_in_millis: number;
  };
  /** 内存 */
  mem: {
    total_virtual_in_bytes: number;
  };
}

/** 节点JVM统计 */
export interface NodeJVMStats {
  /** 时间戳 */
  timestamp: number;
  /** 运行时间 */
  uptime_in_millis: number;
  /** 内存 */
  mem: {
    heap_used_in_bytes: number;
    heap_used_percent: number;
    heap_committed_in_bytes: number;
    heap_max_in_bytes: number;
    non_heap_used_in_bytes: number;
    non_heap_committed_in_bytes: number;
    pools: Record<string, {
      used_in_bytes: number;
      max_in_bytes: number;
      peak_used_in_bytes: number;
      peak_max_in_bytes: number;
    }>;
  };
  /** 线程 */
  threads: {
    count: number;
    peak_count: number;
  };
  /** GC */
  gc: {
    collectors: Record<string, {
      collection_count: number;
      collection_time_in_millis: number;
    }>;
  };
  /** 缓冲区池 */
  buffer_pools: Record<string, {
    count: number;
    used_in_bytes: number;
    total_capacity_in_bytes: number;
  }>;
  /** 类加载 */
  classes: {
    current_loaded_count: number;
    total_loaded_count: number;
    total_unloaded_count: number;
  };
}

/** 线程池统计 */
export interface ThreadPoolStats {
  threads: number;
  queue: number;
  active: number;
  rejected: number;
  largest: number;
  completed: number;
}

/** 节点文件系统统计 */
export interface NodeFSStats {
  /** 时间戳 */
  timestamp: number;
  /** 总计 */
  total: {
    total_in_bytes: number;
    free_in_bytes: number;
    available_in_bytes: number;
  };
  /** 数据路径 */
  data: Array<{
    path: string;
    mount: string;
    type: string;
    total_in_bytes: number;
    free_in_bytes: number;
    available_in_bytes: number;
  }>;
  /** IO统计 */
  io_stats?: {
    devices: Array<Record<string, any>>;
    total: Record<string, any>;
  };
}

/** 节点传输统计 */
export interface NodeTransportStats {
  /** 服务器打开次数 */
  server_open: number;
  /** 总接收次数 */
  rx_count: number;
  /** 总接收大小 */
  rx_size_in_bytes: number;
  /** 总发送次数 */
  tx_count: number;
  /** 总发送大小 */
  tx_size_in_bytes: number;
}

/** 节点HTTP统计 */
export interface NodeHTTPStats {
  /** 当前打开 */
  current_open: number;
  /** 总打开 */
  total_opened: number;
  /** 客户端 */
  clients?: Array<Record<string, any>>;
}

/** 断路器统计 */
export interface BreakerStats {
  /** 限制大小 */
  limit_size_in_bytes: number;
  /** 估计大小 */
  estimated_size_in_bytes: number;
  /** 开销 */
  overhead: number;
  /** 跳闸次数 */
  tripped: number;
}

/** 节点脚本统计 */
export interface NodeScriptStats {
  /** 编译次数 */
  compilations: number;
  /** 缓存驱逐次数 */
  cache_evictions: number;
  /** 编译限流次数 */
  compilation_limit_triggered: number;
  /** 上下文统计 */
  contexts?: Array<Record<string, any>>;
}

/** 节点发现统计 */
export interface NodeDiscoveryStats {
  /** 集群状态更新 */
  cluster_state_update: Record<string, any>;
  /** 序列化状态 */
  serialized_state: Record<string, any>;
  /** 发布 */
  published_states: Record<string, any>;
  /** 加入 */
  received_join_requests: number;
  /** 加入成功 */
  successful_join_requests: number;
  /** 加入失败 */
  failed_join_requests: number;
}

/** 节点Ingest统计 */
export interface NodeIngestStats {
  /** 总计数 */
  total: {
    count: number;
    time_in_millis: number;
    current: number;
    failed: number;
  };
  /** 管道 */
  pipelines: Record<string, {
    count: number;
    time_in_millis: number;
    current: number;
    failed: number;
    processors: Array<Record<string, any>>;
  }>;
}

// ==================== 分片信息类型 ====================

/** 分片状态 */
export type ShardState =
  | 'STARTED'
  | 'RELOCATING'
  | 'INITIALIZING'
  | 'UNASSIGNED'
  | 'CLOSED';

/** 分片信息 */
export interface ShardInfo {
  /** 索引名 */
  index: string;
  /** 分片号 */
  shard: number;
  /** 主分片 */
  primary: boolean;
  /** 状态 */
  state: ShardState;
  /** 节点 */
  node?: string;
  /** 恢复源 */
  recovery_source?: Record<string, any>;
  /** 目标节点 */
  target_node?: string;
  /** 重定位节点 */
  relocating_node?: string;
  /** 未分配原因 */
  unassigned_reason?: string;
  /** 未分配详细信息 */
  unassigned_details?: string;
  /** 未分配时间 */
  unassigned_at?: string;
  /** 分配时间 */
  assigned_at?: string;
  /** 启动时间 */
  started_at?: string;
  /** 停止时间 */
  stopped_at?: string;
  /** 完成时间 */
  completed_at?: string;
  /** 数据大小 */
  store?: {
    size_in_bytes: number;
    reserved_in_bytes: number;
    total_data_set_size_in_bytes: number;
  };
  /** 提交 */
  commit?: Record<string, any>;
  /** 合并 */
  merging?: Record<string, any>;
  /** 刷新 */
  refresh?: Record<string, any>;
  /** 冲刷 */
  flush?: Record<string, any>;
  /** 段 */
  segments?: Record<string, any>;
  /** 转储 */
  translog?: Record<string, any>;
  /** 恢复 */
  recovery?: Record<string, any>;
}

/** 索引路由表 */
export interface IndexRoutingTable {
  /** 分片 */
  shards: Record<string, ShardInfo[]>;
}

/** 节点分片分配 */
export interface NodeShardAllocation {
  /** 节点名 */
  name: string;
  /** 分片列表 */
  shards: ShardInfo[];
}

// ==================== 待处理任务类型 ====================

/** 待处理任务 */
export interface PendingTask {
  /** 插入顺序 */
  insert_order: number;
  /** 优先级 */
  priority: string;
  /** 源 */
  source: string;
  /** 执行时间 */
  time_in_queue_millis: number;
}

/** 待处理任务响应 */
export interface PendingTasksResponse {
  /** 任务列表 */
  tasks: PendingTask[];
}

// ==================== 索引设置类型 ====================

/** 索引设置（详细） */
export interface IndexSettingsDetailed {
  /** 索引设置 */
  settings: {
    /** 索引名 */
    'index.provided_name'?: string;
    /** 索引UUID */
    'index.uuid'?: string;
    /** 索引版本 */
    'index.version.created'?: string;
    /** 分片数 */
    'index.number_of_shards'?: string;
    /** 副本数 */
    'index.number_of_replicas'?: string;
    /** 刷新间隔 */
    'index.refresh_interval'?: string;
    /** 最大结果窗口 */
    'index.max_result_window'?: string;
    /** 最大内联结果窗口 */
    'index.max_inner_result_window'?: string;
    /** 最大字段长度 */
    'index.max_ngram_diff'?: string;
    /** 最大shingle差异 */
    'index.max_shingle_diff'?: string;
    /** 最大字段数 */
    'index.mapping.total_fields.limit'?: string;
    /** 最大嵌套字段数 */
    'index.mapping.nested_fields.limit'?: string;
    /** 最大嵌套对象数 */
    'index.mapping.nested_objects.limit'?: string;
    /** 最大深度 */
    'index.mapping.depth.limit'?: string;
    /** 最大字段名长度 */
    'index.mapping.field_name_length.limit'?: string;
    /** 分析器 */
    'index.analysis.analyzer.*'?: any;
    /** 其他设置 */
    [key: string]: any;
  };
  /** 默认设置 */
  defaults?: Record<string, any>;
}

// ==================== 索引统计类型 ====================

/** 索引统计 */
export interface IndexStats {
  /** 文档统计 */
  docs: {
    count: number;
    deleted: number;
  };
  /** 存储统计 */
  store: {
    size_in_bytes: number;
    reserved_in_bytes: number;
    total_data_set_size_in_bytes: number;
  };
  /** 索引统计 */
  indexing: {
    index_total: number;
    index_time_in_millis: number;
    index_current: number;
    index_failed: number;
    delete_total: number;
    delete_time_in_millis: number;
    delete_current: number;
    noop_update_total: number;
    is_throttled: boolean;
    throttle_time_in_millis: number;
  };
  /** 获取统计 */
  get: {
    total: number;
    time_in_millis: number;
    exists_total: number;
    exists_time_in_millis: number;
    missing_total: number;
    missing_time_in_millis: number;
    current: number;
  };
  /** 搜索统计 */
  search: {
    open_contexts: number;
    query_total: number;
    query_time_in_millis: number;
    query_current: number;
    fetch_total: number;
    fetch_time_in_millis: number;
    fetch_current: number;
    scroll_total: number;
    scroll_time_in_millis: number;
    scroll_current: number;
    suggest_total: number;
    suggest_time_in_millis: number;
    suggest_current: number;
  };
  /** 合并统计 */
  merges: {
    current: number;
    current_docs: number;
    current_size_in_bytes: number;
    total: number;
    total_time_in_millis: number;
    total_docs: number;
    total_size_in_bytes: number;
  };
  /** 刷新统计 */
  refresh: {
    total: number;
    total_time_in_millis: number;
    external_total: number;
    external_total_time_in_millis: number;
    listeners: number;
  };
  /** 冲刷统计 */
  flush: {
    total: number;
    periodic: number;
    total_time_in_millis: number;
  };
  /** 段统计 */
  segments: {
    count: number;
    memory_in_bytes: number;
  };
  /** 转储统计 */
  translog: {
    operations: number;
    size_in_bytes: number;
    uncommitted_operations: number;
    uncommitted_size_in_bytes: number;
  };
  /** 恢复统计 */
  recovery: {
    current_as_source: number;
    current_as_target: number;
  };
  /** 缓存统计 */
  query_cache: {
    memory_size_in_bytes: number;
    total_count: number;
    hit_count: number;
    miss_count: number;
    cache_size: number;
    cache_count: number;
    evictions: number;
  };
  /** 字段数据统计 */
  fielddata: {
    memory_size_in_bytes: number;
    evictions: number;
  };
  /** 完成统计 */
  completion: {
    size_in_bytes: number;
  };
  /** warmer统计 */
  warmer: {
    current: number;
    total: number;
    total_time_in_millis: number;
  };
}
