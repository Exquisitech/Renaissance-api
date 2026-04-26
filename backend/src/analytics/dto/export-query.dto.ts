import { IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ExportQueryDto {
  @ApiPropertyOptional({
    description: 'Export format (csv or json)',
    enum: ['csv', 'json'],
    example: 'csv',
    default: 'json',
  })
  @IsOptional()
  @IsIn(['csv', 'json'])
  format?: 'csv' | 'json';
}
