import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LeaderboardUpdateDto {
  @ApiProperty({ description: 'User UUID' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'New leaderboard rank' })
  @IsNumber()
  @Min(1)
  rank: number;

  @ApiProperty({ description: 'Total winnings' })
  @IsNumber()
  totalWinnings: number;

  @ApiPropertyOptional({ description: 'Betting accuracy (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  bettingAccuracy?: number;

  @ApiPropertyOptional({ description: 'Current winning streak' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  winningStreak?: number;

  @ApiPropertyOptional({ description: 'Total bets placed' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalBets?: number;
}
