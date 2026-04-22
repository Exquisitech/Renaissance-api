// ─── Tiers ────────────────────────────────────────────────────────────────────

export enum UserTier {
  FREE = 'free',
  PREMIUM = 'premium',
  VIP = 'vip',
  ADMIN = 'admin',
}

// ─── Window algorithm ─────────────────────────────────────────────────────────

export enum WindowAlgorithm {
  SLIDING = 'sliding',
  FIXED = 'fixed',
}

// ─── Per-endpoint limit config ────────────────────────────────────────────────

export interface TierLimit {
  /** Max requests allowed in the window */
  limit: number;
  /** Window size in seconds */
  windowSecs: number;
}

export type TierLimitMap = Record<UserTier, TierLimit>;

export interface EndpointRateLimitConfig {
  /** e.g. "POST /bets"  — used as the Redis namespace key */
  key: string;
  algorithm: WindowAlgorithm;
  tiers: TierLimitMap;
  /** Route patterns this config applies to, supports wildcards */
  routes: string[];
  /** HTTP methods this config applies to — empty means all */
  methods: string[];
  /** Whether this endpoint is exempt from global limits */
  standaloneOnly: boolean;
  enabled: boolean;
  /** Optional description shown in the admin API */
  description?: string;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_TIER_LIMITS: TierLimitMap = {
  [UserTier.FREE]: { limit: 60, windowSecs: 60 },
  [UserTier.PREMIUM]: { limit: 300, windowSecs: 60 },
  [UserTier.VIP]: { limit: 1_000, windowSecs: 60 },
  [UserTier.ADMIN]: { limit: 10_000, windowSecs: 60 },
};

export const GLOBAL_RATE_LIMIT_KEY = '__global__';

// ─── Result returned by the guard / service ───────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetEpoch: number; // Unix timestamp (seconds)
  retryAfter: number; // seconds until next allowed request (0 when allowed)
  tier: UserTier;
  endpoint: string;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface RateLimitAnalyticsSnapshot {
  endpoint: string;
  tier: UserTier;
  windowStart: number;
  windowEnd: number;
  totalRequests: number;
  blockedRequests: number;
  uniqueUsers: number;
  p95Remaining: number;
}

export interface AdminConfigUpdateDto {
  key: string;
  tiers?: Partial<TierLimitMap>;
  enabled?: boolean;
  algorithm?: WindowAlgorithm;
  description?: string;
}
