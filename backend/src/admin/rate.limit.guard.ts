import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { RateLimitService } from './rate-limit.service';
import { UserTier } from './rate.limit.types';

// ─── Decorator helpers ────────────────────────────────────────────────────────

export const RATE_LIMIT_EXEMPT_KEY = 'rateLimitExempt';
export const RATE_LIMIT_TIER_KEY = 'rateLimitTierOverride';

/** Mark a handler or controller as exempt from rate limiting. */
export const RateLimitExempt = () => SetMetadata(RATE_LIMIT_EXEMPT_KEY, true);

/** Override the tier resolved from the JWT for a specific endpoint. */
export const RateLimitTier = (tier: UserTier) =>
  SetMetadata(RATE_LIMIT_TIER_KEY, tier);

// ─── Guard ────────────────────────────────────────────────────────────────────

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly rateLimitSvc: RateLimitService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req: Request = context.switchToHttp().getRequest();
    const res: Response = context.switchToHttp().getResponse();

    // ── Decorator exemption ──────────────────────────────────────────────────
    const exempt = this.reflector.getAllAndOverride<boolean>(
      RATE_LIMIT_EXEMPT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (exempt) return true;

    // ── Resolve caller identity & tier ───────────────────────────────────────
    const identifier = this.resolveIdentifier(req);
    const tier = this.resolveTier(context, req);
    const route = this.normalisePath(req.path);
    const method = req.method;

    // ── Perform checks ───────────────────────────────────────────────────────
    const outcome = await this.rateLimitSvc.check({
      identifier,
      route,
      method,
      tier,
    });

    // ── Attach headers ───────────────────────────────────────────────────────
    for (const [header, value] of Object.entries(outcome.headers)) {
      res.setHeader(header, value);
    }

    if (outcome.allowed) return true;

    this.logger.warn(
      `Rate limit exceeded identifier=${identifier} tier=${tier} route=${method} ${route} blockedBy=${outcome.blockedBy}`,
    );

    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Please retry after ${outcome.headers['Retry-After'] ?? '?'} second(s).`,
        retryAfter: Number(outcome.headers['Retry-After'] ?? 0),
        blockedBy: outcome.blockedBy,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private resolveIdentifier(req: Request): string {
    const user = (req as any).user;
    if (user?.id) return `user:${user.id}`;
    if (user?.sub) return `user:${user.sub}`;
    return `ip:${req.ip ?? req.socket?.remoteAddress ?? 'unknown'}`;
  }

  private resolveTier(context: ExecutionContext, req: Request): UserTier {
    // Decorator override takes precedence
    const override = this.reflector.getAllAndOverride<UserTier>(
      RATE_LIMIT_TIER_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (override) return override;

    // Tier embedded in JWT by auth middleware
    const user = (req as any).user;
    if (user?.tier && Object.values(UserTier).includes(user.tier)) {
      return user.tier as UserTier;
    }

    return UserTier.FREE;
  }

  private normalisePath(path: string): string {
    // Strip query string, collapse duplicate slashes, ensure leading slash
    return (
      ('/' + path.replace(/\/+/g, '/').replace(/^\//, '')).replace(/\/$/, '') ||
      '/'
    );
  }
}
