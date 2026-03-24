import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { User } from '../users/entities/user.entity';

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  BET_PLACED = 'bet_placed',
  BET_WON = 'bet_won',
  BET_REFUND = 'bet_refund',
  STAKING_REWARD = 'staking_reward',
  STAKING_PENALTY = 'staking_penalty',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REVERSED = 'reversed',
}

@Entity('transactions')
@Index(['userId'])
@Index(['type'])
@Index(['status'])
@Index(['referenceId'])
@Index(['processedAt'])
export class Transaction extends BaseEntity {
  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  amount: number;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  /**
   * Links a reward/penalty transaction back to its originating stake transaction.
   */
  @Column({ name: 'reference_id', nullable: true })
  referenceId: string;

  /**
   * Set when a STAKING_PENALTY transaction has been picked up by the reward
   * processor. Acts as an idempotency guard — the cron job will never process
   * the same stake twice.
   */
  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null;

  /**
   * Flexible JSON bag for operation-specific data (APR, amounts, dates, etc.)
   */
  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
