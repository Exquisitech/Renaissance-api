import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsUUID,
  IsBoolean,
  IsDate,
  ValidateNested,
  IsPositive,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AdminOverrideAction,
  OverrideStatus,
} from '../entities/admin-override-log.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Base DTO for all override actions
export class BaseOverrideDto {
  @ApiProperty({
    description: 'Reason for the override (for audit trail)',
    example: 'Manual correction for system error',
    minLength: 5,
  })
  @IsString()
  reason: string;

  @ApiPropertyOptional({
    description: 'Whether this override requires on-chain approval',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  requiresOnChainApproval?: boolean;
}

// Balance Adjustment DTO
export class BalanceAdjustmentDto extends BaseOverrideDto {
  @ApiProperty({
    description: 'Amount to adjust by',
    example: 100.0,
    minimum: 0.00000001,
  })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    description: 'Operation type',
    enum: ['add', 'subtract'],
    example: 'add',
  })
  @IsEnum(['add', 'subtract'])
  operation: 'add' | 'subtract';

  @ApiPropertyOptional({
    description: 'Additional description',
    example: 'Welcome bonus credit',
  })
  @IsOptional()
  @IsString()
  description?: string;
}

// Bet Outcome Correction DTO
export class BetOutcomeCorrectionDto extends BaseOverrideDto {
  @ApiProperty({
    description: 'Bet ID to correct',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  betId: string;

  @ApiProperty({
    description: 'New outcome for the bet',
    enum: ['won', 'lost', 'void', 'pending'],
    example: 'won',
  })
  @IsEnum(['won', 'lost', 'void', 'pending'])
  newOutcome: 'won' | 'lost' | 'void' | 'pending';

  @ApiPropertyOptional({
    description: 'Payout amount if outcome is won',
    example: 250.0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  payoutAmount?: number;

  @ApiPropertyOptional({
    description: 'Reason for outcome change',
    example: 'Match score correction',
  })
  @IsOptional()
  @IsString()
  outcomeReason?: string;
}

// Free Bet Voucher Issuance DTO
export class FreeBetVoucherIssuanceDto extends BaseOverrideDto {
  @ApiProperty({
    description: 'Voucher amount',
    example: 50.0,
    minimum: 0.01,
  })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    description: 'Voucher expiration date',
    example: '2026-05-23T12:00:00Z',
  })
  @IsDate()
  @Type(() => Date)
  expiresAt: Date;

  @ApiPropertyOptional({
    description: 'Voucher description',
    example: 'Welcome bonus free bet',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata as JSON string',
    example: '{ "campaign": "welcome" }',
  })
  @IsOptional()
  @IsString()
  metadata?: string;
}

// Spin Reward Reversal DTO
export class SpinRewardReversalDto extends BaseOverrideDto {
  @ApiProperty({
    description: 'ID of the spin transaction to reverse',
    example: 'spin_12345',
  })
  @IsUUID()
  spinId: string;

  @ApiPropertyOptional({
    description: 'Reason for the reversal',
    example: 'Duplicate spin detected',
  })
  @IsOptional()
  @IsString()
  reversalReason?: string;
}

// Override Approval DTO
export class OverrideApprovalDto {
  @ApiProperty({
    description: 'ID of the pending override request',
    example: 'override_req_123',
  })
  @IsUUID()
  overrideId: string;

  @ApiProperty({
    description: 'Approve or reject the override',
    example: true,
  })
  @IsBoolean()
  approved: boolean;

  @ApiPropertyOptional({
    description: 'Notes for approval/rejection',
    example: 'Approved - valid user request',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

// Override Reversal DTO
export class OverrideReversalDto {
  @ApiProperty({
    description: 'ID of the executed override to reverse',
    example: 'override_req_123',
  })
  @IsUUID()
  overrideId: string;

  @ApiProperty({
    description: 'Reason for reversing the override',
    example: 'User appeal approved - original error confirmed',
    minLength: 5,
  })
  @IsString()
  reason: string;
}

// Query DTOs for filtering
export class OverrideQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by action type',
    enum: AdminOverrideAction,
  })
  @IsOptional()
  @IsEnum(AdminOverrideAction)
  actionType?: AdminOverrideAction;

  @ApiPropertyOptional({
    description: 'Filter by override status',
    enum: OverrideStatus,
  })
  @IsOptional()
  @IsEnum(OverrideStatus)
  status?: OverrideStatus;

  @ApiPropertyOptional({
    description: 'Filter by admin user ID',
    example: '456e7890-e12b-34d5-a678-901234567890',
  })
  @IsOptional()
  @IsUUID()
  adminId?: string;

  @ApiPropertyOptional({
    description: 'Filter by affected user ID',
    example: '456e7890-e12b-34d5-a678-901234567890',
  })
  @IsOptional()
  @IsUUID()
  affectedUserId?: string;

  @ApiPropertyOptional({
    description: 'Filter start date (ISO 8601)',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @ApiPropertyOptional({
    description: 'Filter end date (ISO 8601)',
    example: '2024-01-31T23:59:59Z',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    example: 50,
    minimum: 1,
    maximum: 100,
    default: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 50;
}
