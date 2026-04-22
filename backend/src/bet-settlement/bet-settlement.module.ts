import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bet } from '../bets/entities/bet.entity';
import { BetsModule } from '../bets/bets.module';
import { BetSettlementService } from './bet-settlement.service';
import { MatchFinishedEventHandler } from './match-finished.listener';
import { BetSettlementAuditLog } from './entities/bet-settlement-audit-log.entity';
import { BetSettlementJob } from './entities/bet-settlement-job.entity';

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([Bet, BetSettlementJob, BetSettlementAuditLog]),
    BetsModule,
  ],
  providers: [BetSettlementService, MatchFinishedEventHandler],
  exports: [BetSettlementService],
})
export class BetSettlementModule {}
