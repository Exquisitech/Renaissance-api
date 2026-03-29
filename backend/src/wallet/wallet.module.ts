import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletService } from './wallet.service';
import { XlmWalletService } from './services/xlm-wallet.service';
import { WalletConnectionService } from './services/wallet-connection.service';
import { WalletController } from './controllers/wallet.controller';
import { WalletConnectionController } from './controllers/wallet-connection.controller';
import { Balance } from './entities/balance.entity';
import { BalanceTransaction } from './entities/balance-transaction.entity';
import { WalletConnection } from './entities/wallet-connection.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Balance, BalanceTransaction, User, WalletConnection])],
  controllers: [WalletController, WalletConnectionController],
  providers: [WalletService, XlmWalletService, WalletConnectionService],
  exports: [WalletService, XlmWalletService, WalletConnectionService],
})
export class WalletModule {}
