/**
 * RustFS 集群类型定义
 * 
 * 包含集群状态、节点信息、复制状态等类型
 */

// ==================== 集群状态类型 ====================

/**
 * 集群健康状态
 */
export interface ClusterHealth {
  /** 集群名称 */
  cluster_name: string;
  /** 集群状态 */
  status: 'green' | 'yellow' | 'red';
  /** 是否超时 */
  timed_out: boolean;
  /** 节点数量 */
  number_of_nodes: number;
  /** 数据节点数量 */
  number_of_data_nodes: number;
  /** 活跃主分片数量 */
  active_primary_shards: number;
  /** 活跃分片数量 */
  active_shards: number;
  /** 重定位分片数量 */
  relocating_shards: number;
  /** 初始化分片数量 */
  initializing_shards: number;
  /** 未分配分片数量 */
  unassigned_shards: number;
  /** 延迟未分配分片数量 */
  delayed_unassigned_shards: number;
  /** 待处理任务数量 */
  number_of_pending_tasks: number;
  /** 任务队列最大等待时间（毫秒） */
  task_max_waiting_in_queue_millis: number;
  /** 活跃分片百分比 */
  active_shards_percent_as_number: number;
  /** 检查时间 */
  checked_at: string;
}

/**
 * 集群状态
 */
export interface ClusterState {
  /** 集群名称 */
  cluster_name: string;
  /** 集群UUID */
  cluster_uuid: string;
  /** 状态版本 */
  version: number;
  /** 状态版本哈希 */
  state_uuid: string;
  /** 主节点 */
  master_node: string;
  /** 节点列表 */
  nodes: Record<string, NodeInfo>;
  /** 元数据 */
  metadata: {
    /** 集群UUID */
    cluster_uuid: string;
    /** 模板 */
    templates: Record<string, any>;
    /** 索引元数据 */
    indices: Record<string, any>;
  };
  /** 路由表 */
  routing_table: {
    /** 索引路由 */
    indices: Record<string, any>;
  };
  /** 路由节点 */
  routing_nodes: {
    /** 节点数量 */
    nodes: Record<string, any>;
  };
  /** 生成时间 */
  generated_at: string;
}

/**
 * 集群统计
 */
export interface ClusterStats {
  /** 集群名称 */
  cluster_name: string;
  /** 集群UUID */
  cluster_uuid: string;
  /** 统计时间 */
  timestamp: number;
  /** 状态 */
  status: 'green' | 'yellow' | 'red';
  /** 索引统计 */
  indices: {
    /** 索引数量 */
    count: number;
    /** 分片统计 */
    shards: {
      /** 总分片数 */
      total: number;
      /** 主分片数 */
      primaries: number;
      /** 复制因子 */
      replication: number;
    };
    /** 文档统计 */
    docs: {
      /** 文档总数 */
      count: number;
      /** 已删除文档数 */
      deleted: number;
    };
    /** 存储统计 */
    store: {
      /** 总大小（字节） */
      size_in_bytes: number;
      /** 保留大小（字节） */
      reserved_in_bytes: number;
    };
  };
  /** 节点统计 */
  nodes: {
    /** 节点数量 */
    count: {
      total: number;
      master: number;
      data: number;
      ingest: number;
      coordinating: number;
    };
    /** CPU统计 */
    os: {
      cpu: {
        /** 核心数 */
        count: number;
        /** 使用率 */
        percent: number;
      };
      /** 内存 */
      mem: {
        /** 总内存（字节） */
        total_in_bytes: number;
        /** 已用内存（字节） */
        used_in_bytes: number;
        /** 空闲内存（字节） */
        free_in_bytes: number;
        /** 使用率 */
        used_percent: number;
      };
    };
    /** JVM统计 */
    jvm: {
      /** 最大堆内存（字节） */
      max_uptime_in_millis: number;
      /** 内存 */
      mem: {
        /** 堆最大内存（字节） */
        heap_max_in_bytes: number;
        /** 堆已用内存（字节） */
        heap_used_in_bytes: number;
      };
      /** 线程数 */
      threads: number;
    };
    /** 文件系统统计 */
    fs: {
      /** 总大小（字节） */
      total_in_bytes: number;
      /** 空闲大小（字节） */
      free_in_bytes: number;
      /** 可用大小（字节） */
      available_in_bytes: number;
    };
  };
}

// ==================== 节点类型 ====================

