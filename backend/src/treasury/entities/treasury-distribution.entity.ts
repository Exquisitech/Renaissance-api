import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Bet } from '../bets/entities/bet.entity';

export enum DistributionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PARTIAL = 'partial',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('treasury_distributions')
export class TreasuryDistribution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'batch_id' })
  batchId: string;

  @Column({
    type: 'enum',
    enum: DistributionStatus,
    default: DistributionStatus.PENDING,
  })
  status: DistributionStatus;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid', name: 'bet_id', nullable: true })
  betId: string | null;

  @ManyToOne(() => Bet)
  @JoinColumn({ name: 'bet_id' })
  bet: Bet;

  @Column({ type: 'numeric', precision: 20, scale: 0 })
  prizeAmount: number;

  @Column({ type: 'numeric', precision: 20, scale: 0, default: 0 })
  distributedAmount: number;

  @Column({ type: 'numeric', precision: 20, scale: 0, default: 0 })
  pendingAmount: number;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'text', nullable: true })
  transactionHash: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  distributedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  updatedAt: Date;
}
