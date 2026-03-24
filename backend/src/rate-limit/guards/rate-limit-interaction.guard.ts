import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  RateLimitInteractionService,
  InteractionAction,
} from '../rate-limit-interaction.service';

export const RATE_LIMIT_ACTION_KEY = 'rate_limit_action';

/**
 * Guard that enforces interaction rate limit before spin / stake endpoints.
 * Use with @SetMetadata(RATE_LIMIT_ACTION_KEY, 'spin' | 'spin_game' | 'stake').
 */
@Injectable()
export class RateLimitInteractionGuard implements CanActivate {
  constructor(
    private readonly rateLimitService: RateLimitInteractionService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const action = this.reflector.get<InteractionAction | undefined>(
      RATE_LIMIT_ACTION_KEY,
      context.getHandler(),
    );
    if (!action) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.userId ?? request.user?.id;
    if (!userId) {
      return true; // Auth guard will handle unauthenticated
    }

    await this.rateLimitService.checkAndEnforce(userId, action);
    return true;
  }
}
