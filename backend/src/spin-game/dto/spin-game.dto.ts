import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  IsBoolean,
  IsDate,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum RewardType {
  XLM_REWARD = 'XLM_REWARD',
  NFT_REWARD = 'NFT_REWARD',
  FREE_BET_REWARD = 'FREE_BET_REWARD',
  LOSS = 'LOSS',
}

export enum NFTTier {
  COMMON = 'COMMON',
  RARE = 'RARE',
  EPIC = 'EPIC',
  LEGENDARY = 'LEGENDARY',
}

export class SpinRequestDto {
  @ApiProperty({
    description: 'Amount of XLM to stake (minimum 10 XLM)',
    minimum: 10,
    example: 10,
  })
  @IsNumber()
  @Min(10)
  @Max(1000)
  stakeAmount: number;

  @ApiPropertyOptional({
    description: 'Client seed for provably fair randomness',
    example: 'user_provided_random_seed_123',
  })
  @IsOptional()
  @IsString()
  clientSeed?: string;

  @ApiPropertyOptional({
    description: 'Accept terms and conditions',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  acceptTerms?: boolean;
}

export class SpinResultDto {
  @ApiProperty()
  spinId: string;

  @ApiProperty({ enum: RewardType })
  rewardType: RewardType;

  @ApiProperty()
  rewardValue: string;

  @ApiPropertyOptional()
  winAmount?: number;

  @ApiProperty()
  stakeAmount: number;

  @ApiProperty()
  isWin: boolean;

  @ApiProperty()
  verification: {
    clientSeed: string;
    serverSeedHash: string;
    nonce: string;
    finalHash: string;
    randomValue: number;
  };

  @ApiProperty()
  timestamp: Date;

  @ApiPropertyOptional()
  message?: string;

  @ApiPropertyOptional()
  nextSpinAvailableAt?: Date;
}

export class SpinHistoryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  stakeAmount: number;

  @ApiProperty({ enum: RewardType })
  rewardType: RewardType;

  @ApiProperty()
  rewardValue: string;

  @ApiPropertyOptional()
  winAmount?: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  isSuspicious?: boolean;
}

export class FreeBetDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  expiresAt: Date;

  @ApiProperty()
  isUsed: boolean;

  @ApiProperty()
  source: string;

  @ApiProperty()
  isWithdrawable: boolean;

  @ApiProperty()
  daysRemaining: number;
}

export class NFTRewardDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: NFTTier })
  tier: NFTTier;

  @ApiProperty()
  nftId: string;

  @ApiProperty()
  isMinted: boolean;

  @ApiPropertyOptional()
  metadataUri?: string;

  @ApiProperty()
  isWithdrawable: boolean;

  @ApiPropertyOptional()
  rarityScore?: number;
}

export class UserSpinStatsDto {
  @ApiProperty()
  totalSpins: number;

  @ApiProperty()
  totalStaked: number;

  @ApiProperty()
  totalWon: number;

  @ApiProperty()
  netProfit: number;

  @ApiProperty()
  winRate: number;

  @ApiProperty()
  spinsToday: number;

  @ApiProperty()
  remainingDailySpins: number;

  @ApiProperty()
  currentStreak: number;

  @ApiProperty()
  maxStreak: number;

  @ApiProperty()
  lastSpinDate: Date | null;
}

export class VerifySpinDto {
  @ApiProperty()
  clientSeed: string;

  @ApiProperty()
  serverSeed: string;

  @ApiProperty()
  nonce: string;

  @ApiProperty()
  expectedHash: string;
}

export class SpinEligibilityDto {
  @ApiProperty()
  isEligible: boolean;

  @ApiPropertyOptional()
  reason?: string;

  @ApiPropertyOptional()
  nextAvailableAt?: Date;

  @ApiProperty()
  remainingDailySpins: number;

  @ApiProperty()
  dailyStakeLimit: number;

  @ApiProperty()
  minimumStake: number;

  @ApiProperty()
  maximumStake: number;
}
