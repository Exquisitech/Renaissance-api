// security/fraud.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum FraudReason {
  // Existing fraud reasons
  RAPID_SPIN = 'RAPID_SPIN',
  HIGH_FREQUENCY_BET = 'HIGH_FREQUENCY_BET',
  WIN_STREAK = 'WIN_STREAK',
  MANUAL_REVIEW = 'MANUAL_REVIEW',

  // Multi-account detection
  SAME_IP_MULTIPLE_ACCOUNTS = 'SAME_IP_MULTIPLE_ACCOUNTS',
  SAME_DEVICE_MULTIPLE_ACCOUNTS = 'SAME_DEVICE_MULTIPLE_ACCOUNTS',

  // Collusion detection
  COLLUSION_SUSPECTED = 'COLLUSION_SUSPECTED',
  COORDINATED_BETTING = 'COORDINATED_BETTING',

  // Unusual betting patterns
  SUDDEN_LARGE_BET = 'SUDDEN_LARGE_BET',
  ABNORMAL_BET_INCREASE = 'ABNORMAL_BET_INCREASE',
  BETTING_PATTERN_ANOMALY = 'BETTING_PATTERN_ANOMALY',

  // Time-based anomalies
  UNUSUAL_TIME_ACTIVITY = 'UNUSUAL_TIME_ACTIVITY',
  RAPID_SUCCESSION_BETS = 'RAPID_SUCCESSION_BETS',

  // Suspicious transactions
  SUSPICIOUS_TRANSACTION = 'SUSPICIOUS_TRANSACTION',
  STRUCTURING_DETECTED = 'STRUCTURING_DETECTED',
  MONEY_LAUNDERING_RED_FLAG = 'MONEY_LAUNDERING_RED_FLAG',
}

export enum FraudStatus {
  FLAGGED = 'FLAGGED',
  RESTRICTED = 'RESTRICTED',
  CLEARED = 'CLEARED',
  UNDER_REVIEW = 'UNDER_REVIEW',
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * Numeric risk scores (1-100) per fraud reason.
 * Used for accurate scoring beyond categorical risk levels.
 */
export const RISK_SCORES: Record<FraudReason, number> = {
  [FraudReason.UNUSUAL_TIME_ACTIVITY]: 15,
  [FraudReason.WIN_STREAK]: 25,
  [FraudReason.BETTING_PATTERN_ANOMALY]: 35,
  [FraudReason.RAPID_SPIN]: 40,
  [FraudReason.ABNORMAL_BET_INCREASE]: 42,
  [FraudReason.RAPID_SUCCESSION_BETS]: 45,
  [FraudReason.HIGH_FREQUENCY_BET]: 48,
  [FraudReason.SUDDEN_LARGE_BET]: 50,
  [FraudReason.MANUAL_REVIEW]: 55,
  [FraudReason.SAME_IP_MULTIPLE_ACCOUNTS]: 65,
  [FraudReason.SUSPICIOUS_TRANSACTION]: 68,
  [FraudReason.COLLUSION_SUSPECTED]: 72,
  [FraudReason.COORDINATED_BETTING]: 78,
  [FraudReason.SAME_DEVICE_MULTIPLE_ACCOUNTS]: 90,
  [FraudReason.STRUCTURING_DETECTED]: 92,
  [FraudReason.MONEY_LAUNDERING_RED_FLAG]: 95,
};

@Entity('fraud_logs')
@Index(['userId'])
@Index(['reason'])
@Index(['status'])
@Index(['riskLevel'])
@Index(['createdAt'])
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

  @Column({
    type: 'enum',
    enum: RiskLevel,
    default: RiskLevel.MEDIUM,
  })
  riskLevel: RiskLevel;

  @Column({ type: 'int', default: 50 })
  riskScore: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true })
  reviewedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date;

  @Column({ type: 'text', nullable: true })
  reviewNotes: string;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
