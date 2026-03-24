import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsBoolean,
  IsDate,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ReportType,
  Severity,
  InconsistencyType,
  DiscrepancyStatus,
} from '../entities/reconciliation-report.entity';

// Configuration DTO
export class ReconciliationConfigDto {
  @IsNumber()
  @Min(0)
  @Max(1)
  toleranceThreshold: number = 0.00000001; // Default 1 satoshi

  @IsOptional()
  @IsBoolean()
  autoCorrectRoundingDifferences: boolean = true;

  @IsOptional()
  @IsNumber()
  @Min(0)
  autoCorrectionThreshold: number = 0.000001; // 0.000001 XLM

  @IsOptional()
  @IsBoolean()
  enableLedgerConsistencyCheck: boolean = true;

  @IsOptional()
  @IsString()
  cronSchedule: string = '0 */6 * * *'; // Every 6 hours

  @IsOptional()
  @IsBoolean()
  notifyOnCriticalDiscrepancies: boolean = true;
}

// Request DTOs
export class RunReconciliationDto {
  @IsEnum(ReportType)
  type: ReportType = ReportType.MANUAL;

  @IsOptional()
  @IsBoolean()
  includeLedgerConsistency: boolean = true;

  @IsOptional()
  config?: ReconciliationConfigDto;
}

export class ReconciliationQueryDto {
  @IsOptional()
  @IsEnum(ReportType)
  type?: ReportType;

  @IsOptional()
  @IsEnum(Severity)
  severity?: Severity;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number = 50;
}

export class DiscrepancyResolutionDto {
  @IsUUID()
  discrepancyId: string;

  @IsEnum(DiscrepancyStatus)
  status: DiscrepancyStatus;

  @IsOptional()
  @IsString()
  resolutionNotes?: string;

  @IsOptional()
  @IsBoolean()
  autoCorrect?: boolean = false;
}

// Response DTOs
export class ReconciliationSummaryDto {
  @IsUUID()
  reportId: string;

  @IsEnum(ReportType)
  type: ReportType;

  @IsEnum(Severity)
  highestSeverity: Severity;

  @IsNumber()
  totalInconsistencies: number;

  @IsNumber()
  criticalIssues: number;

  @IsNumber()
  highIssues: number;

  @IsNumber()
  mediumIssues: number;

  @IsNumber()
  lowIssues: number;

  @IsDate()
  completedAt: Date;

  @IsOptional()
  @IsNumber()
  totalUsersChecked?: number;

  @IsOptional()
  @IsNumber()
  usersWithDiscrepancies?: number;

  @IsOptional()
  @IsNumber()
  usersWithinTolerance?: number;

  @IsOptional()
  @IsNumber()
  totalDiscrepancyAmount?: number;
}

export class BalanceDiscrepancyDto {
  @IsUUID()
  userId: string;

  @IsString()
  userEmail: string;

  @IsNumber()
  backendBalance: number;

  @IsNumber()
  onchainBalance: number;

  @IsNumber()
  difference: number;

  @IsNumber()
  toleranceThreshold: number;

  @IsBoolean()
  isWithinTolerance: boolean;

  @IsEnum(DiscrepancyStatus)
  discrepancyStatus: DiscrepancyStatus;

  @IsDate()
  detectedAt: Date;

  @IsOptional()
  @IsDate()
  resolvedAt?: Date;

  @IsOptional()
  @IsString()
  resolutionNotes?: string;
}

// Import the enums for the DTOs
import { ReportStatus } from '../entities/reconciliation-report.entity';
