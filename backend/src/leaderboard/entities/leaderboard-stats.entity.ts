import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

export enum LeaderboardPeriod {
  ALL_TIME = 'all_time',
  MONTHLY = 'monthly',
  WEEKLY = 'weekly',
}

@Entity('leaderboard_stats')
@Unique(['userId', 'period', 'timeframeId'])
export class LeaderboardStats extends BaseEntity {
  @Column({ name: 'user_id' })
  userId: string;

  @Column({
    type: 'enum',
    enum: LeaderboardPeriod,
  })
  period: LeaderboardPeriod;

  @Column({ name: 'timeframe_id' })
  timeframeId: string; // "GLOBAL", "2024-01", "2024-W05"

  @Column({
    name: 'total_staked',
    type: 'decimal',
    precision: 18,
    scale: 8,
    default: 0,
  })
  totalStaked: number;

  @Column({
    name: 'total_net_earnings',
    type: 'decimal',
    precision: 18,
    scale: 8,
    default: 0,
  })
  totalNetEarnings: number;

  @Column({ name: 'total_won', default: 0 })
  totalWon: number;

  @Column({ name: 'total_lost', default: 0 })
  totalLost: number;

  @Column({ name: 'total_settled', default: 0 })
  totalSettled: number;

  @Column({ name: 'current_streak', default: 0 })
  currentStreak: number;

  @Column({ name: 'longest_streak', default: 0 })
  longestStreak: number;

  @Column({
    name: 'last_updated',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  lastUpdated: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
