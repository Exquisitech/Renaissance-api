import { IsString, IsEnum, IsOptional, IsNotEmpty, IsObject, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TransactionType } from '../entities/blockchain-transaction.entity';

export class SubmitTransactionDto {
  @ApiProperty({
    description: 'Base64 encoded transaction XDR',
    example: 'AAAAAgAAA...',
  })
  @IsString()
  @IsNotEmpty()
  transactionXdr: string;

  @ApiProperty({
    description: 'Transaction type',
    enum: TransactionType,
    example: TransactionType.PAYMENT,
  })
  @IsEnum(TransactionType)
  @IsNotEmpty()
  type: TransactionType;

  @ApiProperty({
    description: 'Stellar public key (if not using authenticated user wallet)',
    example: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    required: false,
  })
  @IsString()
  @IsOptional()
  publicKey?: string;

  @ApiProperty({
    description: 'Additional metadata',
    example: { purpose: 'bet_placement', betId: '123' },
    required: false,
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiProperty({
    description: 'Required confirmations',
    default: 1,
    required: false,
  })
  @Min(1)
  @IsOptional()
  requiredConfirmations?: number;
}

export class TransactionStatusResponseDto {
  @ApiProperty({ description: 'Transaction ID' })
  id: string;

  @ApiProperty({ description: 'Transaction hash' })
  hash: string;

  @ApiProperty({ 
    description: 'Transaction status',
    enum: ['pending', 'submitted', 'confirmed', 'failed', 'timeout'],
  })
  status: string;

  @ApiProperty({ description: 'Transaction type', enum: TransactionType })
  type: TransactionType;

  @ApiProperty({ description: 'Number of confirmations' })
  confirmations: number;

  @ApiProperty({ description: 'Required confirmations' })
  requiredConfirmations: number;

  @ApiProperty({ description: 'Ledger number', required: false })
  ledger?: number;

  @ApiProperty({ description: 'Error message', required: false })
  errorMessage?: string;

  @ApiProperty({ description: 'Submitted timestamp', required: false })
  submittedAt?: Date;

  @ApiProperty({ description: 'Confirmed timestamp', required: false })
  confirmedAt?: Date;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;
}

export class SubmitTransactionResponseDto {
  @ApiProperty({ description: 'Success flag' })
  success: boolean;

  @ApiProperty({ description: 'Transaction ID' })
  transactionId: string;

  @ApiProperty({ description: 'Transaction hash' })
  hash: string;

  @ApiProperty({ description: 'Status response', type: TransactionStatusResponseDto })
  status: TransactionStatusResponseDto;
}

export class TransactionReceiptDto {
  @ApiProperty({ description: 'Transaction ID' })
  transactionId: string;

  @ApiProperty({ description: 'Transaction hash' })
  hash: string;

  @ApiProperty({ description: 'Status' })
  status: string;

  @ApiProperty({ description: 'Type' })
  type: TransactionType;

  @ApiProperty({ description: 'Ledger number', required: false })
  ledger?: number;

  @ApiProperty({ description: 'Confirmations' })
  confirmations: number;

  @ApiProperty({ description: 'Result XDR', required: false })
  resultXdr?: string;

  @ApiProperty({ description: 'Metadata', required: false })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Timestamp' })
  timestamp: Date;
}
