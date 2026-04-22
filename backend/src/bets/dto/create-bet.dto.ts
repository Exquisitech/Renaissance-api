import {
  IsUUID,
  IsNumber,
  IsEnum,
  IsPositive,
  Min,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MatchOutcome } from '../../common/enums/match.enums';

export class CreateBetDto {
  @ApiProperty({
    description: 'UUID of the match to bet on',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  

  @ApiProperty({
    description: 'Amount to stake on the bet (must be greater than 0)',
    example: 100.5,
    minimum: 0.00000001,
    type: Number,
  })
  @IsNumber()
  @IsPositive()
  @Min(0.00000001, { message: 'Stake amount must be greater than 0' })
  stakeAmount: number;

  @ApiProperty({
    description: 'Predicted outcome of the match',
    enum: MatchOutcome,
    example: MatchOutcome.HOME_WIN,
    enumName: 'MatchOutcome',
  })
  @IsEnum(MatchOutcome, {
    message: 'predictedOutcome must be one of: home_win, away_win, draw',
  })
  predictedOutcome: MatchOutcome;

  @ApiPropertyOptional({
    description:
      'Optional free bet voucher ID. When provided, stake is taken from voucher (non-withdrawable). Voucher is consumed upon use.',
    example: '987e6543-e21b-12d3-a456-426614174999',
  })
  @IsOptional()
  @IsUUID()
  voucherId?: string;

    matchId: string;
  stakeAmount: number;
  predictedOutcome: MatchOutcome;
}
