import { Injectable, Logger } from '@nestjs/common';
import { RateLimitRedisService } from './rate-limit-redis.service';
import {
  GLOBAL_RATE_LIMIT_KEY,
  RateLimitResult,
  UserTier,
} from './rate.limit.types';
import { RateLimitConfigService } from './rate-limit-cofig.service';

export interface RateLimitCheckInput {
  /** Unique caller identifier — userId when authenticated, IP otherwise */
  identifier: string;
  /** HTTP route path, e.g. "/bets" */
  route: string;
  /** HTTP method, e.g. "POST" */
  method: string;
  /** Resolved tier of the caller */
  tier: UserTier;
}

export interface RateLimitOutcome {
  /** Whether the request should be admitted */
  allowed: boolean;
  /** Headers to attach to the response */
  headers: Record<string, string>;
  /** Set only when !allowed */
  blockedBy?: string;
  /** Full result details per checked endpoint */
  results: RateLimitResult[];
}

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(
    private readonly configSvc: RateLimitConfigService,
    private readonly redis: RateLimitRedisService,
  ) {}

  /**
   * Perform all applicable rate-limit checks for an incoming request.
   *
   * Order of checks:
   *   1. Exemption (webhooks, health, metrics) → always allowed
   *   2. Endpoint-specific limit (if `standaloneOnly`, skips global)
   *   3. Global limit (unless endpoint is standaloneOnly)
   */
  async check(input: RateLimitCheckInput): Promise<RateLimitOutcome> {
    const { identifier, route, method, tier } = input;

    // ── 1. Exemption ──────────────────────────────────────────────────────────
    if (this.configSvc.isExempt(route)) {
      return this.buildOutcome(true, [], undefined);
    }

    const results: RateLimitResult[] = [];
    let blockedBy: string | undefined;

    // ── 2. Endpoint-specific check ────────────────────────────────────────────
    const epCfg = this.configSvc.resolve(route, method);
    const tierLimit = epCfg.tiers[tier];

    const epResult = await this.redis.check(
      identifier,
      epCfg.key,
      tier,
      tierLimit,
      epCfg.algorithm,
    );
    results.push(epResult);

    if (!epResult.allowed) {
      blockedBy = epCfg.key;
    }

    // ── 3. Global check (only when endpoint is not standalone) ────────────────
    if (!epCfg.standaloneOnly && epCfg.key !== GLOBAL_RATE_LIMIT_KEY) {
      const globalCfg = this.configSvc.getByKey(GLOBAL_RATE_LIMIT_KEY)!;
      const globalTierLimit = globalCfg.tiers[tier];

      const globalResult = await this.redis.check(
        identifier,
        GLOBAL_RATE_LIMIT_KEY,
        tier,
        globalTierLimit,
        globalCfg.algorithm,
      );
      results.push(globalResult);

      if (!globalResult.allowed && !blockedBy) {
        blockedBy = GLOBAL_RATE_LIMIT_KEY;
      }
    }

    const allowed = blockedBy === undefined;
    return this.buildOutcome(allowed, results, blockedBy);
  }

  // ─── Header builder ───────────────────────────────────────────────────────────

  private buildOutcome(
    allowed: boolean,
    results: RateLimitResult[],
    blockedBy: string | undefined,
  ): RateLimitOutcome {
    const headers: Record<string, string> = {};

    if (results.length === 0) {
      // Exempt request — no rate-limit headers needed
      return { allowed: true, headers: {}, results: [] };
    }

    // Use the most restrictive result for the primary headers
    const primary = results.reduce((prev, cur) =>
      cur.remaining < prev.remaining ? cur : prev,
    );

    headers['X-RateLimit-Limit'] = String(primary.limit);
    headers['X-RateLimit-Remaining'] = String(primary.remaining);
    headers['X-RateLimit-Reset'] = String(primary.resetEpoch);
    headers['X-RateLimit-Policy'] =
      `${primary.limit};w=${primary.limit};comment="${primary.endpoint}"`;

    if (!allowed) {
      headers['Retry-After'] = String(primary.retryAfter);
      headers['X-RateLimit-Blocked-By'] = blockedBy ?? 'unknown';
    }

    // Per-endpoint detail headers (useful for debugging)
    for (const r of results) {
      const prefix = `X-RateLimit-${this.headerSafeKey(r.endpoint)}`;
      headers[`${prefix}-Limit`] = String(r.limit);
      headers[`${prefix}-Remaining`] = String(r.remaining);
      headers[`${prefix}-Reset`] = String(r.resetEpoch);
    }

    return { allowed, headers, blockedBy, results };
  }

  private headerSafeKey(key: string): string {
    // Convert to Title-Case-Dashed for header names
    return key.replace(/_/g, '-').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
