import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum DistributionBatchStatus {
  INITIATED = 'initiated',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  PARTIAL_COMPLETION = 'partial_completion',
  FAILED = 'failed',
}

@Entity('treasury_distribution_batches')
export class TreasuryDistributionBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  batchNumber: string;

  @Column({
    type: 'enum',
    enum: DistributionBatchStatus,
    default: DistributionBatchStatus.INITIATED,
  })
  status: DistributionBatchStatus;

  @Column({ type: 'numeric', precision: 20, scale: 0 })
  totalPrizeAmount: number;

  @Column({ type: 'numeric', precision: 20, scale: 0, default: 0 })
  totalDistributedAmount: number;

  @Column({ type: 'int', default: 0 })
  totalWinners: number;

  @Column({ type: 'int', default: 0 })
  successfulDistributions: number;

  @Column({ type: 'int', default: 0 })
  failedDistributions: number;

  @Column({ type: 'int', default: 0 })
  partialDistributions: number;

  @Column({ type: 'text', nullable: true })
  failureReason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  updatedAt: Date;
}
