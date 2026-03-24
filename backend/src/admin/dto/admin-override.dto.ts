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
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AdminOverrideAction,
  OverrideStatus,
} from '../entities/admin-override-log.entity';

// Base DTO for all override actions
export class BaseOverrideDto {
  @IsString()
  reason: string;

  @IsOptional()
  @IsBoolean()
  requiresOnChainApproval?: boolean;
}

// Balance Adjustment DTO
export class BalanceAdjustmentDto extends BaseOverrideDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsEnum(['add', 'subtract'])
  operation: 'add' | 'subtract';

  @IsOptional()
  @IsString()
  description?: string;
}

// Bet Outcome Correction DTO
export class BetOutcomeCorrectionDto extends BaseOverrideDto {
  @IsUUID()
  betId: string;

  @IsEnum(['won', 'lost', 'void', 'pending'])
  newOutcome: 'won' | 'lost' | 'void' | 'pending';

  @IsOptional()
  @IsNumber()
  @IsPositive()
  payoutAmount?: number;

  @IsOptional()
  @IsString()
  outcomeReason?: string;
}

// Free Bet Voucher Issuance DTO
export class FreeBetVoucherIssuanceDto extends BaseOverrideDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsDate()
  @Type(() => Date)
  expiresAt: Date;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  metadata?: string;
}

// Spin Reward Reversal DTO
export class SpinRewardReversalDto extends BaseOverrideDto {
  @IsUUID()
  spinId: string;

  @IsOptional()
  @IsString()
  reversalReason?: string;
}

// Override Approval DTO
export class OverrideApprovalDto {
  @IsUUID()
  overrideId: string;

  @IsBoolean()
  approved: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}

// Override Reversal DTO
export class OverrideReversalDto {
  @IsUUID()
  overrideId: string;

  @IsString()
  reason: string;
}

// Query DTOs for filtering
export class OverrideQueryDto {
  @IsOptional()
  @IsEnum(AdminOverrideAction)
  actionType?: AdminOverrideAction;

  @IsOptional()
  @IsEnum(OverrideStatus)
  status?: OverrideStatus;

  @IsOptional()
  @IsUUID()
  adminId?: string;

  @IsOptional()
  @IsUUID()
  affectedUserId?: string;

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
