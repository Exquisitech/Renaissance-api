import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
  RateLimitResult,
  TierLimit,
  UserTier,
  WindowAlgorithm,
} from './rate.limit.types';

// ─── Lua scripts ──────────────────────────────────────────────────────────────

/**
 * Sliding-window rate limit using a sorted set.
 *
 * KEYS[1]  = rate-limit key
 * ARGV[1]  = current timestamp (ms)
 * ARGV[2]  = window size (ms)
 * ARGV[3]  = max requests in window
 * ARGV[4]  = TTL for the key (ms) — slightly larger than the window
 *
 * Returns: { count_after_increment, limit, window_start }
 */
const SLIDING_WINDOW_SCRIPT = `
local key        = KEYS[1]
local now        = tonumber(ARGV[1])
local window_ms  = tonumber(ARGV[2])
local limit      = tonumber(ARGV[3])
local ttl_ms     = tonumber(ARGV[4])
local window_start = now - window_ms

-- remove expired entries
redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

-- count current requests in window
local count = redis.call('ZCARD', key)

if count < limit then
  -- admit request — add with score = now (unique member = now+random suffix)
  redis.call('ZADD', key, now, now .. ':' .. math.random(1, 1000000))
  count = count + 1
end

redis.call('PEXPIRE', key, ttl_ms)
return { count, limit, window_start }
`;

/**
 * Fixed-window rate limit using a simple counter.
 *
 * KEYS[1]  = rate-limit key
 * ARGV[1]  = window size (seconds) — also the TTL
 * ARGV[2]  = max requests
 *
 * Returns: { new_count, limit, window_ttl_remaining }
 */
const FIXED_WINDOW_SCRIPT = `
local key    = KEYS[1]
local window = tonumber(ARGV[1])
local limit  = tonumber(ARGV[2])

local count = redis.call('INCR', key)
if count == 1 then
  redis.call('EXPIRE', key, window)
end

local ttl = redis.call('TTL', key)
return { count, limit, ttl }
`;

// ─── Analytics counters ───────────────────────────────────────────────────────

/**
 * Atomically increment hit / blocked counters used by the analytics endpoint.
 * KEYS[1] = hit counter key
 * KEYS[2] = blocked counter key
 * ARGV[1] = 1 if the request was blocked, 0 otherwise
 * ARGV[2] = TTL (seconds)
 */
