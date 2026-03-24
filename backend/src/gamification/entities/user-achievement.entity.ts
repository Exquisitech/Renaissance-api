import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Achievement } from './achievement.entity';

@Entity('user_achievements')
@Index(['user', 'achievement'], { unique: true })
export class UserAchievement extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  @Index()
  user: User;

  @ManyToOne(() => Achievement, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'achievement_id' })
  achievement: Achievement;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'achievement_id', type: 'uuid' })
  achievementId: string;

  // Track progress (number of bets won, sum amounts staked, etc.)
  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  currentProgress: number;

  @Column({ default: false })
  @Index()
  isCompleted: boolean;

  @Column({ nullable: true })
  completedAt: Date;

  // Badge immutability: once completed, cannot be revoked or changed
  setCompleted() {
    if (this.isCompleted) {
      throw new Error('Badge already granted and immutable.');
    }
    this.isCompleted = true;
    this.completedAt = new Date();
  }
}
