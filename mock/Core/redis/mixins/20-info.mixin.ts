/**
 * L6 监控运维 - 监控统计 Mixin
 * 包含：info/getMemoryUsage/getBigKeys/configGet/configSet/resetStats/getKeyspaceInfo/formatBytes
 */
import type { MixinConstructor } from './mixin.types';

export function WithInfo<T extends MixinConstructor>(Base: T) {
  return class InfoMixin extends Base {
    /**
     * 获取服务器信息（类似 Redis INFO 命令）
     */
    info(section?: string): Record<string, any> {
      const allInfo: Record<string, any> = {
        server: {
          redis_version: 'mock-redis-1.0.0',
          redis_mode: 'standalone',
          os: process.platform,
          arch_bits: 64,
          uptime_in_seconds: Math.floor((Date.now() - this.uptime) / 1000),
          uptime_in_days: Math.floor(
            (Date.now() - this.uptime) / (1000 * 60 * 60 * 24),
          ),
          tcp_port: 6379,
        },
        clients: {
          connected_clients: 1,
          total_connections_received: this.totalConnections,
          total_commands_processed: this.totalCommandsProcessed,
        },
        memory: {
          used_memory: this.getMemoryUsage(),
          used_memory_human: this.formatBytes(this.getMemoryUsage()),
          used_memory_peak: this.getMemoryUsage(),
          maxmemory: this.config.maxItems * 1024, // 估算
          maxmemory_policy: this.config.evictionPolicy,
        },
        persistence: {
          loading: false,
          rdb_changes_since_last_save: this.cache.size,
          rdb_last_save_time: this.lastSaveTime,
          rdb_last_bgsave_status: 'ok',
          aof_enabled: this.aofEnabled,
          aof_current_size: this.aofLog.length * 100,
          aof_rewrite_in_progress: 0,
        },
        stats: {
          total_connections_received: this.totalConnections,
          total_commands_processed: this.totalCommandsProcessed,
          instantaneous_ops_per_sec: 0,
          keyspace_hits: 0,
          keyspace_misses: 0,
          evicted_keys: 0,
        },
        replication: {
          role: this._role,
          connected_slaves: Array.from(this.slaves.values()).filter(
            (s) => s.status === 'online',
          ).length,
          master_repl_offset: this.replicationOffset,
        },
        keyspace: this.getKeyspaceInfo(),
      };

      if (section) {
        return allInfo[section] || {};
      }

      return allInfo;
    }

    /**
     * 获取内存使用量（估算）
     */
    getMemoryUsage(): number {
      let total = 0;

      for (const [key, item] of this.cache.entries()) {
        total += key.length * 2; // key（UTF-16）
        total += JSON.stringify(item.value).length; // value
        total += 64; // 元数据开销
      }

      return total;
    }

    /**
     * 获取键空间统计
     */
    getKeyspaceInfo(): Record<
      string,
      { keys: number; expires: number; avg_ttl: number }
    > {
      const result: Record<
        string,
        { keys: number; expires: number; avg_ttl: number }
      > = {};

      // 按前缀分组
      const prefixes = new Map<
        string,
        { keys: number; expires: number; totalTTL: number }
      >();

      for (const [key, item] of this.cache.entries()) {
        const prefix = key.includes(':') ? key.split(':')[0] : 'default';

        if (!prefixes.has(prefix)) {
          prefixes.set(prefix, { keys: 0, expires: 0, totalTTL: 0 });
        }

        const stat = prefixes.get(prefix)!;
        stat.keys++;

        if (item.expireAt !== null) {
          stat.expires++;
          stat.totalTTL += item.expireAt - Date.now();
        }
      }

      for (const [prefix, stat] of prefixes) {
        result[prefix] = {
          keys: stat.keys,
          expires: stat.expires,
          avg_ttl:
            stat.expires > 0 ? Math.floor(stat.totalTTL / stat.expires) : 0,
        };
      }

      return result;
    }

    /**
     * 获取大 Key 列表（Top N）
     */
    getBigKeys(
      topN: number = 10,
    ): Array<{ key: string; size: number; type: string }> {
      const keysWithSize: Array<{ key: string; size: number; type: string }> =
        [];

      for (const [key, item] of this.cache.entries()) {
        const size = JSON.stringify(item.value).length;
        keysWithSize.push({
          key,
          size,
          type: this.type(key),
        });
      }

      return keysWithSize.sort((a, b) => b.size - a.size).slice(0, topN);
    }

    /**
     * 格式化字节数
     */
    formatBytes(bytes: number): string {
      if (bytes < 1024) return `${bytes}B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}K`;
      if (bytes < 1024 * 1024 * 1024)
        return `${(bytes / (1024 * 1024)).toFixed(2)}M`;
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}G`;
    }

    /**
     * 获取配置
     */
    configGet(parameter: string): Record<string, string> {
      const configMap: Record<string, string> = {
        maxmemory: String(this.config.maxItems * 1024),
        'maxmemory-policy': this.config.evictionPolicy.toLowerCase(),
        save: this.rdbEnabled ? '900 1 300 10 60 10000' : '',
        appendonly: this.aofEnabled ? 'yes' : 'no',
        'notify-keyspace-events': this.keyspaceNotifications,
        'slowlog-log-slower-than': String(this.config.slowlogThreshold * 1000),
        'slowlog-max-len': String(this.config.slowlogMaxLen),
      };

      if (parameter === '*') {
        return configMap;
      }

      const result: Record<string, string> = {};
      for (const [key, value] of Object.entries(configMap)) {
        if (key.includes(parameter) || parameter === '*') {
          result[key] = value;
        }
      }
      return result;
    }

    /**
     * 设置配置
     */
    configSet(parameter: string, value: string): boolean {
      switch (parameter) {
        case 'maxmemory-policy':
          this.config.evictionPolicy = value.toUpperCase() as any;
          return true;
        case 'appendonly':
          this.aofEnabled = value === 'yes';
          return true;
        case 'notify-keyspace-events':
          this.keyspaceNotifications = value;
          return true;
        case 'slowlog-log-slower-than':
          this.config.slowlogThreshold = parseInt(value) / 1000;
          return true;
        case 'slowlog-max-len':
          this.config.slowlogMaxLen = parseInt(value);
          return true;
        default:
          return false;
      }
    }

    /**
     * 重置统计信息
     */
    resetStats(): void {
      this.totalCommandsProcessed = 0;
      this.totalConnections = 0;
      this.commandStats.clear();
      this.slowlogReset();
      this.debugLog('STATS RESET');
    }
  };
}
