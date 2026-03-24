import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

export enum LeaderboardTier {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
}

export enum SeasonStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

@Entity('seasonal_leaderboards')
@Unique(['userId', 'seasonId'])
@Index(['seasonId', 'tier'])
@Index(['seasonId', 'totalPoints'])
export class SeasonalLeaderboard extends BaseEntity {
  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'season_id' })
  seasonId: string;

  @Column({
    type: 'enum',
    enum: LeaderboardTier,
    default: LeaderboardTier.BRONZE,
  })
  tier: LeaderboardTier;

  @Column({
    name: 'total_points',
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: 0,
  })
  totalPoints: number;

  @Column({ name: 'total_bets', default: 0 })
  totalBets: number;

  @Column({ name: 'bets_won', default: 0 })
  betsWon: number;

  @Column({ name: 'bets_lost', default: 0 })
  betsLost: number;

  @Column({
    name: 'total_winnings',
    type: 'decimal',
    precision: 18,
    scale: 8,
    default: 0,
  })
  totalWinnings: number;

  @Column({
    name: 'total_staked',
    type: 'decimal',
    precision: 18,
    scale: 8,
    default: 0,
  })
  totalStaked: number;

  @Column({
    name: 'betting_accuracy',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  bettingAccuracy: number;

  @Column({ name: 'winning_streak', default: 0 })
  winningStreak: number;

  @Column({ name: 'highest_winning_streak', default: 0 })
  highestWinningStreak: number;

  @Column({ name: 'rank', nullable: true })
  rank: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
