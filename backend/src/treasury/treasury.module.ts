import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TreasuryService } from './treasury.service';
import { TreasuryController } from './treasury.controller';
import { TreasuryDistribution } from './entities/treasury-distribution.entity';
import { TreasuryDistributionBatch } from './entities/treasury-distribution-batch.entity';
import { TreasuryAuditLog } from './entities/treasury-audit-log.entity';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { WalletModule } from '../wallet/wallet.module';
import { Bet } from '../bets/entities/bet.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TreasuryDistribution,
      TreasuryDistributionBatch,
      TreasuryAuditLog,
      Bet,
      User,
    ]),
    BlockchainModule,
    WalletModule,
  ],
  controllers: [TreasuryController],
  providers: [TreasuryService],
  exports: [TreasuryService],
})
export class TreasuryModule {}
