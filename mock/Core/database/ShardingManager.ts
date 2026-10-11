/**
 * 分片管理器
 * 支持 HASH、RANGE、LIST、MODULO 四种分片策略
 */
import type {
  FlatItem,
  ShardingManagerConfig,
  ShardConfig,
  QueryCondition,
  UpdateData,
} from './types';
import type { MockTable } from './MockTable';

export class ShardingManager<T extends FlatItem> {
  private config: ShardingManagerConfig;
  private shards: Map<number, ShardConfig> = new Map();

  constructor(config: ShardingManagerConfig) {
    this.config = config;
    for (const shard of config.shards) {
      this.shards.set(shard.shardId, shard);
    }
  }

  /**
   * 根据分片键路由到分片
   */
  route(shardKeyValue: any): MockTable<T> {
    const shardId = this.calculateShardId(shardKeyValue);
    const shard = this.shards.get(shardId);
    if (!shard) {
      throw new Error(`未找到分片 ${shardId}`);
    }
    return shard.table as MockTable<T>;
  }

  /**
   * 计算分片 ID
   */
  private calculateShardId(shardKeyValue: any): number {
    const { strategy, shardCount } = this.config;

    switch (strategy) {
      case 'HASH': {
        const hash = this.simpleHash(String(shardKeyValue));
        return hash % (shardCount || this.shards.size);
      }

      case 'MODULO': {
        return Number(shardKeyValue) % (shardCount || this.shards.size);
      }

      case 'RANGE': {
        for (const [, shard] of this.shards) {
          if (shard.range) {
            const [start, end] = shard.range;
            if (Number(shardKeyValue) >= start && Number(shardKeyValue) < end) {
              return shard.shardId;
            }
          }
        }
        throw new Error(`分片键 ${shardKeyValue} 不在任何分片范围内`);
      }

      case 'LIST': {
        for (const [, shard] of this.shards) {
          if (shard.values && shard.values.includes(shardKeyValue)) {
            return shard.shardId;
          }
        }
        throw new Error(`分片键 ${shardKeyValue} 不在任何分片列表中`);
      }

      default:
        throw new Error(`不支持的分片策略: ${strategy}`);
    }
  }

  /**
   * 简单哈希函数
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为 32 位整数
    }
    return Math.abs(hash);
  }

  /**
   * 插入数据（自动路由）
   */
  create(data: Omit<T, 'id'> & { id?: number | string }): T {
    const shardKeyValue = (data as any)[this.config.shardKey];
    const table = this.route(shardKeyValue);
    return table.create(data);
  }

  /**
   * 根据 ID 查询（需要遍历所有分片）
   */
  findById(id: number | string): T | undefined {
    for (const [, shard] of this.shards) {
      const item = shard.table.findById(id);
      if (item) return item;
    }
    return undefined;
  }

  /**
   * 根据分片键查询
   */
  findByShardKey(shardKeyValue: any, condition?: QueryCondition<T>): T[] {
    const table = this.route(shardKeyValue);
    return condition ? table.find(condition) : table.findAll();
  }

  /**
   * 跨分片查询（合并所有分片结果）
   */
  findAll(condition?: QueryCondition<T>): T[] {
    let results: T[] = [];
    for (const [, shard] of this.shards) {
      const data = condition ? shard.table.find(condition) : shard.table.findAll();
      results = results.concat(data);
    }
    return results;
  }

  /**
   * 跨分片计数
   */
  count(condition?: QueryCondition<T>): number {
    let total = 0;
    for (const [, shard] of this.shards) {
      total += condition ? shard.table.count(condition) : shard.table.count();
    }
    return total;
  }

  /**
   * 根据分片键更新
   */
  updateByShardKey(shardKeyValue: any, condition: QueryCondition<T>, data: UpdateData<T>): number {
    const table = this.route(shardKeyValue);
    return table.update(condition, data);
  }

  /**
   * 根据分片键删除
   */
  deleteByShardKey(shardKeyValue: any, condition: QueryCondition<T>): number {
    const table = this.route(shardKeyValue);
    return table.delete(condition);
  }

  /**
   * 获取所有分片
   */
  getShards(): ShardConfig[] {
    return Array.from(this.shards.values());
  }

  /**
   * 获取分片统计
   */
  getShardStats(): Array<{ shardId: number; recordCount: number; tableName: string }> {
    const stats: Array<{ shardId: number; recordCount: number; tableName: string }> = [];
    for (const [, shard] of this.shards) {
      stats.push({
        shardId: shard.shardId,
        recordCount: shard.table.count(),
        tableName: shard.table.getTableName(),
      });
    }
    return stats;
  }

  /**
   * 重新分片（迁移数据）
   */
  reshard(newConfig: ShardingManagerConfig): { migrated: number; errors: string[] } {
    const result = { migrated: 0, errors: [] as string[] };
    
    // 获取所有旧数据
    const allData = this.findAll();
    
    // 更新配置
    this.config = newConfig;
    this.shards.clear();
    for (const shard of newConfig.shards) {
      this.shards.set(shard.shardId, shard);
      // 清空新分片
      shard.table.reset();
    }
    
    // 重新分配数据
    for (const item of allData) {
      try {
        const shardKeyValue = item[this.config.shardKey as keyof T];
        const table = this.route(shardKeyValue);
        table.importFromJSON(JSON.stringify([item]), { skipValidation: true });
        result.migrated++;
      } catch (error) {
        result.errors.push(`记录 ${item.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return result;
  }
}
