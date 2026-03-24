import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { RateLimitViolationEvent } from '../events/rate-limit-violation.event';

/**
 * Logs rate limit violations (and can be extended to write to audit).
 */
@EventsHandler(RateLimitViolationEvent)
export class RateLimitViolationListener implements IEventHandler<RateLimitViolationEvent> {
  private readonly logger = new Logger(RateLimitViolationListener.name);

  async handle(event: RateLimitViolationEvent): Promise<void> {
    this.logger.warn(
      `Rate limit violation: userId=${event.userId} action=${event.action} ` +
        `cooldown=${event.cooldownSeconds}s nextAllowedAt=${event.nextAllowedAt.toISOString()}`,
    );
  }
}
