import { IsOptional, IsString, IsNumber, IsEnum, IsBoolean } from 'class-validator';
import { DistributionStatus } from '../entities/treasury-distribution.entity';

export class WinnerDto {
  @IsString()
  userId: string;

  @IsString()
  betId: string;

  @IsNumber()
  stakeAmount: number;

  @IsNumber()
  odds: number;

  @IsNumber()
  potentialPayout: number;

  @IsNumber()
  prizeAmount: number;
}

export class DistributePrizesDto {
  @IsString()
  @IsOptional()
  batchId?: string;

  @IsNumber()
  @IsOptional()
  maxTotalAmount?: number;

  @IsBoolean()
  @IsOptional()
  allowPartialDistribution?: boolean;
}

export class TreasuryDistributionResponseDto {
  batchId: string;
  status: DistributionStatus;
  totalWinners: number;
  totalPrizeAmount: number;
  distributedAmount: number;
  pendingAmount: number;
  transactionHash?: string;
}
