import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionController } from './controllers/transaction.controller';
import { TransactionProcessorService } from './services/transaction-processor.service';
import { BlockchainTransaction } from './entities/blockchain-transaction.entity';
import { StellarModule } from '../stellar/stellar.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BlockchainTransaction]),
    StellarModule,
  ],
  controllers: [TransactionController],
  providers: [TransactionProcessorService],
  exports: [TransactionProcessorService],
})
export class TransactionsModule {}
