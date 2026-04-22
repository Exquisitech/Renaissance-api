import { IsString, IsOptional, IsNumber, MaxLength, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class SearchPlayerDto {
  @ApiPropertyOptional({ 
    description: 'Search query for player name (partial matching)', 
    example: 'messi' 
  })
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  query: string;

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

  @ApiPropertyOptional({ 
    description: 'Number of results to return', 
    example: 20,
    default: 10 
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value))
  limit?: number;
}
