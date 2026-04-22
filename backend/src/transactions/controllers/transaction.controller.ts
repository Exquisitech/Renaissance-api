import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TransactionProcessorService } from '../services/transaction-processor.service';
import { SubmitTransactionDto } from '../dto/submit-transaction.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Transactions')
@Controller('transactions')
export class TransactionController {
  private readonly logger = new Logger(TransactionController.name);

  constructor(
    private readonly transactionProcessor: TransactionProcessorService,
  ) {}

  @Post('submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a transaction to the Stellar blockchain' })
  @ApiResponse({ 
    status: 201, 
    description: 'Transaction submitted successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid transaction XDR or parameters' })
  async submitTransaction(
    @Request() req,
    @Body() submitTransactionDto: SubmitTransactionDto,
  ) {
    this.logger.log(`Transaction submission request from user ${req.user.sub}`);

    const publicKey = submitTransactionDto.publicKey || req.user.walletPublicKey;

    const transaction = await this.transactionProcessor.submitTransaction(
      submitTransactionDto.transactionXdr,
      submitTransactionDto.type,
      req.user.sub,
      publicKey,
      submitTransactionDto.metadata,
      submitTransactionDto.requiredConfirmations,
    );

    return {
      success: true,
      transactionId: transaction.id,
      hash: transaction.hash,
      status: {
        id: transaction.id,
        hash: transaction.hash,
        status: transaction.status,
        type: transaction.type,
        confirmations: transaction.confirmations,
        requiredConfirmations: transaction.requiredConfirmations,
        createdAt: transaction.createdAt,
      },
    };
  }

  @Get('status/:identifier')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get transaction status by ID or hash' })
  @ApiResponse({ 
    status: 200, 
    description: 'Transaction status retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getTransactionStatus(@Param('identifier') identifier: string) {
    this.logger.log(`Transaction status check: ${identifier}`);

    const transaction = await this.transactionProcessor.getTransactionStatus(identifier);

    return {
      id: transaction.id,
      hash: transaction.hash,
      status: transaction.status,
      type: transaction.type,
      confirmations: transaction.confirmations,
      requiredConfirmations: transaction.requiredConfirmations,
      ledger: transaction.ledger,
      errorMessage: transaction.errorMessage,
      submittedAt: transaction.submittedAt,
      confirmedAt: transaction.confirmedAt,
      createdAt: transaction.createdAt,
    };
  }

  @Get('my-transactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all transactions for current user' })
  @ApiResponse({ 
    status: 200, 
    description: 'List of user transactions',
  })
  async getMyTransactions(
    @Request() req,
    @Param('limit') limit: number = 20,
    @Param('offset') offset: number = 0,
  ) {
    this.logger.log(`Fetching transactions for user ${req.user.sub}`);

    const result = await this.transactionProcessor.getUserTransactions(
      req.user.sub,
      limit,
      offset,
    );

    return {
      data: result.data.map((tx) => ({
        id: tx.id,
        hash: tx.hash,
        status: tx.status,
        type: tx.type,
        confirmations: tx.confirmations,
        ledger: tx.ledger,
        createdAt: tx.createdAt,
      })),
      total: result.total,
      limit,
      offset,
    };
  }

  @Get('receipt/:transactionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate transaction receipt' })
  @ApiResponse({ 
    status: 200, 
    description: 'Transaction receipt generated successfully',
  })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async generateReceipt(@Param('transactionId') transactionId: string) {
    this.logger.log(`Generating receipt for transaction: ${transactionId}`);

    const receipt = await this.transactionProcessor.generateReceipt(transactionId);

    return receipt;
  }

  @Post(':hash/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel a pending transaction (if possible)' })
  @ApiResponse({ status: 200, description: 'Transaction cancellation requested' })
  @ApiResponse({ status: 400, description: 'Transaction cannot be cancelled' })
  @HttpCode(HttpStatus.OK)
  async cancelTransaction(@Param('hash') hash: string) {
    this.logger.log(`Cancellation request for transaction: ${hash}`);

    const transaction = await this.transactionProcessor.getTransactionStatus(hash);

    if (transaction.status !== 'pending' && transaction.status !== 'submitted') {
      throw new Error('Transaction cannot be cancelled at current status');
    }

    // Note: On Stellar, once submitted, transactions cannot be cancelled
    // This only works for transactions still in pending state
    await this.transactionProcessor.updateTransactionStatus(
      hash,
      'failed',
      'Cancelled by user',
    );

    return { success: true, message: 'Transaction cancelled' };
  }
}