const ANALYTICS_SCRIPT = `
redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
if tonumber(ARGV[1]) == 1 then
  redis.call('INCR', KEYS[2])
  redis.call('EXPIRE', KEYS[2], tonumber(ARGV[2]))
end
return 1
`;

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class RateLimitRedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RateLimitRedisService.name);
  private client!: Redis;

  private slidingWindowSha = '';
  private fixedWindowSha = '';
  private analyticsSha = '';

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>('redis.url', 'redis://localhost:6379');
    this.client = new Redis(url, { lazyConnect: true });

    await this.client.connect();

    // Pre-load Lua scripts so we use EVALSHA (avoids re-transmitting script each call)
    this.slidingWindowSha = (await this.client.script(
      'LOAD',
      SLIDING_WINDOW_SCRIPT,
    )) as string;
    this.fixedWindowSha = (await this.client.script(
      'LOAD',
      FIXED_WINDOW_SCRIPT,
    )) as string;
    this.analyticsSha = (await this.client.script(
      'LOAD',
      ANALYTICS_SCRIPT,
    )) as string;

    this.logger.log('RateLimitRedisService connected and Lua scripts loaded');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  // ─── Core check ─────────────────────────────────────────────────────────────

  async check(
    identifier: string,
    endpointKey: string,
    tier: UserTier,
    tierLimit: TierLimit,
    algorithm: WindowAlgorithm,
  ): Promise<RateLimitResult> {
    const key = this.buildKey(identifier, endpointKey, tier);
    const nowMs = Date.now();
    const windowMs = tierLimit.windowSecs * 1000;

    let count: number;
    let limit: number;
    let resetEpoch: number;

    if (algorithm === WindowAlgorithm.SLIDING) {
      const result = await this.evalSha<[number, number, number]>(
        this.slidingWindowSha,
        SLIDING_WINDOW_SCRIPT,
        1,
        key,
        String(nowMs),
        String(windowMs),
        String(tierLimit.limit),
        String(windowMs + 1000), // TTL slightly larger than window
      );
      [count, limit] = result;
      resetEpoch = Math.ceil((nowMs + windowMs) / 1000);
    } else {
      const result = await this.evalSha<[number, number, number]>(
        this.fixedWindowSha,
        FIXED_WINDOW_SCRIPT,
        1,
        key,
        String(tierLimit.windowSecs),
        String(tierLimit.limit),
      );
      const ttlRemaining = result[2];
      count = result[0];
      limit = result[1];
      resetEpoch = Math.ceil((nowMs + ttlRemaining * 1000) / 1000);
    }

    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);
    const retryAfter = allowed
      ? 0
      : Math.max(1, resetEpoch - Math.floor(nowMs / 1000));

    // Fire-and-forget analytics update
    this.recordAnalytics(endpointKey, tier, !allowed).catch(() => {
      /* non-critical */
    });

    return {
      allowed,
      limit,
      remaining,
      resetEpoch,
      retryAfter,
      tier,
      endpoint: endpointKey,
    };
  }

  // ─── Analytics helpers ───────────────────────────────────────────────────────

  async getAnalyticsCounters(
    endpointKey: string,
    tier: UserTier,
  ): Promise<{ total: number; blocked: number }> {
    const hitKey = this.analyticsHitKey(endpointKey, tier);
    const blockedKey = this.analyticsBlockedKey(endpointKey, tier);
    const [total, blocked] = await this.client.mget(hitKey, blockedKey);
    return {
      total: parseInt(total ?? '0', 10),
      blocked: parseInt(blocked ?? '0', 10),
    };
  }

  async getUniqueUserCount(
    endpointKey: string,
    tier: UserTier,
  ): Promise<number> {
    const pattern = `rl:${endpointKey}:${tier}:*`;
    const keys = await this.scanKeys(pattern);
    return keys.length;
  }

  // ─── Config persistence (admin API) ─────────────────────────────────────────

  async persistConfig(key: string, value: object): Promise<void> {
    await this.client.set(
      `rl:config:${key}`,
      JSON.stringify(value),
      'EX',
      86_400 * 7, // 7-day TTL; refreshed on each save
    );
  }

  async loadConfig<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(`rl:config:${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async listConfigKeys(): Promise<string[]> {
    return this.scanKeys('rl:config:*');
  }

  // ─── Internals ───────────────────────────────────────────────────────────────

  private buildKey(
    identifier: string,
    endpointKey: string,
    tier: UserTier,
  ): string {
    return `rl:${endpointKey}:${tier}:${identifier}`;
  }

  private analyticsHitKey(endpointKey: string, tier: UserTier): string {
    return `rl:analytics:hit:${endpointKey}:${tier}`;
  }

  private analyticsBlockedKey(endpointKey: string, tier: UserTier): string {
    return `rl:analytics:blocked:${endpointKey}:${tier}`;
  }

  private async recordAnalytics(
    endpointKey: string,
    tier: UserTier,
    blocked: boolean,
  ): Promise<void> {
    await this.evalSha(
      this.analyticsSha,
      ANALYTICS_SCRIPT,
      2,
      this.analyticsHitKey(endpointKey, tier),
      this.analyticsBlockedKey(endpointKey, tier),
      blocked ? '1' : '0',
      String(3_600), // 1-hour retention
    );
  }

  /**
   * evalSha with automatic fallback to EVAL if the script was evicted.
   * Redis can evict loaded scripts under memory pressure.
   */
  private async evalSha<T>(
    sha: string,
    script: string,
    numKeys: number,
    ...args: string[]
  ): Promise<T> {
    try {
      return await (this.client.evalsha(sha, numKeys, ...args) as Promise<T>);
    } catch (err: any) {
      if (err?.message?.includes('NOSCRIPT')) {
        return await (this.client.eval(script, numKeys, ...args) as Promise<T>);
      }
      throw err;
    }
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, batch] = await this.client.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        200,
      );
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');
    return keys;
  }
}
