import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

@Entity('free_bet_rewards')
export class FreeBetReward extends BaseEntity {
  @Column({ name: 'user_id', type: 'varchar', length: 56 })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'decimal', precision: 20, scale: 7 })
  amount: number;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @Column({ name: 'is_used', type: 'boolean', default: false })
  isUsed: boolean;

  @Column({ name: 'used_at', type: 'timestamp', nullable: true })
  usedAt: Date | null;

  @Column({
    type: 'enum',
    enum: ['SPIN_GAME', 'PROMOTION', 'REFERRAL'],
    default: 'SPIN_GAME',
  })
  source: string;

  @Column({ name: 'spin_game_id', type: 'varchar', nullable: true })
  spinGameId: string | null;

  // ...BaseEntity fields: id, createdAt, updatedAt, deletedAt

  @Index()
  @Column({ name: 'is_withdrawable', type: 'boolean', default: false })
  isWithdrawable: boolean;

  @Column({ name: 'terms_accepted', type: 'boolean', default: false })
  termsAccepted: boolean;
}
