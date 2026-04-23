import { Column, Entity, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Free bet vouchers.
 * - Can be issued independently (manual, promotion, spin, compensation).
 * - Cannot be withdrawn (not added to wallet balance).
 * - Can only be applied to betting.
 * - Automatically consumed on use.
 */
@Entity('free_bet_vouchers')
@Index(['userId', 'used'])
@Index(['expiresAt'])
export class FreeBetVoucher extends BaseEntity {
  @Column({ name: 'user_id' })
  userId: string;

  @Column({
    name: 'amount',
    type: 'decimal',
    precision: 18,
    scale: 8,
  })
  amount: number;

  @Column({
    name: 'expires_at',
    type: 'timestamp',
  })
  expiresAt: Date;

  @Column({
    name: 'used',
    type: 'boolean',
    default: false,
  })
  used: boolean;

  @Column({
    name: 'used_at',
    type: 'timestamp',
    nullable: true,
  })
  usedAt?: Date;

  @Column({
    name: 'used_for_bet_id',
    nullable: true,
  })
  usedForBetId?: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
