import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum BetSettlementAuditAction {
  ENQUEUED = 'enqueued',
  SKIPPED = 'skipped',
  PROCESSING_STARTED = 'processing_started',
  COMPLETED = 'completed',
  RETRY_SCHEDULED = 'retry_scheduled',
  FAILED = 'failed',
}

@Entity('bet_settlement_audit_logs')
@Index(['jobId'])
@Index(['matchId'])
@Index(['action'])
@Index(['createdAt'])
export class BetSettlementAuditLog extends BaseEntity {
  @Column({ name: 'job_id', nullable: true })
  jobId: string | null;

  @Column({ name: 'match_id' })
  matchId: string;

  @Column({
    type: 'enum',
    enum: BetSettlementAuditAction,
  })
  action: BetSettlementAuditAction;

  @Column({ nullable: true })
  message: string | null;

  @Column({ nullable: true })
  attempt: number | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown> | null;
}
