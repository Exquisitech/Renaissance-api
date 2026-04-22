import { IsEnum, IsOptional, IsString, IsInt, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { FraudStatus, RiskLevel } from '../entities/fraud.entity';

export class UpdateFraudStatusDto {
  @IsEnum(FraudStatus)
  status!: FraudStatus;

  @IsOptional()
  @IsString()
  reviewNotes?: string;
}

export class FraudQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEnum(FraudStatus)
  status?: FraudStatus;

  @IsOptional()
  @IsEnum(RiskLevel)
  riskLevel?: RiskLevel;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class BlockUserDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
