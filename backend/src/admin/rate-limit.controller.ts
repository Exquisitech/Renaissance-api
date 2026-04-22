import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { RateLimitRedisService } from './rate-limit-redis.service';
import { RateLimitConfigService } from './rate-limit-cofig.service';
import {
  AdminConfigUpdateDto,
  EndpointRateLimitConfig,
  RateLimitAnalyticsSnapshot,
  UserTier,
} from './rate.limit.types';

// ─── Admin Config API ─────────────────────────────────────────────────────────

@Controller('admin/rate-limits')
// @UseGuards(AdminAuthGuard)   ← wire your own admin guard here
export class RateLimitAdminController {
  constructor(private readonly configSvc: RateLimitConfigService) {}

  /** List all endpoint rate-limit configs */
  @Get()
  listConfigs(): EndpointRateLimitConfig[] {
    return this.configSvc.getAll();
  }

  /** Retrieve a single endpoint config by key */
  @Get(':key')
  getConfig(@Param('key') key: string): EndpointRateLimitConfig {
    const cfg = this.configSvc.getByKey(key);
    if (!cfg) {
      throw new Error(`No rate-limit config found for key "${key}"`);
    }
    return cfg;
  }

  /**
   * Update tier limits or toggle an endpoint config.
   *
   * Example body:
   * {
   *   "key": "bets",
   *   "tiers": { "free": { "limit": 5, "windowSecs": 60 } },
   *   "enabled": true
   * }
   */
  @Patch()
  @HttpCode(HttpStatus.OK)
  async updateConfig(
    @Body() dto: AdminConfigUpdateDto,
  ): Promise<EndpointRateLimitConfig> {
    return this.configSvc.applyAdminUpdate(dto);
  }
}

// ─── Analytics Controller ─────────────────────────────────────────────────────

@Controller('admin/rate-limits/analytics')
// @UseGuards(AdminAuthGuard)
export class RateLimitAnalyticsController {
  constructor(
    private readonly configSvc: RateLimitConfigService,
    private readonly redis: RateLimitRedisService,
  ) {}

  /**
   * Return hit + blocked counters for every (endpoint × tier) combination.
   * The data covers a rolling 1-hour window as stored in Redis.
   */
  @Get()
  async getAnalytics(): Promise<RateLimitAnalyticsSnapshot[]> {
    const configs = this.configSvc.getAll();
    const tiers = Object.values(UserTier);
    const snapshots: RateLimitAnalyticsSnapshot[] = [];

    const nowSecs = Math.floor(Date.now() / 1000);
    const windowEnd = nowSecs;
    const windowStart = nowSecs - 3_600; // 1-hour retention matches Redis TTL

    await Promise.all(
      configs.flatMap((cfg) =>
        tiers.map(async (tier) => {
          const { total, blocked } = await this.redis.getAnalyticsCounters(
            cfg.key,
            tier,
          );
          const uniqueUsers = await this.redis.getUniqueUserCount(
            cfg.key,
            tier,
          );

          snapshots.push({
            endpoint: cfg.key,
            tier,
            windowStart,
            windowEnd,
            totalRequests: total,
            blockedRequests: blocked,
            uniqueUsers,
            p95Remaining: this.estimateP95Remaining(
              cfg.tiers[tier].limit,
              total,
              blocked,
            ),
          });
        }),
      ),
    );

    return snapshots.sort(
      (a, b) =>
        a.endpoint.localeCompare(b.endpoint) || a.tier.localeCompare(b.tier),
    );
  }

  /** Analytics for a single endpoint */
  @Get(':key')
  async getEndpointAnalytics(
    @Param('key') key: string,
  ): Promise<RateLimitAnalyticsSnapshot[]> {
    const cfg = this.configSvc.getByKey(key);
    if (!cfg) throw new Error(`No rate-limit config found for key "${key}"`);

    const tiers = Object.values(UserTier);
    const nowSecs = Math.floor(Date.now() / 1000);

    return Promise.all(
      tiers.map(async (tier) => {
        const { total, blocked } = await this.redis.getAnalyticsCounters(
          key,
          tier,
        );
        const uniqueUsers = await this.redis.getUniqueUserCount(key, tier);
        return {
          endpoint: key,
          tier,
          windowStart: nowSecs - 3_600,
          windowEnd: nowSecs,
          totalRequests: total,
          blockedRequests: blocked,
          uniqueUsers,
          p95Remaining: this.estimateP95Remaining(
            cfg.tiers[tier].limit,
            total,
            blocked,
          ),
        };
      }),
    );
  }

  /**
   * Naive p95 estimate: assumes a uniform distribution of requests across
   * unique users within the window.  Replace with a histogram for precision.
   */
  private estimateP95Remaining(
    limit: number,
    total: number,
    uniqueUsers: number,
  ): number {
    if (uniqueUsers === 0) return limit;
    const avgUsed = total / uniqueUsers;
    const p95Used = Math.ceil(avgUsed * 1.5); // rough 95th-percentile heuristic
    return Math.max(0, limit - p95Used);
  }
}