/**
 * 节点信息
 */
export interface NodeInfo {
  /** 节点ID */
  id: string;
  /** 节点名称 */
  name: string;
  /** 传输地址 */
  transport_address: string;
  /** 主机 */
  host: string;
  /** IP */
  ip: string;
  /** 版本 */
  version: string;
  /** 构建类型 */
  build_type: string;
  /** 构建哈希 */
  build_hash: string;
  /** 构建日期 */
  build_date: string;
  /** 是否快照构建 */
  build_snapshot: boolean;
  /** 最低兼容版本 */
  minimum_wire_compatibility_version: string;
  /** 最低索引兼容版本 */
  minimum_index_compatibility_version: string;
  /** 角色 */
  roles: NodeRole[];
  /** 属性 */
  attributes: Record<string, string>;
  /** 操作系统 */
  os?: {
    name: string;
    arch: string;
    version: string;
    available_processors: number;
    allocated_processors: number;
  };
  /** JVM */
  jvm?: {
    pid: number;
    version: string;
    vm_name: string;
    vm_version: string;
    vm_vendor: string;
    start_time_in_millis: number;
    mem: {
      heap_init_in_bytes: number;
      heap_max_in_bytes: number;
      non_heap_init_in_bytes: number;
      non_heap_max_in_bytes: number;
    };
  };
  /** 进程 */
  process?: {
    refresh_interval_in_millis: number;
    id: number;
    mlockall: boolean;
  };
  /** 传输 */
  transport?: {
    bound_address: string[];
    publish_address: string;
  };
  /** HTTP */
  http?: {
    bound_address: string[];
    publish_address: string;
    max_content_length_in_bytes: number;
  };
  /** 插件 */
  plugins?: NodePlugin[];
  /** 模块 */
  modules?: NodePlugin[];
  /** 加入时间 */
  joined_at?: string;
}

/**
 * 节点角色
 */
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
  | 'coordinating';

/**
 * 节点插件
 */
export interface NodePlugin {
  /** 插件名称 */
  name: string;
  /** 插件版本 */
  version: string;
  /** 插件描述 */
  description: string;
  /** 插件分类 */
  classname: string;
  /** 是否有扩展点 */
  has_native_controller: boolean;
  /** 是否为模块 */
  is_managed?: boolean;
}

/**
 * 节点统计
 */
export interface NodeStats {
  /** 节点ID */
  node_id: string;
  /** 节点名称 */
  name: string;
  /** 时间戳 */
  timestamp: number;
  /** 索引统计 */
  indices?: {
    docs: { count: number; deleted: number };
    store: { size_in_bytes: number };
    indexing: {
      index_total: number;
      index_time_in_millis: number;
      delete_total: number;
      delete_time_in_millis: number;
    };
    search: {
      query_total: number;
      query_time_in_millis: number;
      fetch_total: number;
      fetch_time_in_millis: number;
    };
  };
  /** 操作系统统计 */
  os?: {
    timestamp: number;
    cpu: {
      percent: number;
      load_average: { '1m': number; '5m': number; '15m': number };
    };
    mem: {
      total_in_bytes: number;
      free_in_bytes: number;
      used_in_bytes: number;
      free_percent: number;
      used_percent: number;
    };
    swap: {
      total_in_bytes: number;
      free_in_bytes: number;
      used_in_bytes: number;
    };
  };
  /** 进程统计 */
  process?: {
    timestamp: number;
    open_file_descriptors: number;
    max_file_descriptors: number;
    cpu: {
      percent: number;
      total_in_millis: number;
    };
    mem: {
      total_virtual_in_bytes: number;
    };
  };
  /** JVM统计 */
  jvm?: {
    timestamp: number;
    uptime_in_millis: number;
    mem: {
      heap_used_in_bytes: number;
      heap_used_percent: number;
      heap_committed_in_bytes: number;
      heap_max_in_bytes: number;
      non_heap_used_in_bytes: number;
      non_heap_committed_in_bytes: number;
    };
    threads: {
      count: number;
      peak_count: number;
    };
    gc: {
      collectors: Record<string, {
        collection_count: number;
        collection_time_in_millis: number;
      }>;
    };
  };
  /** 线程池统计 */
  thread_pool?: Record<string, {
    threads: number;
    queue: number;
    active: number;
    rejected: number;
    largest: number;
    completed: number;
  }>;
  /** 文件系统统计 */
  fs?: {
    timestamp: number;
    total: {
      total_in_bytes: number;
      free_in_bytes: number;
      available_in_bytes: number;
    };
    data: Array<{
      path: string;
      mount: string;
      type: string;
      total_in_bytes: number;
      free_in_bytes: number;
      available_in_bytes: number;
    }>;
  };
  /** 传输统计 */
  transport?: {
    rx_count: number;
    rx_size_in_bytes: number;
    tx_count: number;
    tx_size_in_bytes: number;
  };
  /** HTTP统计 */
  http?: {
    current_open: number;
    total_opened: number;
    clients: Array<{
      id: number;
      address: string;
      last_request_time_in_millis: number;
      request_count: number;
      request_size_in_bytes: number;
    }>;
  };
}

