import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum SpinStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum SpinOutcome {
  JACKPOT = 'jackpot',
  HIGH_WIN = 'high_win',
  MEDIUM_WIN = 'medium_win',
  SMALL_WIN = 'small_win',
  NO_WIN = 'no_win',
}

@Entity('spins')
@Index(['userId', 'createdAt'])
@Index(['sessionId'], { unique: true })
export class Spin extends BaseEntity {
  @Column('uuid')
  @Index()
  userId: string;

  @Column('varchar', { length: 255, unique: true })
  sessionId: string;

  @Column('decimal', { precision: 10, scale: 2 })
  stakeAmount: number;

  @Column('enum', { enum: SpinOutcome })
  outcome: SpinOutcome;

  @Column('decimal', { precision: 10, scale: 2 })
  payoutAmount: number;

  @Column('enum', { enum: SpinStatus, default: SpinStatus.PENDING })
  status: SpinStatus;

  @Column('jsonb', { nullable: true })
  metadata: {
    randomSeed?: string;
    weightedProbabilities?: Record<string, number>;
    clientTimestamp?: Date;
    serverTimestamp?: Date;
    rewardChannel?: 'XLM' | 'NFT' | 'FREE_BET';
    voucherId?: string;
    [key: string]: any;
  };

  // ...BaseEntity fields: id, createdAt, updatedAt, deletedAt
}
