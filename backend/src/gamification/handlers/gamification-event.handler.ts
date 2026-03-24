import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { BetSettledEvent } from '../../leaderboard/domain/events/bet-settled.event';
import { SpinSettledEvent } from '../../leaderboard/domain/events/spin-settled.event';
import { StakeCreditedEvent } from '../../leaderboard/domain/events/stake-credited.event';
import { StakeDebitedEvent } from '../../leaderboard/domain/events/stake-debited.event';
import { GamificationService } from '../gamification.service';
import { TriggerEvent } from '../entities/achievement.entity';

@EventsHandler(BetSettledEvent)
export class BetSettledGamificationHandler implements IEventHandler<BetSettledEvent> {
  constructor(private readonly gamificationService: GamificationService) {}

  async handle(event: BetSettledEvent) {
    const payload = {
      isWin: event.isWin,
      stakeAmount: event.stakeAmount,
      payoutAmount: event.winningsAmount,
    };
    await this.gamificationService.processEvent(
      event.userId,
      TriggerEvent.BET_SETTLED,
      payload,
    );
  }
}

@EventsHandler(SpinSettledEvent)
export class SpinSettledGamificationHandler implements IEventHandler<SpinSettledEvent> {
  constructor(private readonly gamificationService: GamificationService) {}

  async handle(event: SpinSettledEvent) {
    const payload = {
      outcome: event.outcome,
      stakeAmount: event.stakeAmount,
      payoutAmount: event.payoutAmount,
      isWin: event.isWin,
    };
    await this.gamificationService.processEvent(
      event.userId,
      TriggerEvent.SPIN_RESULT,
      payload,
    );
  }
}

@EventsHandler(StakeCreditedEvent)
export class StakeCreditedGamificationHandler implements IEventHandler<StakeCreditedEvent> {
  constructor(private readonly gamificationService: GamificationService) {}

  async handle(event: StakeCreditedEvent) {
    const payload = {
      amount: event.rewardAmount, // or stakedAmount depending on what we track
      isCredit: true,
    };
    await this.gamificationService.processEvent(
      event.userId,
      TriggerEvent.STAKING_EVENT,
      payload,
    );
  }
}

@EventsHandler(StakeDebitedEvent)
export class StakeDebitedGamificationHandler implements IEventHandler<StakeDebitedEvent> {
  constructor(private readonly gamificationService: GamificationService) {}

  async handle(event: StakeDebitedEvent) {
    const payload = {
      amount: event.stakedAmount,
      isCredit: false,
    };
    await this.gamificationService.processEvent(
      event.userId,
      TriggerEvent.STAKING_EVENT,
      payload,
    );
  }
}

export const GamificationEventHandlers = [
  BetSettledGamificationHandler,
  SpinSettledGamificationHandler,
  StakeCreditedGamificationHandler,
  StakeDebitedGamificationHandler,
];
