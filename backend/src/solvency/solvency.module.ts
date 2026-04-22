import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SolvencyMetrics } from './solvency-metrics.entity';
import { SolvencyService } from './solvency.service';
import { SolvencyScheduler } from './solvency.scheduler';
import { SolvencyController } from './solvency.controller';
import { Bet } from '../bets/entities/bet.entity';
import { SolvencyProof } from './entities/solvency-proof.entity';
import { UserBalanceSnapshot } from './entities/user-balance-snapshot.entity';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SolvencyMetrics,
      Bet,
      SolvencyProof,
      UserBalanceSnapshot,
    ]),
    BlockchainModule,
  ],
  providers: [SolvencyService, SolvencyScheduler],
  controllers: [SolvencyController],
  exports: [SolvencyService],
})
export class SolvencyModule {}
