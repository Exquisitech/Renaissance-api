import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TreasuryDistribution } from './treasury-distribution.entity';

export enum AuditAction {
  DISTRIBUTION_INITIATED = 'distribution_initiated',
  DISTRIBUTION_STARTED = 'distribution_started',
  DISTRIBUTION_COMPLETED = 'distribution_completed',
  DISTRIBUTION_FAILED = 'distribution_failed',
  PARTIAL_DISTRIBUTION = 'partial_distribution',
  REFUND_PROCESSED = 'refund_processed',
  BATCH_COMPLETED = 'batch_completed',
  BATCH_FAILED = 'batch_failed',
}

@Entity('treasury_audit_logs')
export class TreasuryAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'distribution_id', nullable: true })
  distributionId: string | null;

  @ManyToOne(() => TreasuryDistribution, { nullable: true })
  @JoinColumn({ name: 'distribution_id' })
  distribution: TreasuryDistribution | null;

  @Column({ type: 'uuid', name: 'batch_id', nullable: true })
  batchId: string | null;

  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  action: AuditAction;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'numeric', precision: 20, scale: 0, nullable: true })
  amount: number | null;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'text', name: 'transaction_hash', nullable: true })
  transactionHash: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
