import {
  IsOptional,
  IsNumberString,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { TransactionType } from '../entities/transaction.entity';

export class GetTransactionsDto {
  @IsOptional()
  @IsNumberString()
  page?: number;

  @IsOptional()
  @IsNumberString()
  limit?: number;

  // Cursor-based pagination
  @IsOptional()
  cursor?: string;

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}