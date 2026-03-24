import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SolvencyMetrics } from './solvency-metrics.entity';
import { SolvencyService } from './solvency.service';
import { SolvencyScheduler } from './solvency.scheduler';
import { SolvencyController } from './solvency.controller';
import { Bet } from '../bets/entities/bet.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SolvencyMetrics, Bet])],
  providers: [SolvencyService, SolvencyScheduler],
  controllers: [SolvencyController],
  exports: [SolvencyService],
})
export class SolvencyModule {}
