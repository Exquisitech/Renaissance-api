import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
}

export interface CacheStats {
  key: string;
  hits: number;
  size: number;
  ttl: number;
}

/**
 * Redis caching service with advanced features
 */
@Injectable()
export class CacheService implements OnModuleInit {
  private readonly logger = new Logger(CacheService.name);
  private hitCount = 0;
  private missCount = 0;
  private readonly MAX_CACHE_ENTRIES = 1000;

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  onModuleInit() {
    this.logger.log('CacheService initialized');
    this.startMonitoring();
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.cacheManager.get<T>(key);

      if (value !== undefined && value !== null) {
        this.hitCount++;
        this.logger.debug(`Cache HIT: ${key}`);
        return value;
      } else {
        this.missCount++;
        this.logger.debug(`Cache MISS: ${key}`);
        return null;
      }
    } catch (error) {
      this.logger.error(`Cache GET error for ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttl);
      this.logger.debug(`Cache SET: ${key}`);
    } catch (error) {
      this.logger.error(`Cache SET error for ${key}:`, error);
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      this.logger.debug(`Cache DEL: ${key}`);
    } catch (error) {
      this.logger.error(`Cache DEL error for ${key}:`, error);
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const value = await this.cacheManager.get(key);
      return value !== undefined && value !== null;
    } catch (error) {
      this.logger.error(`Cache EXISTS error for ${key}:`, error);
      return false;
    }
  }

  /**
   * Get or set with fallback function
   */
  async getOrSet<T>(
    key: string,
    fallback: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    const freshValue = await fallback();
    await this.set(key, freshValue, ttl);

    return freshValue;
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    try {
      // Note: This requires Redis-specific implementation
      // For now, we'll use a simplified approach
      const keys = await this.getKeysByPattern(pattern);

      for (const key of keys) {
        await this.del(key);
      }

      this.logger.log(
        `Invalidated ${keys.length} keys matching pattern: ${pattern}`,
      );
      return keys.length;
    } catch (error) {
      this.logger.error(
        `Cache invalidation error for pattern ${pattern}:`,
        error,
      );
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    hitRate: number;
    totalHits: number;
    totalMisses: number;
    estimatedSize: number;
  }> {
    const total = this.hitCount + this.missCount;
    const hitRate = total > 0 ? (this.hitCount / total) * 100 : 0;

    return {
      hitRate,
      totalHits: this.hitCount,
      totalMisses: this.missCount,
      estimatedSize: await this.estimateCacheSize(),
    };
  }

  /**
   * Clear entire cache
   */
  async clear(): Promise<void> {
    try {
      const wasCleared = await this.clearCacheBackend();

      if (!wasCleared) {
        this.logger.warn(
          'Cache clear skipped: active cache backend does not expose reset() or clear().',
        );
        return;
      }

      this.logger.log('Cache cleared');
    } catch (error) {
      this.logger.error('Cache clear error:', error);
    }
  }

  /**
   * Clears cache across different cache-manager backend shapes.
   * Supports top-level cache manager methods, nested store methods,
   * and multi-store backends.
   */
  private async clearCacheBackend(): Promise<boolean> {
    const cache = this.cacheManager as {
      store?: unknown;
      stores?: unknown[];
    };

    const targets: unknown[] = [cache, cache.store];

    if (Array.isArray(cache.stores)) {
      targets.push(...cache.stores);
    }

    let cleared = false;

    for (const target of targets) {
      if (!target) {
        continue;
      }

      const didClear = await this.callResetOrClear(target);
      cleared = cleared || didClear;
    }

    return cleared;
  }

  private async callResetOrClear(target: unknown): Promise<boolean> {
    const candidate = target as {
      reset?: () => Promise<void> | void;
      clear?: () => Promise<void> | void;
    };

    if (typeof candidate.reset === 'function') {
      await candidate.reset();
      return true;
    }

    if (typeof candidate.clear === 'function') {
      await candidate.clear();
      return true;
    }

    return false;
  }

  /**
   * Get keys by pattern (simplified)
   */
  private async getKeysByPattern(pattern: string): Promise<string[]> {
    // In production, use Redis SCAN command
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Estimate cache size
   */
  private async estimateCacheSize(): Promise<number> {
    // Placeholder - implement based on actual cache store
    return 0;
  }

  /**
   * Start cache monitoring
   */
  private startMonitoring(): void {
    setInterval(() => {
      const stats = this.getStatsSync();
      this.logger.debug(
        `Cache stats - Hit Rate: ${stats.hitRate.toFixed(2)}%, ` +
          `Hits: ${stats.totalHits}, Misses: ${stats.totalMisses}`,
      );
    }, 60000); // Log every minute
  }

  /**
   * Synchronous stats getter
   */
  private getStatsSync(): {
    hitRate: number;
    totalHits: number;
    totalMisses: number;
  } {
    const total = this.hitCount + this.missCount;
    const hitRate = total > 0 ? (this.hitCount / total) * 100 : 0;

    return {
      hitRate,
      totalHits: this.hitCount,
      totalMisses: this.missCount,
    };
  }
}
