import { MatchOutcome } from '../entities/match.entity';

export class MatchFinishedEvent {
  constructor(
    public readonly matchId: string,
    public readonly outcome: MatchOutcome,
    public readonly finishedAt: Date,
  ) {}
}
