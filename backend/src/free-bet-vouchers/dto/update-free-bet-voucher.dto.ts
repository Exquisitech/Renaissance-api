import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateFreeBetVoucherDto {
  @ApiPropertyOptional({
    description: 'Updated voucher amount',
    example: 100.0,
    minimum: 0.00000001,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  @ApiPropertyOptional({
    description: 'Updated expiration date (ISO 8601)',
    example: '2026-06-23T12:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { note: 'Extended for special event' },
    type: 'object',
  })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Maximum active vouchers per user',
    example: 5,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxActiveVouchersPerUser?: number;
}