// ==================== 复制类型 ====================

/**
 * 复制规则
 */
export interface ReplicationRule {
  /** 规则ID */
  id: string;
  /** 规则状态 */
  status: 'Enabled' | 'Disabled';
  /** 优先级 */
  priority: number;
  /** 删除标记复制 */
  delete_marker_replication?: {
    status: 'Enabled' | 'Disabled';
  };
  /** 筛选条件 */
  filter?: {
    prefix?: string;
    tag?: { key: string; value: string };
    and?: {
      prefix?: string;
      tags?: { key: string; value: string }[];
    };
  };
  /** 目标配置 */
  destination: {
    /** 目标桶 */
    bucket: string;
    /** 目标区域 */
    region?: string;
    /** 目标存储类 */
    storage_class?: string;
    /** 目标账户 */
    account?: string;
    /** 访问角色 */
    role_arn?: string;
    /** 加密配置 */
    encryption_configuration?: {
      replica_kms_key_id: string;
    };
    /** 指标配置 */
    metrics?: {
      status: 'Enabled' | 'Disabled';
      event_threshold?: {
        minutes: number;
      };
    };
    /** 复制时间控制 */
    replication_time?: {
      status: 'Enabled' | 'Disabled';
      time?: {
        minutes: number;
      };
    };
  };
  /** 源选择 */
  source_selection_criteria?: {
    /** 复制时间阈值 */
    replication_time?: {
      threshold?: {
        minutes: number;
      };
    };
    /** S3单区域密钥 */
    sse_kms_encrypted_objects?: {
      status: 'Enabled' | 'Disabled';
    };
  };
  /** 创建时间 */
  created_at: string;
  /** 最后修改时间 */
  updated_at: string;
}

/**
 * 复制配置
 */
export interface ReplicationConfiguration {
  /** 复制角色 */
  role?: string;
  /** 复制规则列表 */
  rules: ReplicationRule[];
}

/**
 * 复制状态
 */
export type ReplicationStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REPLICA';

/**
 * 复制进度
 */
export interface ReplicationProgress {
  /** 桶名 */
  bucket: string;
  /** 对象键 */
  key: string;
  /** 版本ID */
  version_id?: string;
  /** 复制状态 */
  status: ReplicationStatus;
  /** 目标桶 */
  destination_bucket: string;
  /** 目标区域 */
  destination_region?: string;
  /** 复制规则ID */
  rule_id: string;
  /** 复制开始时间 */
  replication_start_time?: string;
  /** 复制完成时间 */
  replication_complete_time?: string;
  /** 复制耗时（毫秒） */
  replication_duration_ms?: number;
  /** 失败原因 */
  failure_reason?: string;
  /** 失败代码 */
  failure_code?: string;
  /** 最后检查时间 */
  last_checked_at: string;
}

/**
 * 复制指标
 */
export interface ReplicationMetrics {
  /** 桶名 */
  bucket: string;
  /** 规则ID */
  rule_id: string;
  /** 总复制数 */
  total_replications: number;
  /** 成功复制数 */
  successful_replications: number;
  /** 失败复制数 */
  failed_replications: number;
  /** 待处理复制数 */
  pending_replications: number;
  /** 复制成功率 */
  success_rate: number;
  /** 平均复制耗时（毫秒） */
  average_replication_time_ms: number;
  /** 最大复制耗时（毫秒） */
  max_replication_time_ms: number;
  /** 最小复制耗时（毫秒） */
  min_replication_time_ms: number;
  /** 最后复制时间 */
  last_replication_at?: string;
  /** 统计开始时间 */
  stats_since: string;
}

// ==================== 分片类型 ====================

