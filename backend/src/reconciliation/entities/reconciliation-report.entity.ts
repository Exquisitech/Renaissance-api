import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ReportStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum ReportType {
  SCHEDULED = 'scheduled',
  MANUAL = 'manual',
  LEDGER_CONSISTENCY = 'ledger_consistency',
}

export enum InconsistencyType {
  NEGATIVE_BALANCE = 'negative_balance',
  ORPHANED_BET = 'orphaned_bet',
  MISMATCHED_SETTLEMENT = 'mismatched_settlement',
  STUCK_PENDING_SETTLEMENT = 'stuck_pending_settlement',
  LEDGER_MISMATCH = 'ledger_mismatch',
  ONCHAIN_BALANCE_DISCREPANCY = 'onchain_balance_discrepancy',
  OFFCHAIN_BALANCE_DISCREPANCY = 'offchain_balance_discrepancy',
  ROUNDING_DIFFERENCE = 'rounding_difference',
}

export enum Severity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum DiscrepancyStatus {
  DETECTED = 'detected',
  FLAGGED = 'flagged',
  RESOLVED = 'resolved',
  IGNORED = 'ignored',
}

export interface Inconsistency {
  type: InconsistencyType;
  severity: Severity;
  entityType: string;
  entityId: string;
  description: string;
  details: Record<string, unknown>;
  detectedAt: Date;
}

export interface BalanceDiscrepancy {
  userId: string;
  userEmail: string;
  backendBalance: number;
  onchainBalance: number;
  difference: number;
  toleranceThreshold: number;
  isWithinTolerance: boolean;
  discrepancyStatus: DiscrepancyStatus;
  detectedAt: Date;
  resolvedAt?: Date;
  resolutionNotes?: string;
}

export interface LedgerConsistencyReport {
  totalUsersChecked: number;
  usersWithDiscrepancies: number;
  usersWithinTolerance: number;
  totalDiscrepancyAmount: number;
  averageDiscrepancy: number;
  maxDiscrepancy: number;
  minDiscrepancy: number;
  discrepanciesBySeverity: Record<Severity, number>;
  discrepanciesByType: Record<InconsistencyType, number>;
  balanceDiscrepancies: BalanceDiscrepancy[];
}

@Entity('reconciliation_reports')
@Index(['status'])
@Index(['type'])
@Index(['createdAt'])
@Index(['status', 'createdAt'])
export class ReconciliationReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ReportStatus,
    default: ReportStatus.RUNNING,
  })
  status: ReportStatus;

  @Column({
    type: 'enum',
    enum: ReportType,
  })
  type: ReportType;

  @Column({ name: 'started_at', type: 'timestamp' })
  startedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  // Existing counters
  @Column({ name: 'negative_balance_count', type: 'int', default: 0 })
  negativeBalanceCount: number;

  @Column({ name: 'orphaned_bet_count', type: 'int', default: 0 })
  orphanedBetCount: number;

  @Column({ name: 'mismatched_settlement_count', type: 'int', default: 0 })
  mismatchedSettlementCount: number;

  @Column({ name: 'stuck_pending_settlement_count', type: 'int', default: 0 })
  stuckPendingSettlementCount: number;

  // New ledger consistency counters
  @Column({ name: 'ledger_mismatch_count', type: 'int', default: 0 })
  ledgerMismatchCount: number;

  @Column({ name: 'onchain_discrepancy_count', type: 'int', default: 0 })
  onchainDiscrepancyCount: number;

  @Column({ name: 'offchain_discrepancy_count', type: 'int', default: 0 })
  offchainDiscrepancyCount: number;

  @Column({ name: 'rounding_difference_count', type: 'int', default: 0 })
  roundingDifferenceCount: number;

  @Column({ name: 'total_inconsistencies', type: 'int', default: 0 })
  totalInconsistencies: number;

  // Ledger consistency specific fields
  @Column({
    name: 'tolerance_threshold',
    type: 'decimal',
    precision: 10,
    scale: 8,
    nullable: true,
  })
  toleranceThreshold: number | null;

  @Column({ name: 'total_users_checked', type: 'int', default: 0 })
  totalUsersChecked: number;

  @Column({ name: 'users_with_discrepancies', type: 'int', default: 0 })
  usersWithDiscrepancies: number;

  @Column({ name: 'users_within_tolerance', type: 'int', default: 0 })
  usersWithinTolerance: number;

  @Column({
    name: 'total_discrepancy_amount',
    type: 'decimal',
    precision: 18,
    scale: 8,
    default: 0,
  })
  totalDiscrepancyAmount: number;

  @Column({
    name: 'average_discrepancy',
    type: 'decimal',
    precision: 18,
    scale: 8,
    default: 0,
  })
  averageDiscrepancy: number;

  @Column({
    name: 'max_discrepancy',
    type: 'decimal',
    precision: 18,
    scale: 8,
    default: 0,
  })
  maxDiscrepancy: number;

  @Column({
    name: 'min_discrepancy',
    type: 'decimal',
    precision: 18,
    scale: 8,
    default: 0,
  })
  minDiscrepancy: number;

  @Column({ type: 'json', nullable: true })
  inconsistencies: Inconsistency[] | null;

  @Column({ name: 'ledger_consistency_data', type: 'json', nullable: true })
  ledgerConsistencyData: LedgerConsistencyReport | null;

  @Column({ name: 'balance_discrepancies', type: 'json', nullable: true })
  balanceDiscrepancies: BalanceDiscrepancy[] | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
