import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletService } from './wallet.service';
import { XlmWalletService } from './services/xlm-wallet.service';
import { WalletController } from './controllers/wallet.controller';
import { Balance } from './entities/balance.entity';
import { BalanceTransaction } from './entities/balance-transaction.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Balance, BalanceTransaction, User])],
  controllers: [WalletController],
  providers: [WalletService, XlmWalletService],
  exports: [WalletService, XlmWalletService],
})
export class WalletModule {}
