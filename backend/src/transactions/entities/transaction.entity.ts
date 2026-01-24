import { Column, Entity, ManyToOne, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

export enum TransactionType {
  BET_PLACEMENT = 'bet_placement',
  BET_WINNING = 'bet_winning',
  BET_CANCELLATION = 'bet_cancellation',
  WALLET_DEPOSIT = 'wallet_deposit',
  WALLET_WITHDRAWAL = 'wallet_withdrawal',
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
@Index(['status'])
@Index(['type'])
@Index(['userId', 'type'])
@Index(['userId', 'status'])
@Index(['referenceId'])
@Index(['relatedEntityId'])
export class Transaction extends BaseEntity {
  @Column({ name: 'user_id' })
  userId: string;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type: TransactionType;

  @Column({ name: 'amount', type: 'decimal', precision: 18, scale: 8 })
  amount: number;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({ name: 'reference_id', nullable: true })
  referenceId: string;

  @Column({ name: 'related_entity_id', nullable: true })
  relatedEntityId: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @ManyToOne(() => User, (user) => user.transactions)
  user: User;
}
