import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateMatchOddsDto {
  @ApiProperty({ example: 1.72, minimum: 1.01 })
  @Type(() => Number)
  @IsNumber()
  @Min(1.01)
  homeOdds: number;

  @ApiProperty({ example: 3.35, minimum: 1.01 })
  @Type(() => Number)
  @IsNumber()
  @Min(1.01)
  drawOdds: number;

  @ApiProperty({ example: 4.2, minimum: 1.01 })
  @Type(() => Number)
  @IsNumber()
  @Min(1.01)
  awayOdds: number;

  @ApiPropertyOptional({ example: 'Trader manual repricing after injury update' })
  @IsOptional()
  @IsString()
  reason?: string;
}
