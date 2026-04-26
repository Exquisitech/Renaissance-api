import {
  IsUUID,
  IsNumber,
  IsPositive,
  IsDateString,
  IsOptional,
  IsInt,
  Min,
  IsIn,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFreeBetVoucherDto {
  @ApiProperty({
    description: 'User ID to receive the free bet voucher',
    example: '456e7890-e12b-34d5-a678-901234567890',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Amount of the free bet (must be positive)',
    example: 50.0,
    minimum: 0.00000001,
  })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    description: 'Expiration date for the voucher (ISO 8601)',
    example: '2026-05-23T12:00:00Z',
  })
  @IsDateString()
  expiresAt: string;

  @ApiPropertyOptional({
    description: 'Maximum number of active vouchers per user allowed (defaults to system config)',
    example: 3,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxActiveVouchersPerUser?: number;

  @ApiPropertyOptional({
    description: 'Source type of the voucher',
    enum: ['MANUAL', 'SPIN', 'PROMOTION', 'COMPENSATION'],
    example: 'PROMOTION',
    default: 'MANUAL',
  })
  @IsOptional()
  @IsIn(['MANUAL', 'SPIN', 'PROMOTION', 'COMPENSATION'])
  sourceType?: 'MANUAL' | 'SPIN' | 'PROMOTION' | 'COMPENSATION';

  @ApiPropertyOptional({
    description: 'Reference ID for the source (e.g., spin ID, promotion ID)',
    example: 'spin_12345',
  })
  @IsOptional()
  @IsString()
  sourceReferenceId?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { campaign: 'welcome_bonus' },
    type: 'object',
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
