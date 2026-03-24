import { IsNumber, IsString, Min, Max, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSpinDto {
  @ApiProperty({
    description: 'Amount to stake on the spin',
    example: 10.0,
    minimum: 0.01,
    maximum: 1000,
  })
  @IsNumber()
  @Min(0.01, { message: 'Stake amount must be at least 0.01' })
  @Max(1000, { message: 'Stake amount cannot exceed 1000' })
  @Transform(({ value }) => parseFloat(value))
  stakeAmount: number;

  @ApiPropertyOptional({
    description:
      'Optional client-provided seed for additional randomness (enhances transparency)',
    example: 'my-random-seed-12345',
  })
  @IsString()
  @IsOptional()
  clientSeed?: string; // Optional client-provided seed for additional randomness
  @IsOptional()
  isFreeBet?: boolean; // When true, any payout should be flagged non-withdrawable
}
