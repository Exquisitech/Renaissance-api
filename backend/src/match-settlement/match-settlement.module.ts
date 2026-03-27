import { Module } from '@nestjs/common';
import { MatchSettlementService } from './match-settlement.service';
import { MatchSettlementController } from './match-settlement.controller';

@Module({
  controllers: [MatchSettlementController],
  providers: [MatchSettlementService],
})
export class MatchSettlementModule {}
