import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminActionType } from '../entities/admin-audit-log.entity';

export class CancelBetDto {
  @ApiProperty({
    description: 'Reason for cancelling the bet',
    example: 'User requested cancellation before match started',
    minLength: 5,
  })
  @IsString()
  reason: string;
}

export class CorrectBalanceDto {
  @ApiProperty({
    description: 'New wallet balance amount',
    example: 5000.5,
    minimum: 0,
  })
  @IsNumber()
  newBalance: number;

  @ApiProperty({
    description: 'Reason for the balance correction',
    example: 'Manual adjustment - bonus payout',
    minLength: 5,
  })
  @IsString()
  reason: string;
}

export class CorrectMatchDto {
  @ApiPropertyOptional({
    description: 'Home team score',
    example: 2,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Home score cannot be negative' })
  homeScore?: number;

  @ApiPropertyOptional({
    description: 'Away team score',
    example: 1,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Away score cannot be negative' })
  awayScore?: number;

  @ApiPropertyOptional({
    description: 'Match outcome/result',
    enum: ['home_win', 'away_win', 'draw'],
    example: 'home_win',
  })
  @IsOptional()
  @IsEnum(['home_win', 'away_win', 'draw'])
  outcome?: string;

  @ApiProperty({
    description: 'Reason for the correction',
    example: 'Data entry error - corrected scores',
    minLength: 5,
  })
  @IsString()
  reason: string;
}

export class AdminAuditLogDto {
  @ApiProperty({
    description: 'Admin user UUID',
    example: 'admin-123-uuid',
  })
  @IsUUID()
  adminId: string;

  @ApiProperty({
    description: 'Type of action performed',
    enum: AdminActionType,
    example: AdminActionType.BET_CANCELLED,
  })
  @IsEnum(AdminActionType)
  actionType: AdminActionType;

  @ApiPropertyOptional({
    description: 'ID of affected entity',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  affectedEntityId?: string;

  @ApiPropertyOptional({
    description: 'Type of affected entity',
    example: 'bet',
  })
  @IsOptional()
  @IsString()
  affectedEntityType?: string;

  @ApiProperty({
    description: 'Reason for the action',
    example: 'User request',
  })
  @IsString()
  reason: string;

  @ApiPropertyOptional({
    description: 'Previous values before change',
    type: 'object',
  })
  @IsOptional()
  previousValues?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'New values after change',
    type: 'object',
  })
  @IsOptional()
  newValues?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    type: 'object',
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
