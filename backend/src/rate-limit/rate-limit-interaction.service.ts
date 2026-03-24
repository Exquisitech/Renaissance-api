import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventBus } from '@nestjs/cqrs';
import {
  UserLastInteraction,
  RateLimitConfig,
  RATE_LIMIT_CONFIG_KEYS,
} from './entities';
import { RateLimitViolationEvent } from './events/rate-limit-violation.event';

export type InteractionAction = 'spin' | 'spin_game' | 'stake';

const CONFIG_KEY = RATE_LIMIT_CONFIG_KEYS.INTERACTION_COOLDOWN_SECONDS;

/**
 * Rate-Limited Interaction Layer (#103).
 * Tracks last interaction per user, enforces admin-configurable cooldown,
 * applies to spin & staking endpoints. Emits violation event on rejection.
 */
@Injectable()
export class RateLimitInteractionService {
  private readonly logger = new Logger(RateLimitInteractionService.name);

  constructor(
    @InjectRepository(UserLastInteraction)
    private readonly lastInteractionRepo: Repository<UserLastInteraction>,
    @InjectRepository(RateLimitConfig)
    private readonly configRepo: Repository<RateLimitConfig>,
    private readonly eventBus: EventBus,
  ) {}

  /**
   * Returns cooldown in seconds (admin-configurable). Default 5.
   */
  async getCooldownSeconds(): Promise<number> {
    const row = await this.configRepo.findOne({
      where: { key: CONFIG_KEY },
    });
    return row?.valueSeconds ?? 5;
  }

  /**
   * Admin: set cooldown period in seconds.
   */
  async setCooldownSeconds(
    valueSeconds: number,
    updatedBy: string,
  ): Promise<{ cooldownSeconds: number }> {
    if (valueSeconds < 0) {
      throw new ForbiddenException('Cooldown must be >= 0');
    }
    await this.configRepo.upsert(
      {
        key: CONFIG_KEY,
        valueSeconds,
        updatedBy,
      },
      { conflictPaths: ['key'] },
    );
    return { cooldownSeconds: valueSeconds };
  }

  /**
   * Check if user is allowed to perform the action (within cooldown).
   * If not allowed: emits RateLimitViolationEvent and throws.
   * Call recordInteraction() after a successful action.
   */
  async checkAndEnforce(
    userId: string,
    action: InteractionAction,
  ): Promise<void> {
    const cooldownSeconds = await this.getCooldownSeconds();
    if (cooldownSeconds <= 0) {
      return;
    }

    const row = await this.lastInteractionRepo.findOne({
      where: { userId },
    });
    if (!row) {
      return;
    }

    const now = new Date();
    const elapsedMs = now.getTime() - row.lastInteractionAt.getTime();
    const cooldownMs = cooldownSeconds * 1000;

    if (elapsedMs < cooldownMs) {
      const nextAllowedAt = new Date(
        row.lastInteractionAt.getTime() + cooldownMs,
      );
      this.eventBus.publish(
        new RateLimitViolationEvent(
          userId,
          action,
          now,
          cooldownSeconds,
          nextAllowedAt,
        ),
      );
      this.logger.warn(
        `Rate limit violation: userId=${userId} action=${action} cooldown=${cooldownSeconds}s nextAllowedAt=${nextAllowedAt.toISOString()}`,
      );
      throw new ForbiddenException(
        `Please wait ${Math.ceil((cooldownMs - elapsedMs) / 1000)} seconds before another ${action} action.`,
      );
    }
  }

  /**
   * Record that the user performed an interaction (call after successful spin/bet).
   */
  async recordInteraction(userId: string): Promise<void> {
    await this.lastInteractionRepo.upsert(
      {
        userId,
        lastInteractionAt: new Date(),
      },
      { conflictPaths: ['userId'] },
    );
  }
}
