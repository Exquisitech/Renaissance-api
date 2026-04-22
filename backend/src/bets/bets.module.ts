import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BetsController } from './bets.controller';
import { BetsService } from './bets.service';
import { Bet } from './entities/bet.entity';
import { Match } from '../matches/entities/match.entity';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { WalletModule } from '../wallet/wallet.module';
import { FreeBetVouchersModule } from '../free-bet-vouchers/free-bet-vouchers.module';
import { SpinModule } from '../spin/spin.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([Bet, Match]),
    forwardRef(() => LeaderboardModule),
    CqrsModule,
    WalletModule,
    FreeBetVouchersModule,
    SpinModule,
    RateLimitModule,
  ],
  controllers: [BetsController],
  providers: [BetsService],
  exports: [BetsService],
})
export class BetsModule {}
