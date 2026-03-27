// security/fraud.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
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

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
