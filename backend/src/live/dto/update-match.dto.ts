import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MatchStatus } from '../../common/enums/match.enums';

export class UpdateMatchDto {
  @ApiProperty({ description: 'Match UUID' })
  @IsString()
  matchId: string;

  @ApiProperty({ description: 'Home team score' })
  @IsNumber()
  @Min(0)
  homeScore: number;

  @ApiProperty({ description: 'Away team score' })
  @IsNumber()
  @Min(0)
  awayScore: number;

  @ApiPropertyOptional({ enum: MatchStatus })
  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;

  @ApiPropertyOptional({ description: 'Unix timestamp (ms)' })
  @IsOptional()
  @IsNumber()
  timestamp?: number;

  @ApiPropertyOptional({ description: 'Minute of the match (0-120)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minute?: number;

  @ApiPropertyOptional({ description: 'Extra match metadata (events, etc.)' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
