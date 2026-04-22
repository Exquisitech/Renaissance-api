import { Column, Entity, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Match } from '../../matches/entities/match.entity';
import { MatchOutcome } from '../../common/enums/match.enums';

export enum BetStatus {
  PENDING = 'pending',
  WON = 'won',
  LOST = 'lost',
  CANCELLED = 'cancelled',
}

@Entity('bets')

// ❌ REMOVED unique constraint
@Index(['userId', 'matchId'])
@Index(['userId'])
@Index(['matchId'])
@Index(['status'])
@Index(['userId', 'status'])
@Index(['matchId', 'status'])
@Index(['settledAt'])
@Index(['reference'], { unique: true }) // unique bet tracking
export class Bet extends BaseEntity {

  @ApiProperty({
    description: 'Unique bet reference',
    example: 'BET-9f8a7c6d',
  })
  @Column({ unique: true })
  reference: string;

  @ApiProperty({
    description: 'ID of the user who placed the bet',
    example: '456e7890-e12b-34d5-a678-901234567890',
  })
  @Column({ name: 'user_id' })
  userId: string;

  @ApiProperty({
    description: 'ID of the match the bet was placed on',
    example: '789e0123-e45b-67d8-a901-234567890123',
  })
  @Column({ name: 'match_id', nullable: false })
  matchId: string;

  @ApiProperty({
    description: 'Amount staked on the bet',
    example: 100.5,
    type: Number,
  })
  @Column({ name: 'stake_amount', type: 'decimal', precision: 18, scale: 8 })
  stakeAmount: number;

  @ApiProperty({
    description: 'User prediction for the match outcome',
    enum: MatchOutcome,
    example: MatchOutcome.HOME_WIN,
  })
  @Column({
    name: 'predicted_outcome',
    type: 'enum',
    enum: MatchOutcome,
  })
  predictedOutcome: MatchOutcome;

  @ApiProperty({
    description: 'Odds at the time the bet was placed',
    example: 2.5,
  })
  @Column({ type: 'decimal', precision: 8, scale: 3 })
  odds: number;

  @ApiProperty({
    description: 'Potential payout (stake * odds)',
    example: 251.25,
  })
  @Column({
    name: 'potential_payout',
    type: 'decimal',
    precision: 18,
    scale: 8,
  })
  potentialPayout: number;

  @ApiProperty({
    description: 'Current bet status',
    enum: BetStatus,
    default: BetStatus.PENDING,
  })
  @Column({
    type: 'enum',
    enum: BetStatus,
    default: BetStatus.PENDING,
  })
  status: BetStatus;

  @ApiPropertyOptional({
    description: 'Group ID (for multi-bet strategies / future parlays)',
    example: 'GROUP-abc123',
  })
  @Column({ name: 'group_id', nullable: true })
  groupId?: string;

  @ApiPropertyOptional({
    description: 'Timestamp when bet was settled',
  })
  @Column({ name: 'settled_at', nullable: true })
  settledAt?: Date;

  @ApiPropertyOptional({
    description: 'Settlement result metadata',
  })
  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  /*
   * RELATIONS
   */

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Match, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'match_id' })
  match: Match;
}