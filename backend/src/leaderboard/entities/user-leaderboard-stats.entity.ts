import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

@Entity('user_leaderboard_stats')
@Unique(['userId'])
@Index(['totalStaked'])
@Index(['totalEarnings'])
@Index(['predictionAccuracy'])
@Index(['longestWinStreak'])
@Index(['totalWins'])
@Index(['totalBets'])
export class UserLeaderboardStats extends BaseEntity {
  @Column({ name: 'user_id' })
  userId: string;

  @Column({
    name: 'total_staked',
    type: 'decimal',
    precision: 18,
    scale: 8,
    default: 0,
  })
  totalStaked: number;

  @Column({
    name: 'total_earnings',
    type: 'decimal',
    precision: 18,
    scale: 8,
    default: 0,
  })
  totalEarnings: number;

  @Column({ name: 'current_win_streak', default: 0 })
  currentWinStreak: number;

  @Column({ name: 'longest_win_streak', default: 0 })
  longestWinStreak: number;

  @Column({
    name: 'prediction_accuracy',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  predictionAccuracy: number;

  @Column({ name: 'total_bets', default: 0 })
  totalBets: number;

  @Column({ name: 'total_wins', default: 0 })
  totalWins: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
