import { IsOptional, IsIn } from 'class-validator';

export class ExportQueryDto {
  @IsOptional()
  @IsIn(['csv', 'json'])
  format?: 'csv' | 'json';
}
