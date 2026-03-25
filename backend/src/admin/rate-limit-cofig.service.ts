import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { RateLimitRedisService } from './rate-limit-redis.service';
import {
  AdminConfigUpdateDto,
  DEFAULT_TIER_LIMITS,
  EndpointRateLimitConfig,
  GLOBAL_RATE_LIMIT_KEY,
  TierLimitMap,
  UserTier,
  WindowAlgorithm,
} from './rate.limit.types';

// ─── Built-in endpoint definitions ───────────────────────────────────────────

const BUILT_IN_ENDPOINTS: EndpointRateLimitConfig[] = [
  {
    key: GLOBAL_RATE_LIMIT_KEY,
    algorithm: WindowAlgorithm.SLIDING,
    routes: ['*'],
    methods: [],
    standaloneOnly: false,
    enabled: true,
    description: 'Global fallback applied to every route',
    tiers: { ...DEFAULT_TIER_LIMITS },
  },
  {
    key: 'auth',
    algorithm: WindowAlgorithm.SLIDING,
    routes: ['/auth/login', '/auth/register', '/auth/refresh'],
    methods: ['POST'],
    standaloneOnly: true,
    enabled: true,
    description:
      'Authentication endpoints — stricter limits to prevent brute-force',
    tiers: {
      [UserTier.FREE]: { limit: 5, windowSecs: 60 },
      [UserTier.PREMIUM]: { limit: 10, windowSecs: 60 },
      [UserTier.VIP]: { limit: 20, windowSecs: 60 },
      [UserTier.ADMIN]: { limit: 100, windowSecs: 60 },
    },
  },
  {
    key: 'bets',
    algorithm: WindowAlgorithm.SLIDING,
    routes: ['/bets', '/bets/*'],
    methods: ['POST', 'PUT', 'PATCH'],
    standaloneOnly: false,
    enabled: true,
    description: 'Bet placement / modification',
    tiers: {
      [UserTier.FREE]: { limit: 10, windowSecs: 60 },
      [UserTier.PREMIUM]: { limit: 60, windowSecs: 60 },
      [UserTier.VIP]: { limit: 200, windowSecs: 60 },
      [UserTier.ADMIN]: { limit: 5_000, windowSecs: 60 },
    },
  },
  {
    key: 'balance_read',
    algorithm: WindowAlgorithm.SLIDING,
    routes: ['/balance', '/balance/*'],
    methods: ['GET'],
    standaloneOnly: false,
    enabled: true,
    description: 'Balance read endpoints',
    tiers: {
      [UserTier.FREE]: { limit: 30, windowSecs: 60 },
      [UserTier.PREMIUM]: { limit: 120, windowSecs: 60 },
      [UserTier.VIP]: { limit: 500, windowSecs: 60 },
      [UserTier.ADMIN]: { limit: 10_000, windowSecs: 60 },
    },
  },
  {
    key: 'blockchain_write',
    algorithm: WindowAlgorithm.SLIDING,
    routes: ['/blockchain/*'],
    methods: ['POST', 'PUT'],
    standaloneOnly: true,
    enabled: true,
    description: 'On-chain write operations — expensive, tightly limited',
    tiers: {
      [UserTier.FREE]: { limit: 2, windowSecs: 60 },
      [UserTier.PREMIUM]: { limit: 10, windowSecs: 60 },
      [UserTier.VIP]: { limit: 30, windowSecs: 60 },
      [UserTier.ADMIN]: { limit: 500, windowSecs: 60 },
    },
  },
];

