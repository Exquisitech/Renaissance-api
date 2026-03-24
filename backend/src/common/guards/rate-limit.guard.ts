import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// Custom exception since TooManyRequestsException doesn't exist in @nestjs/common
class TooManyRequestsException extends HttpException {
  constructor(message?: string) {
    super(message || 'Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
  }
}

interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

const roleLimits: Record<string, RateLimitConfig> = {
  guest: { limit: 10, windowMs: 60_000 }, // 10 requests/minute
  user: { limit: 50, windowMs: 60_000 }, // 50 requests/minute
  admin: { limit: 200, windowMs: 60_000 }, // 200 requests/minute
};

const requestStore: Map<string, { count: number; resetTime: number }> =
  new Map();

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const userRole = request.user?.role || 'guest';
    const config = roleLimits[userRole];

    const key = `${userRole}:${request.ip}`;
    const now = Date.now();

    const record = requestStore.get(key) || {
      count: 0,
      resetTime: now + config.windowMs,
    };

    if (now > record.resetTime) {
      record.count = 0;
      record.resetTime = now + config.windowMs;
    }

    record.count++;
    requestStore.set(key, record);

    if (record.count > config.limit) {
      throw new TooManyRequestsException(
        'Rate limit exceeded. Please try again later.',
      );
    }

    return true;
  }
}
