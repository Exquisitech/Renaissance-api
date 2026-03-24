import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ValidationStatus {
  PENDING = 'pending',
  PASSED = 'passed',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
}

export enum TransactionType {
  BET_SETTLEMENT = 'bet_settlement',
  SPIN_PAYOUT = 'spin_payout',
  STAKING_REWARD = 'staking_reward',
  STAKING_PENALTY = 'staking_penalty',
  WALLET_TRANSFER = 'wallet_transfer',
}

export enum ValidationType {
  BALANCE_INTEGRITY = 'balance_integrity',
  STATE_CONSISTENCY = 'state_consistency',
  ATOMICITY_CHECK = 'atomicity_check',
  ONCHAIN_RECONCILIATION = 'onchain_reconciliation',
}

export enum ViolationType {
  PARTIAL_UPDATE = 'partial_update',
  BALANCE_MISMATCH = 'balance_mismatch',
  STATE_INCONSISTENCY = 'state_inconsistency',
  ONCHAIN_DISCREPANCY = 'onchain_discrepancy',
  TRANSACTION_ROLLBACK = 'transaction_rollback',
}

export interface ValidationRule {
  name: string;
  description: string;
  checkFunction: string; // Reference to validation function
  critical: boolean; // Whether failure should trigger rollback
}

export interface ValidationResult {
  ruleName: string;
  passed: boolean;
  actualValue?: any;
  expectedValue?: any;
  message?: string;
  timestamp: Date;
}

export interface IntegrityViolation {
  type: ViolationType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedEntity: string;
  affectedId: string;
  currentValue: any;
  expectedValue: any;
  detectedAt: Date;
  resolvedAt?: Date;
  resolutionNotes?: string;
}

@Entity('transaction_validation_reports')
@Index(['status'])
@Index(['transactionType'])
@Index(['createdAt'])
@Index(['status', 'createdAt'])
@Index(['validationType'])
export class TransactionValidationReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ValidationStatus,
    default: ValidationStatus.PENDING,
  })
  status: ValidationStatus;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  transactionType: TransactionType;

  @Column({
    type: 'enum',
    enum: ValidationType,
  })
  validationType: ValidationType;

  @Column({ name: 'transaction_id' })
  transactionId: string;

  @Column({ name: 'reference_id', nullable: true })
  referenceId: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @Column({ name: 'started_at', type: 'timestamp' })
  startedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'validation_rules', type: 'json' })
  validationRules: ValidationRule[];

  @Column({ name: 'validation_results', type: 'json', nullable: true })
  validationResults: ValidationResult[] | null;

  @Column({ name: 'violations', type: 'json', nullable: true })
  violations: IntegrityViolation[] | null;

  @Column({ name: 'total_checks', type: 'int', default: 0 })
  totalChecks: number;

  @Column({ name: 'passed_checks', type: 'int', default: 0 })
  passedChecks: number;

  @Column({ name: 'failed_checks', type: 'int', default: 0 })
  failedChecks: number;

  @Column({ name: 'critical_violations', type: 'int', default: 0 })
  criticalViolations: number;

  @Column({ name: 'rollback_triggered', type: 'boolean', default: false })
  rollbackTriggered: boolean;

  @Column({ name: 'rollback_reason', type: 'text', nullable: true })
  rollbackReason: string | null;

  @Column({ name: 'rollback_completed_at', type: 'timestamp', nullable: true })
  rollbackCompletedAt: Date | null;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
