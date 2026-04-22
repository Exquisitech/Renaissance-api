import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { MatchFinishedEvent } from '../matches/events/match-finished.event';
import { BetSettlementService } from './bet-settlement.service';

@EventsHandler(MatchFinishedEvent)
export class MatchFinishedEventHandler
  implements IEventHandler<MatchFinishedEvent>
{
  constructor(private readonly betSettlementService: BetSettlementService) {}

  async handle(event: MatchFinishedEvent): Promise<void> {
    await this.betSettlementService.enqueueMatchSettlement(event.matchId, null, {
      source: 'match_finished_listener',
      outcome: event.outcome,
      finishedAt: event.finishedAt.toISOString(),
    });
  }
}
