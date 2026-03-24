import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsBoolean,
  IsDate,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ValidationStatus,
  TransactionType,
  ValidationType,
  ViolationType,
  ValidationRule,
  ValidationResult,
  IntegrityViolation,
} from '../entities/transaction-validation-report.entity';

// Configuration DTO
export class TransactionValidationConfigDto {
  @IsBoolean()
  enabled: boolean = true;

  @IsOptional()
  @IsBoolean()
  autoRollbackOnCritical: boolean = true;

  @IsOptional()
  @IsNumber()
  @Min(0)
  criticalViolationThreshold: number = 1;

  @IsOptional()
  @IsBoolean()
  validateOnSettlement: boolean = true;

  @IsOptional()
  @IsBoolean()
  validateOnSpin: boolean = true;

  @IsOptional()
  @IsBoolean()
  validateOnStaking: boolean = true;

  @IsOptional()
  @IsString()
  cronSchedule: string = '*/5 * * * *'; // Every 5 minutes for batch validation

  @IsOptional()
  @IsBoolean()
  notifyOnViolations: boolean = true;
}

// Request DTOs
export class ValidateTransactionDto {
  @IsUUID()
  transactionId: string;

  @IsEnum(TransactionType)
  transactionType: TransactionType;

  @IsEnum(ValidationType)
  validationType: ValidationType;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  config?: TransactionValidationConfigDto;
}

export class ValidationQueryDto {
  @IsOptional()
  @IsEnum(TransactionType)
  transactionType?: TransactionType;

  @IsOptional()
  @IsEnum(ValidationStatus)
  status?: ValidationStatus;

  @IsOptional()
  @IsEnum(ValidationType)
  validationType?: ValidationType;

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

export class ViolationResolutionDto {
  @IsUUID()
  violationId: string;

  @IsString()
  resolutionNotes: string;

  @IsOptional()
  @IsBoolean()
  triggerRollback?: boolean = false;
}

// Response DTOs
export class ValidationSummaryDto {
  @IsUUID()
  reportId: string;

  @IsEnum(ValidationStatus)
  status: ValidationStatus;

  @IsEnum(TransactionType)
  transactionType: TransactionType;

  @IsNumber()
  totalChecks: number;

  @IsNumber()
  passedChecks: number;

  @IsNumber()
  failedChecks: number;

  @IsNumber()
  criticalViolations: number;

  @IsBoolean()
  rollbackTriggered: boolean;

  @IsDate()
  completedAt: Date;

  @IsOptional()
  @IsString()
  rollbackReason?: string;
}

export class ValidationResultDto {
  @IsString()
  ruleName: string;

  @IsBoolean()
  passed: boolean;

  @IsOptional()
  actualValue?: any;

  @IsOptional()
  expectedValue?: any;

  @IsOptional()
  @IsString()
  message?: string;

  @IsDate()
  timestamp: Date;
}

export class IntegrityViolationDto {
  @IsEnum(ViolationType)
  type: ViolationType;

  @IsString()
  severity: string;

  @IsString()
  description: string;

  @IsString()
  affectedEntity: string;

  @IsString()
  affectedId: string;

  actualValue: any;

  expectedValue: any;

  @IsDate()
  detectedAt: Date;

  @IsOptional()
  @IsDate()
  resolvedAt?: Date;

  @IsOptional()
  @IsString()
  resolutionNotes?: string;
}

export class TransactionValidationReportDto {
  @IsUUID()
  id: string;

  @IsEnum(ValidationStatus)
  status: ValidationStatus;

  @IsEnum(TransactionType)
  transactionType: TransactionType;

  @IsEnum(ValidationType)
  validationType: ValidationType;

  @IsString()
  transactionId: string;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsDate()
  startedAt: Date;

  @IsOptional()
  @IsDate()
  completedAt?: Date;

  @ValidateNested({ each: true })
  @Type(() => Object)
  validationRules: ValidationRule[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => Object)
  validationResults?: ValidationResult[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => Object)
  violations?: IntegrityViolation[];

  @IsNumber()
  totalChecks: number;

  @IsNumber()
  passedChecks: number;

  @IsNumber()
  failedChecks: number;

  @IsNumber()
  criticalViolations: number;

  @IsBoolean()
  rollbackTriggered: boolean;

  @IsOptional()
  @IsString()
  rollbackReason?: string;

  @IsOptional()
  @IsDate()
  rollbackCompletedAt?: Date;

  @IsOptional()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsDate()
  createdAt: Date;

  @IsDate()
  updatedAt: Date;
}
