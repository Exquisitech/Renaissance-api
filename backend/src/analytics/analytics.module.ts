import { Module, forwardRef } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsService } from './providers/analytics.service';
import { AnalyticsEventService } from './providers/analytics-event.service';
import { AnalyticsTrackingService } from './providers/analytics-tracking.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsEvent } from './entities/analytics-event.entity';
import { Bet } from '../bets/entities/bet.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Spin } from '../spin/entities/spin.entity';
import { User } from '../users/entities/user.entity';
import { Match } from '../matches/entities/match.entity';
import { NFTReward } from '../spin-game/entities/nft-reward.entity';
import { Prediction } from '../predictions/entities/prediction.entity';

@Module({
  imports: [
    CacheModule.register({
      ttl: 60, // 60 seconds cache
      max: 100,
    }),
    TypeOrmModule.forFeature([
      AnalyticsEvent,
      Bet,
      Transaction,
      Spin,
      User,
      Match,
      NFTReward,
      Prediction,
    ]),
  ],
  providers: [
    AnalyticsService,
    AnalyticsEventService,
    AnalyticsTrackingService,
  ],
  controllers: [AnalyticsController],
  exports: [
    AnalyticsService,
    AnalyticsEventService,
    AnalyticsTrackingService,
  ],
})
export class AnalyticsModule {}
