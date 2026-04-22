import { IsString, IsOptional, IsNumber, IsEnum, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export enum TimeFrame {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  ALL_TIME = 'all-time'
}

export enum RankingType {
  EARNERS = 'earners',
  STAKERS = 'stakers',
  PREDICTORS = 'predictors'
}

export class RankingQueryDto {
  @ApiPropertyOptional({ 
    description: 'Page number for pagination', 
    example: 1,
    default: 1 
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  page?: number = 1;

  @ApiPropertyOptional({ 
    description: 'Number of results per page', 
    example: 10,
    default: 10 
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value))
  limit?: number = 10;

  @ApiPropertyOptional({ 
    description: 'Time frame for rankings', 
    enum: TimeFrame,
    example: TimeFrame.ALL_TIME,
    default: TimeFrame.ALL_TIME 
  })
  @IsOptional()
  @IsEnum(TimeFrame)
  timeFrame?: TimeFrame = TimeFrame.ALL_TIME;

  @ApiPropertyOptional({ 
    description: 'Filter by specific user ID', 
    example: '123e4567-e89b-12d3-a456-426614174000' 
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  userId?: string;
}
