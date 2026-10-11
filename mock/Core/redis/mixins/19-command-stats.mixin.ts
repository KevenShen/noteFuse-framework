/**
 * L6 监控运维 - 命令统计 Mixin
 * 包含：getCommandStats/resetCommandStats
 */
import type { MixinConstructor } from './mixin.types';

export function WithCommandStats<T extends MixinConstructor>(Base: T) {
  return class CommandStatsMixin extends Base {
    /**
     * 获取命令统计信息
     */
    getCommandStats(): Array<{ command: string; calls: number; totalTime: number; avgTime: number }> {
      const stats: Array<{ command: string; calls: number; totalTime: number; avgTime: number }> = [];
      
      for (const [command, stat] of this.commandStats.entries()) {
        stats.push({
          command,
          calls: stat.calls,
          totalTime: stat.totalTime,
          avgTime: stat.calls > 0 ? stat.totalTime / stat.calls : 0,
        });
      }
      
      return stats.sort((a, b) => b.calls - a.calls);
    }

    /**
     * 重置命令统计
     */
    resetCommandStats(): void {
      this.commandStats.clear();
      this.debugLog('COMMAND STATS RESET');
    }
  };
}
