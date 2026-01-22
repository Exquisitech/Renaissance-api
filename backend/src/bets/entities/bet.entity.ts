import { Column, Entity, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Match, MatchOutcome } from '../../matches/entities/match.entity';

export enum BetStatus {
  PENDING = 'pending',
  WON = 'won',
  LOST = 'lost',
  CANCELLED = 'cancelled',
}

@Entity('bets')
@Index(['userId', 'matchId'], { unique: true })
export class Bet extends BaseEntity {
  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'match_id', nullable: true })
  matchId: string;

  @Column({ name: 'stake_amount', type: 'decimal', precision: 18, scale: 8 })
  stakeAmount: number;

  @Column({
    name: 'predicted_outcome',
    type: 'enum',
    enum: MatchOutcome,
  })
  predictedOutcome: MatchOutcome;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  odds: number;

  @Column({
    name: 'potential_payout',
    type: 'decimal',
    precision: 18,
    scale: 8,
  })
  potentialPayout: number;

  @Column({
    type: 'enum',
    enum: BetStatus,
    default: BetStatus.PENDING,
  })
  status: BetStatus;

  @Column({ name: 'settled_at', nullable: true })
  settledAt: Date;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Match, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'match_id' })
  match: Match;
}
