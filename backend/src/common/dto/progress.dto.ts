import { ApiProperty } from '@nestjs/swagger';

export class ProgressDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  currentWinStreak: number;

  @ApiProperty()
  highestWinStreak: number;

  @ApiProperty()
  totalLifetimeSpins: number;

  @ApiProperty()
  totalEarnings: number;

  @ApiProperty()
  accuracy: number;

  @ApiProperty()
  totalBets: number;

  @ApiProperty()
  betsWon: number;

  @ApiProperty()
  betsLost: number;

  @ApiProperty()
  totalStaked: number;

  @ApiProperty()
  spinsToday: number;

  @ApiProperty()
  maxSpinStreak: number;
}
