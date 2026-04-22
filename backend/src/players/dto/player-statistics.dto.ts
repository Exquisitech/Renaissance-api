import { IsNumber, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class PlayerStatisticsDto {
  @ApiPropertyOptional({ 
    description: 'Player ID from external API', 
    example: 276 
  })
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  playerId: number;

  @ApiPropertyOptional({ 
    description: 'Filter by league ID', 
    example: 39 
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  league?: number;

  @ApiPropertyOptional({ 
    description: 'Filter by season year', 
    example: 2023 
  })
  @IsOptional()
  @IsNumber()
  @Min(2000)
  @Transform(({ value }) => parseInt(value))
  season?: number;
}
