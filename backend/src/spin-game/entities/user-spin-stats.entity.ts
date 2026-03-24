import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

@Entity('user_spin_stats')
export class UserSpinStats extends BaseEntity {
  @Column({ name: 'user_id', type: 'varchar', length: 56, unique: true })
  userId: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'total_spins', type: 'int', default: 0 })
  totalSpins: number;

  @Column({
    name: 'total_staked',
    type: 'decimal',
    precision: 30,
    scale: 7,
    default: 0,
  })
  totalStaked: number;

  @Column({
    name: 'total_won',
    type: 'decimal',
    precision: 30,
    scale: 7,
    default: 0,
  })
  totalWon: number;

  @Column({ name: 'spins_today', type: 'int', default: 0 })
  spinsToday: number;

  @Column({ name: 'last_spin_date', type: 'timestamp', nullable: true })
  lastSpinDate: Date | null;

  @Column({ name: 'current_streak', type: 'int', default: 0 })
  currentStreak: number;

  @Column({ name: 'max_streak', type: 'int', default: 0 })
  maxStreak: number;

  @Column({ name: 'last_reset_date', type: 'date' })
  lastResetDate: Date;

  // ...BaseEntity fields: id, createdAt, updatedAt, deletedAt
}
