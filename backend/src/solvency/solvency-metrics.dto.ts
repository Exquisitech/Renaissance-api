import { ApiProperty } from '@nestjs/swagger';

export class SolvencyMetricsDto {
  @ApiProperty()
  totalLockedBets: number;

  @ApiProperty()
  maxPotentialPayout: number;

  @ApiProperty()
  treasuryBalance: number;

  @ApiProperty()
  coverageRatio: number;

  @ApiProperty()
  spinPoolLiabilities: number;

  @ApiProperty()
  spinPoolSolvency: number;

  @ApiProperty()
  createdAt: Date;
}
