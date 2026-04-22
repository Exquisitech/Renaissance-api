// security/fraud.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum FraudReason {
  RAPID_SPIN = 'RAPID_SPIN',
  HIGH_FREQUENCY_BET = 'HIGH_FREQUENCY_BET',
  WIN_STREAK = 'WIN_STREAK',
  MANUAL_REVIEW = 'MANUAL_REVIEW',
}

export enum FraudStatus {
  FLAGGED = 'FLAGGED',
  RESTRICTED = 'RESTRICTED',
  CLEARED = 'CLEARED',
}

@Entity('fraud_logs')
export class FraudEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @Column({
    type: 'enum',
    enum: FraudReason,
  })
  reason: FraudReason;

  @Column({
    type: 'enum',
    enum: FraudStatus,
    default: FraudStatus.FLAGGED,
  })
  status: FraudStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
