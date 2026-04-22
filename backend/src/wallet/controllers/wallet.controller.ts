import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  DefaultValuePipe,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { HttpCacheInterceptor } from '../../common/cache/interceptors/http-cache.interceptor';
import { CacheKey } from '../../common/cache/decorators/cache-key.decorator';
import { NoCache } from '../../common/cache/decorators/no-cache.decorator';
import { XlmWalletService, WalletBalance, PaginatedTransactions, WithdrawalResult, DepositResult } from '../services/xlm-wallet.service';
import { WithdrawalRequestDto, DepositTrackingDto, TransactionQueryDto } from '../dto/withdrawal.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.guard';
import { UserRole } from '../../users/entities/user.entity';

@ApiTags('Wallet')
@Controller('wallet')
@UseGuards(JwtAuthGuard)
@UseInterceptors(HttpCacheInterceptor)
export class WalletController {
  constructor(private readonly xlmWalletService: XlmWalletService) {}

  @Get('balance')
  @CacheKey('wallet-balance')
  @ApiOperation({
    summary: 'Get user wallet balance',
    description: 'Retrieve current XLM balance including available and locked funds',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({
    status: 200,
    description: 'Wallet balance retrieved successfully',
    schema: {
      example: {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        availableBalance: 125.50,
        lockedBalance: 25.00,
        totalBalance: 150.50,
        lastUpdated: '2024-03-15T12:00:00Z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Wallet not found',
  })
  async getBalance(@Param('userId', ParseUUIDPipe) userId: string): Promise<WalletBalance> {
    return this.xlmWalletService.getWalletBalance(userId);
  }

  @Get(':userId/transactions')
  @CacheKey('wallet-transactions')
  @ApiOperation({
    summary: 'Get transaction history',
    description: 'Retrieve paginated transaction history with optional filtering',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'type', required: false, type: String, description: 'Filter by transaction type' })
  @ApiQuery({ name: 'source', required: false, type: String, description: 'Filter by transaction source' })
  @ApiResponse({
    status: 200,
    description: 'Transaction history retrieved successfully',
    schema: {
      example: {
        data: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            amount: 25.50,
            type: 'CREDIT',
            source: 'DEPOSIT',
            referenceId: 'abc123def456...',
            previousBalance: 100.00,
            newBalance: 125.50,
            createdAt: '2024-03-15T10:30:00Z',
          },
        ],
        total: 50,
        page: 1,
        limit: 10,
        totalPages: 5,
      },
    },
  })
  async getTransactionHistory(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: TransactionQueryDto,
  ): Promise<PaginatedTransactions> {
    return this.xlmWalletService.getTransactionHistory(
      userId,
      query.page,
      query.limit,
      query.type as any,
      query.source as any,
    );
  }

  @Post(':userId/withdraw')
  @NoCache()
  @ApiOperation({
    summary: 'Process withdrawal',
    description: 'Process XLM withdrawal to external Stellar address',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiBody({ type: WithdrawalRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Withdrawal processed successfully',
    schema: {
      example: {
        transactionId: 'withdrawal_1710523400000',
        status: 'pending',
        amount: 10.50,
        fee: 0.00001,
        destinationAddress: 'GABCDEF1234567890ABCDEF1234567890ABCDEF12',
        estimatedCompletion: '2024-03-15T12:05:00Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid withdrawal request',
  })
  @ApiResponse({
    status: 404,
    description: 'Wallet not found',
  })
  async processWithdrawal(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() withdrawalRequest: WithdrawalRequestDto,
  ): Promise<WithdrawalResult> {
    return this.xlmWalletService.processWithdrawal(userId, withdrawalRequest);
  }

  @Post('deposit/track')
  @NoCache()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Track deposit (Admin only)',
    description: 'Track and credit incoming XLM deposit to user wallet',
  })
  @ApiBody({ type: DepositTrackingDto })
  @ApiResponse({
    status: 200,
    description: 'Deposit tracked successfully',
    schema: {
      example: {
        transactionId: 'abc123def4567890abc123def4567890abc123def4567890abc123def4567890',
        amount: 25.00,
        sourceAddress: 'GABCDEF1234567890ABCDEF1234567890ABCDEF12',
        status: 'pending',
        confirmations: 0,
        requiredConfirmations: 3,
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
  async trackDeposit(
    @Body() depositTracking: DepositTrackingDto,
  ): Promise<DepositResult> {
    // For admin operations, userId should be determined from the transaction or provided
    // This is a simplified implementation - in production, you'd identify the user from the source address
    const userId = 'system'; // This should be replaced with actual user identification logic
    return this.xlmWalletService.trackDeposit(
      userId,
      depositTracking.amount,
      depositTracking.sourceAddress,
      depositTracking.transactionHash,
    );
  }

  @Post('deposit/confirm')
  @NoCache()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Confirm deposit (Admin only)',
    description: 'Update deposit confirmation status based on blockchain confirmations',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        transactionHash: {
          type: 'string',
          description: 'Blockchain transaction hash',
          example: 'abc123def4567890abc123def4567890abc123def4567890abc123def4567890',
        },
        confirmations: {
          type: 'number',
          description: 'Number of blockchain confirmations',
          example: 3,
        },
      },
      required: ['transactionHash', 'confirmations'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Deposit confirmation updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Deposit transaction not found',
  })
  async confirmDeposit(
    @Body() confirmData: { transactionHash: string; confirmations: number },
  ): Promise<void> {
    await this.xlmWalletService.confirmDeposit(confirmData.transactionHash, confirmData.confirmations);
  }

  @Get(':userId/limits')
  @CacheKey('wallet-limits')
  @ApiOperation({
    summary: 'Get withdrawal limits',
    description: 'Retrieve daily withdrawal limits and usage',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({
    status: 200,
    description: 'Withdrawal limits retrieved successfully',
    schema: {
      example: {
        used: 50.25,
        limit: 10000,
        remaining: 9949.75,
      },
    },
  })
  async getWithdrawalLimits(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.xlmWalletService.getDailyWithdrawalLimit(userId);
  }

  @Get(':userId/stats')
  @CacheKey('wallet-stats')
  @ApiOperation({
    summary: 'Get wallet statistics',
    description: 'Retrieve comprehensive wallet statistics and analytics',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({
    status: 200,
    description: 'Wallet statistics retrieved successfully',
    schema: {
      example: {
        totalTransactions: 150,
        totalDeposits: 500.75,
        totalWithdrawals: 125.50,
        totalEarned: 75.25,
        averageTransactionSize: 3.34,
      },
    },
  })
  async getWalletStats(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.xlmWalletService.getWalletStats(userId);
  }
}
