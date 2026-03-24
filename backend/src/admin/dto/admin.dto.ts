import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsUUID,
} from 'class-validator';
import { AdminActionType } from '../entities/admin-audit-log.entity';

export class CancelBetDto {
  @IsString()
  reason: string;
}

export class CorrectBalanceDto {
  @IsNumber()
  newBalance: number;

  @IsString()
  reason: string;
}

export class CorrectMatchDto {
  @IsOptional()
  @IsNumber()
  homeScore?: number;

  @IsOptional()
  @IsNumber()
  awayScore?: number;

  @IsString()
  reason: string;
}

export class AdminAuditLogDto {
  @IsUUID()
  adminId: string;

  @IsEnum(AdminActionType)
  actionType: AdminActionType;

  @IsOptional()
  @IsString()
  affectedEntityId?: string;

  @IsOptional()
  @IsString()
  affectedEntityType?: string;

  @IsString()
  reason: string;

  @IsOptional()
  previousValues?: Record<string, any>;

  @IsOptional()
  newValues?: Record<string, any>;

  @IsOptional()
  metadata?: Record<string, any>;
}
