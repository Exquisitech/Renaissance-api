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

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

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
  async set<T>(
    key: string,
    value: T,
    ttl?: number,
  ): Promise<void> {
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

      this.logger.log(`Invalidated ${keys.length} keys matching pattern: ${pattern}`);
      return keys.length;
    } catch (error) {
      this.logger.error(`Cache invalidation error for pattern ${pattern}:`, error);
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
      await this.cacheManager.reset();
      this.logger.log('Cache cleared');
    } catch (error) {
      this.logger.error('Cache clear error:', error);
    }
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
