import { Controller, Get, Query } from '@nestjs/common';
import { WalletService } from '../services/wallet.service';
import { GetTransactionsDto } from '../dto/get-transactions.dto';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('transactions')
  async getTransactions(@Query() query: GetTransactionsDto) {
    const userId = 'mock-user-id'; // 🔥 replace with JWT user
    return this.walletService.getTransactions(userId, query);
  }
}