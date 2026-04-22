import { IsString, IsNumber, IsOptional, IsNotEmpty, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class WithdrawalRequestDto {
  @ApiProperty({
    description: 'Amount to withdraw in XLM',
    example: 10.5,
    minimum: 0.5,
  })
  @IsNumber()
  @Min(0.5)
  @Transform(({ value }) => parseFloat(value))
  amount: number;

  @ApiProperty({
    description: 'Stellar destination address',
    example: 'GABCDEF1234567890ABCDEF1234567890ABCDEF12',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(56)
  @Transform(({ value }) => value?.trim())
  destinationAddress: string;

  @ApiPropertyOptional({
    description: 'Optional memo for the transaction',
    example: 'Withdrawal for user123',
    maxLength: 28,
  })
  @IsOptional()
  @IsString()
  @MaxLength(28)
  @Transform(({ value }) => value?.trim())
  memo?: string;
}

export class DepositTrackingDto {
  @ApiProperty({
    description: 'Amount deposited in XLM',
    example: 25.0,
  })
  @IsNumber()
  @Min(0.0000001)
  @Transform(({ value }) => parseFloat(value))
  amount: number;

  @ApiProperty({
    description: 'Source address from which funds were sent',
    example: 'GABCDEF1234567890ABCDEF1234567890ABCDEF12',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(56)
  @Transform(({ value }) => value?.trim())
  sourceAddress: string;

  @ApiProperty({
    description: 'Blockchain transaction hash',
    example: 'abc123def4567890abc123def4567890abc123def4567890abc123def4567890',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Transform(({ value }) => value?.trim())
  transactionHash: string;
}

export class TransactionQueryDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of transactions per page',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value))
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filter by transaction type',
    enum: ['CREDIT', 'DEBIT'],
    example: 'CREDIT',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  type?: string;

  @ApiPropertyOptional({
    description: 'Filter by transaction source',
    enum: ['BET', 'STAKE', 'REWARD', 'DEPOSIT', 'WITHDRAWAL'],
    example: 'DEPOSIT',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  source?: string;
}
