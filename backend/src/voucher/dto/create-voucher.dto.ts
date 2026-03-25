import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateVoucherDto {
  @IsString()
  campaignName: string;

  @IsNumber()
  amount: number;

  @IsDateString()
  expiryDate: string;

  @IsOptional()
  @IsNumber()
  usageLimitPerUser?: number;

  @IsOptional()
  @IsNumber()
  maxGlobalUsage?: number;
}