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

export class CreateFreeBetVoucherDto {
  @IsUUID()
  userId: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsDateString()
  expiresAt: string;

  @IsOptional()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxActiveVouchersPerUser?: number;

  @IsOptional()
  @IsString()
  @IsIn(['MANUAL', 'SPIN', 'PROMOTION', 'COMPENSATION'])
  sourceType?: 'MANUAL' | 'SPIN' | 'PROMOTION' | 'COMPENSATION';

  @IsOptional()
  @IsString()
  sourceReferenceId?: string;
}
