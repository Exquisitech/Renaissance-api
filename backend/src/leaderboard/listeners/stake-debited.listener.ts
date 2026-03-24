import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { StakeDebitedEvent } from '../domain/events';
import { LeaderboardService } from '../leaderboard.service';

/**
 * Event handler for StakeDebitedEvent
 * Updates leaderboard stats when staked tokens are debited
 */
@EventsHandler(StakeDebitedEvent)
export class StakeDebitedEventHandler implements IEventHandler<StakeDebitedEvent> {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  async handle(event: StakeDebitedEvent): Promise<void> {
    await this.leaderboardService.handleStakeDebited(event);
  }
}
