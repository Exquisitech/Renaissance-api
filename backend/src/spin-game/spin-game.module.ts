import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { SpinGameController } from './spin-game.controller';
import { SpinGameService } from './spin-game.service';
import { SpinGameRepository } from './repositories/spin-game.repository';
import { SpinGame, UserSpinStats, FreeBetReward, NFTReward } from './entities';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { FreeBetVouchersModule } from '../free-bet-vouchers/free-bet-vouchers.module';
import { JackpotModule } from './jackpot.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SpinGame,
      UserSpinStats,
      FreeBetReward,
      NFTReward,
    ]),
    ConfigModule,
    JwtModule,
    RateLimitModule,
    FreeBetVouchersModule,
    JackpotModule,
  ],
  controllers: [SpinGameController],
  providers: [SpinGameService, SpinGameRepository],
  exports: [SpinGameService],
})
export class SpinGameModule {}
