import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { StakeCreditedEvent } from '../domain/events';
import { LeaderboardService } from '../leaderboard.service';

/**
 * Event handler for StakeCreditedEvent
 * Updates leaderboard stats when staking rewards are credited
 */
@EventsHandler(StakeCreditedEvent)
export class StakeCreditedEventHandler implements IEventHandler<StakeCreditedEvent> {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  async handle(event: StakeCreditedEvent): Promise<void> {
    await this.leaderboardService.handleStakeCredited(event);
  }
}
