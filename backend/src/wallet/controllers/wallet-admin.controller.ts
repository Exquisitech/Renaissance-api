import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { Request } from 'express';
import { WalletRollbackService } from '../services/wallet-rollback.service';
import { WalletService } from '../services/wallet.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { TransactionSource } from '../entities/balance-transaction.entity';
import { User } from '../../users/entities/user.entity';

export class AdminBalanceAdjustmentDto {
  @ApiProperty({
    description: 'Target user ID to adjust balance for',
    example: '456e7890-e12b-34d5-a678-901234567890',
  })
  targetUserId: string;

  @ApiProperty({
    description: 'Amount to adjust',
    example: 1000.5,
  })
  amount: number;

  @ApiProperty({
    description: 'Type of adjustment',
    enum: ['credit', 'debit'],
    example: 'credit',
  })
  adjustmentType: 'credit' | 'debit';

  @ApiProperty({
    description: 'Reason for the adjustment',
    example: 'Manual correction for bonus award',
  })
  reason: string;

  @ApiProperty({
    description: 'Optional reference ID',
    required: false,
    example: 'ref_12345',
  })
  referenceId?: string;
}

export class RollbackTransactionsDto {
  @ApiProperty({
    description: 'List of transaction IDs to rollback',
    type: [String],
    example: ['123e4567-e89b-12d3-a456-426614174000'],
  })
  transactionIds: string[];
}

@ApiTags('Wallet Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(RolesGuard)
@Roles('admin')
@Controller('wallet/admin')
export class WalletAdminController {
  constructor(
    private readonly walletRollbackService: WalletRollbackService,
    private readonly walletService: WalletService,
  ) {}

  @Post('balance-adjustment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin manual balance adjustment with audit trail',
    description:
      'Allows administrators to manually credit or debit a user balance. All adjustments are logged with full audit trail including admin ID, timestamp, and reason.',
  })
  @ApiBody({ type: AdminBalanceAdjustmentDto })
  @ApiResponse({
    status: 200,
    description: 'Balance adjusted successfully',
    schema: {
      example: {
        success: true,
        message: 'Balance adjusted successfully',
        transaction: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          userId: '456e7890-e12b-34d5-a678-901234567890',
          amount: 1000.5,
          type: 'credit',
          balanceAfter: 5500.0,
          source: 'admin_adjustment',
          metadata: {
            reason: 'Manual correction for bonus award',
            referenceId: 'ref_12345',
            adjustedBy: 'admin_123',
          },
          createdAt: '2024-01-15T10:30:00Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid amount or missing fields',
    schema: {
      example: {
        statusCode: 400,
        message: 'Amount must be greater than 0',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - requires admin role',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async adjustBalance(
    @Req() req: Request,
    @Body() dto: AdminBalanceAdjustmentDto,
  ) {
    const admin: User = req.user;
    return await this.walletRollbackService.adminBalanceAdjustment(
      admin.id,
      dto.targetUserId,
      dto.amount,
      dto.adjustmentType,
      dto.reason,
      dto.referenceId,
    );
  }

  @Post('rollback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rollback specific transactions',
    description:
      'Rolls back one or more wallet transactions. This creates reverse transactions and updates balances accordingly.',
  })
  @ApiBody({ type: RollbackTransactionsDto })
  @ApiResponse({
    status: 200,
    description: 'Transactions rolled back successfully',
    schema: {
      example: {
        success: true,
        message: 'Rollback completed',
        rolledBack: 2,
        transactions: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            originalTransactionId: 'original_tx_id',
            type: 'rollback',
            amount: -100.0,
            balanceAfter: 5000.0,
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid transaction IDs',
    schema: {
      example: {
        statusCode: 400,
        message: 'Invalid transaction IDs provided',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - requires admin role',
  })
  async rollbackTransactions(@Req() req: Request, @Body() dto: RollbackTransactionsDto) {
    return await this.walletRollbackService.rollbackTransactions(dto.transactionIds);
  }

  @Get('transactions/:userId')
  @ApiOperation({
    summary: 'Get user transaction history',
    description:
      'Retrieves paginated transaction history for a specific user, including optional rollback records.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User UUID',
    example: '456e7890-e12b-34d5-a678-901234567890',
  })
  @ApiQuery({
    name: 'includeRollbacks',
    required: false,
    type: Boolean,
    description: 'Include rollback transactions in results',
    example: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction history retrieved successfully',
    schema: {
      example: {
        data: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            userId: '456e7890-e12b-34d5-a678-901234567890',
            type: 'bet_win',
            amount: 250.0,
            balanceAfter: 5250.0,
            source: 'bet_settlement',
            referenceId: 'bet_123',
            metadata: { matchId: 'match_123' },
            createdAt: '2024-01-15T10:30:00Z',
          },
        ],
        total: 150,
        page: 1,
        limit: 20,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - requires admin role',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async getUserTransactions(
    @Req() req: Request,
    @Param('userId') userId: string,
    @Query('includeRollbacks') includeRollbacks?: boolean,
  ) {
    return await this.walletRollbackService.getTransactionHistory(
      userId,
      includeRollbacks === true,
    );
  }

  @Get('balance/:userId')
  @ApiOperation({
    summary: 'Get user balance details',
    description: 'Retrieves current wallet balance for a specific user',
  })
  @ApiParam({
    name: 'userId',
    description: 'User UUID',
    example: '456e7890-e12b-34d5-a678-901234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Balance retrieved successfully',
    schema: {
      example: {
        userId: '456e7890-e12b-34d5-a678-901234567890',
        balance: 5000.0,
        currency: 'XLM',
        updatedAt: '2024-01-15T10:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - requires admin role',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async getUserBalance(@Param('userId') userId: string) {
    return await this.walletService.getBalance(userId);
  }
}