/** Routes that are always exempt (webhooks, health checks, etc.) */
const EXEMPT_ROUTE_PATTERNS: RegExp[] = [
  /^\/webhooks\//,
  /^\/health$/,
  /^\/metrics$/,
];

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class RateLimitConfigService implements OnModuleInit {
  private readonly logger = new Logger(RateLimitConfigService.name);

  /** In-memory map: config key → merged config */
  private configs = new Map<string, EndpointRateLimitConfig>();

  constructor(private readonly redis: RateLimitRedisService) {}

  async onModuleInit(): Promise<void> {
    // Seed from built-ins
    for (const cfg of BUILT_IN_ENDPOINTS) {
      this.configs.set(cfg.key, { ...cfg });
    }

    // Overlay any persisted admin overrides
    await this.loadPersistedOverrides();

    this.logger.log(
      `RateLimitConfigService loaded ${this.configs.size} endpoint configs`,
    );
  }

  // ─── Lookups ─────────────────────────────────────────────────────────────────

  getAll(): EndpointRateLimitConfig[] {
    return Array.from(this.configs.values());
  }

  getByKey(key: string): EndpointRateLimitConfig | undefined {
    return this.configs.get(key);
  }

  /**
   * Find the most specific enabled config for a given route + method combo.
   * Falls back to the global config.
   */
  resolve(route: string, method: string): EndpointRateLimitConfig {
    const upper = method.toUpperCase();

    // Walk in insertion order — built-ins are ordered most-specific first
    for (const cfg of this.configs.values()) {
      if (!cfg.enabled || cfg.key === GLOBAL_RATE_LIMIT_KEY) continue;
      if (this.routeMatches(cfg, route, upper)) return cfg;
    }

    return this.configs.get(GLOBAL_RATE_LIMIT_KEY)!;
  }

  isExempt(route: string): boolean {
    return EXEMPT_ROUTE_PATTERNS.some((re) => re.test(route));
  }

  // ─── Admin mutations ──────────────────────────────────────────────────────────

  async applyAdminUpdate(
    dto: AdminConfigUpdateDto,
  ): Promise<EndpointRateLimitConfig> {
    const existing = this.configs.get(dto.key);
    if (!existing) {
      throw new Error(`No rate-limit config found for key "${dto.key}"`);
    }

    const updated: EndpointRateLimitConfig = {
      ...existing,
      ...(dto.algorithm !== undefined && { algorithm: dto.algorithm }),
      ...(dto.enabled !== undefined && { enabled: dto.enabled }),
      ...(dto.description !== undefined && { description: dto.description }),
      tiers: dto.tiers
        ? this.mergeTiers(existing.tiers, dto.tiers)
        : existing.tiers,
    };

    this.configs.set(dto.key, updated);
    await this.redis.persistConfig(dto.key, updated);

    this.logger.log(`Admin updated rate-limit config for "${dto.key}"`);
    return updated;
  }

  // ─── Internals ────────────────────────────────────────────────────────────────

  private routeMatches(
    cfg: EndpointRateLimitConfig,
    route: string,
    method: string,
  ): boolean {
    const methodOk = cfg.methods.length === 0 || cfg.methods.includes(method);
    if (!methodOk) return false;

    return cfg.routes.some((pattern) => this.globMatch(pattern, route));
  }

  private globMatch(pattern: string, path: string): boolean {
    if (pattern === '*') return true;
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      return path === prefix || path.startsWith(prefix + '/');
    }
    return pattern === path;
  }

  private mergeTiers(
    base: TierLimitMap,
    overrides: Partial<TierLimitMap>,
  ): TierLimitMap {
    const result = { ...base };
    for (const [tier, limit] of Object.entries(overrides)) {
      if (limit) result[tier as UserTier] = limit;
    }
    return result;
  }

  private async loadPersistedOverrides(): Promise<void> {
    try {
      const keys = await this.redis.listConfigKeys();
      for (const redisKey of keys) {
        // redisKey format: "rl:config:<endpoint_key>"
        const endpointKey = redisKey.replace(/^rl:config:/, '');
        const override =
          await this.redis.loadConfig<EndpointRateLimitConfig>(endpointKey);
        if (override && this.configs.has(endpointKey)) {
          this.configs.set(endpointKey, override);
          this.logger.debug(`Loaded persisted override for "${endpointKey}"`);
        }
      }
    } catch (err) {
      this.logger.warn(`Could not load persisted rate-limit overrides: ${err}`);
    }
  }
}