/**
 * 分片信息
 */
export interface ShardInfo {
  /** 索引名 */
  index: string;
  /** 分片编号 */
  shard: number;
  /** 分片状态 */
  state: 'STARTED' | 'INITIALIZING' | 'RELOCATING' | 'UNASSIGNED';
  /** 是否主分片 */
  primary: boolean;
  /** 节点名 */
  node?: string;
  /** 文档数 */
  docs: number;
  /** 存储大小（字节） */
  store: number;
  /** IP地址 */
  ip?: string;
  /** 分片ID */
  id?: string;
  /** 恢复来源 */
  recovery_source?: {
    type: string;
    [key: string]: any;
  };
  /** 未分配原因 */
  unassigned_reason?: string;
  /** 未分配时间 */
  unassigned_at?: string;
  /** 分配时间 */
  assigned_at?: string;
  /** 启动时间 */
  started_at?: string;
}

/**
 * 分片统计
 */
export interface ShardStats {
  /** 总分片数 */
  total_shards: number;
  /** 主分片数 */
  primary_shards: number;
  /** 副本分片数 */
  replica_shards: number;
  /** 活跃分片数 */
  active_shards: number;
  /** 重定位分片数 */
  relocating_shards: number;
  /** 初始化分片数 */
  initializing_shards: number;
  /** 未分配分片数 */
  unassigned_shards: number;
  /** 分片列表 */
  shards: ShardInfo[];
}

// ==================== 性能指标类型 ====================

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  /** 时间戳 */
  timestamp: number;
  /** 集群名称 */
  cluster_name: string;
  /** 请求统计 */
  requests: {
    /** 总请求数 */
    total: number;
    /** 成功请求数 */
    success: number;
    /** 失败请求数 */
    failed: number;
    /** 成功率 */
    success_rate: number;
  };
  /** 延迟统计（毫秒） */
  latency: {
    /** 平均延迟 */
    average: number;
    /** 最小延迟 */
    minimum: number;
    /** 最大延迟 */
    maximum: number;
    /** P50延迟 */
    p50: number;
    /** P90延迟 */
    p90: number;
    /** P95延迟 */
    p95: number;
    /** P99延迟 */
    p99: number;
  };
  /** 吞吐量统计 */
  throughput: {
    /** 每秒请求数 */
    requests_per_second: number;
    /** 每秒上传字节数 */
    upload_bytes_per_second: number;
    /** 每秒下载字节数 */
    download_bytes_per_second: number;
  };
  /** 错误统计 */
  errors: {
    /** 4xx错误数 */
    client_errors: number;
    /** 5xx错误数 */
    server_errors: number;
    /** 限流错误数 */
    rate_limited: number;
    /** 超时错误数 */
    timeouts: number;
  };
  /** 资源使用统计 */
  resources: {
    /** CPU使用率 */
    cpu_usage: number;
    /** 内存使用率 */
    memory_usage: number;
    /** 磁盘使用率 */
    disk_usage: number;
    /** 网络使用率 */
    network_usage: number;
  };
}

/**
 * 系统信息
 */
export interface SystemInfo {
  /** 集群名称 */
  cluster_name: string;
  /** 集群UUID */
  cluster_uuid: string;
  /** 版本 */
  version: string;
  /** 构建类型 */
  build_type: string;
  /** 构建哈希 */
  build_hash: string;
  /** 构建日期 */
  build_date: string;
  /** 最低兼容版本 */
  minimum_wire_compatibility_version: string;
  /** 最低索引兼容版本 */
  minimum_index_compatibility_version: string;
  /** 节点数量 */
  number_of_nodes: number;
  /** 数据节点数量 */
  number_of_data_nodes: number;
  /** 活跃主分片数量 */
  active_primary_shards: number;
  /** 活跃分片数量 */
  active_shards: number;
  /** 总存储大小（字节） */
  total_storage_size: number;
  /** 已用存储大小（字节） */
  used_storage_size: number;
  /** 可用存储大小（字节） */
  available_storage_size: number;
  /** 存储使用率 */
  storage_usage_percentage: number;
  /** 总文档数 */
  total_documents: number;
  /** 总桶数 */
  total_buckets: number;
  /** 总对象数 */
  total_objects: number;
  /** 启动时间 */
  uptime: string;
  /** 启动时间戳 */
  started_at: string;
  /** 当前时间 */
  current_time: string;
}
