import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Match } from '../../matches/entities/match.entity';

export enum BetSettlementJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('bet_settlement_jobs')
@Index(['matchId'])
@Index(['status'])
@Index(['status', 'nextRetryAt'])
@Index(['matchId', 'status'])
export class BetSettlementJob extends BaseEntity {
  @Column({ name: 'match_id' })
  matchId: string;

  @Column({
    type: 'enum',
    enum: BetSettlementJobStatus,
    default: BetSettlementJobStatus.PENDING,
  })
  status: BetSettlementJobStatus;

  @Column({ name: 'attempt_count', default: 0 })
  attemptCount: number;

  @Column({ name: 'max_attempts', default: 5 })
  maxAttempts: number;

  @Column({ name: 'next_retry_at', type: 'timestamp', nullable: true })
  nextRetryAt: Date | null;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @Column({ name: 'requested_by', nullable: true })
  requestedBy: string | null;

  @Column({ name: 'last_summary', type: 'json', nullable: true })
  lastSummary: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown> | null;

  @ManyToOne(() => Match, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'match_id' })
  match: Match;
}
