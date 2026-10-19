/**
 * L3 事务控制 - 事务 Mixin
 * 包含：multi/exec/discard/watch/unwatch/isInTransaction/executeCommand/queueCommand
 */
import type { MixinConstructor } from './mixin.types';

export function WithTransaction<T extends MixinConstructor>(Base: T) {
  return class TransactionMixin extends Base {
    /**
     * 开启事务
     * 之后的命令会被排队，直到 exec 执行
     */
    multi(): void {
      if (this.transactionCommands !== null) {
        throw new Error('MULTI calls can not be nested');
      }
      this.transactionCommands = [];
      this.debugLog('MULTI: transaction started');
    }

    /**
     * 执行事务
     * 返回所有命令的执行结果
     */
    exec(): any[] {
      if (this.transactionCommands === null) {
        throw new Error('EXEC without MULTI');
      }

      const commands = this.transactionCommands;
      this.transactionCommands = null;

      // 检查 watched keys 是否被修改
      if (this.watchedKeys.size > 0) {
        for (const [key, originalValue] of this.watchedKeys) {
          const currentValue = this.get(key);
          if (JSON.stringify(currentValue) !== JSON.stringify(originalValue)) {
            this.watchedKeys.clear();
            this.debugLog('EXEC: transaction aborted due to watched key change:', key);
            return []; // 事务被打断，返回空数组
          }
        }
        this.watchedKeys.clear();
      }

      // 执行所有命令
      const results: any[] = [];
      for (const cmd of commands) {
        try {
          const result = this.executeCommand(cmd.command, cmd.args);
          results.push(result);
        } catch (error) {
          results.push(error);
        }
      }

      this.debugLog('EXEC:', results.length, 'commands executed');
      return results;
    }

    /**
     * 取消事务
     */
    discard(): void {
      if (this.transactionCommands === null) {
        throw new Error('DISCARD without MULTI');
      }
      this.transactionCommands = null;
      this.watchedKeys.clear();
      this.debugLog('DISCARD: transaction cancelled');
    }

    /**
     * 监视 key（乐观锁）
     * 如果在 exec 之前 key 被修改，事务会被打断
     */
    watch(...keys: string[]): void {
      for (const key of keys) {
        // 保存当前值的快照
        const value = this.get(key);
        this.watchedKeys.set(key, value);
      }
      this.debugLog('WATCH:', keys);
    }

    /**
     * 取消监视所有 key
     */
    unwatch(): void {
      this.watchedKeys.clear();
      this.debugLog('UNWATCH');
    }

    /**
     * 内部：执行单个命令（用于事务和管道）
     */
    executeCommand(command: string, args: any[]): any {
      switch (command) {
        case 'set': return this.set(args[0], args[1], args[2]);
        case 'get': return this.get(args[0]);
        case 'del': return this.del(args[0]);
        case 'exists': return this.exists(args[0]);
        case 'incr': return this.incr(args[0]);
        case 'incrBy': return this.incrBy(args[0], args[1]);
        case 'decr': return this.decr(args[0]);
        case 'decrBy': return this.decrBy(args[0], args[1]);
        case 'expire': return this.expire(args[0], args[1]);
        case 'ttl': return this.ttl(args[0]);
        case 'hset':
          return typeof args[1] === 'object'
            ? this.hset(args[0], args[1])
            : this.hset(args[0], args[1], args[2]);
        case 'hget': return this.hget(args[0], args[1]);
        case 'hgetAll': return this.hgetAll(args[0]);
        case 'hdel': return this.hdel(args[0], args[1]);
        case 'lpush': return this.lpush(args[0], ...args.slice(1));
        case 'rpush': return this.rpush(args[0], ...args.slice(1));
        case 'lpop': return this.lpop(args[0]);
        case 'rpop': return this.rpop(args[0]);
        case 'lrange': return this.lrange(args[0], args[1], args[2]);
        case 'sadd': return this.sadd(args[0], ...args.slice(1));
        case 'srem': return this.srem(args[0], ...args.slice(1));
        case 'smembers': return this.smembers(args[0]);
        case 'zadd': return this.zadd(args[0], ...args.slice(1));
        case 'zrange': return this.zrange(args[0], args[1], args[2], args[3]);
        default:
          throw new Error(`Unknown command: ${command}`);
      }
    }

    /**
     * 排队命令（在事务模式下调用）
     */
    queueCommand(command: string, args: any[]): void {
      if (this.transactionCommands !== null) {
        this.transactionCommands.push({ command, args });
      }
    }

    /**
     * 检查是否在事务中
     */
    isInTransaction(): boolean {
      return this.transactionCommands !== null;
    }
  };
}
