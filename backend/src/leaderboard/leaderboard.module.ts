import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Leaderboard } from './entities/leaderboard.entity';
import { LeaderboardStats } from './entities/leaderboard-stats.entity';
import { UserLeaderboardStats } from './entities/user-leaderboard-stats.entity';
import { Season } from './entities/season.entity';
import { SeasonalLeaderboard } from './entities/seasonal-leaderboard.entity';
import { LeaderboardService } from './leaderboard.service';
import { User } from '../users/entities/user.entity';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardQueryService } from './leaderboard-query.service';
import { LeaderboardAggregationService } from './leaderboard-aggregation.service';
import { LeaderboardSyncService } from './leaderboard-sync.service';
// import { LeaderboardGateway } from './leaderboard.gateway';
import { BetPlacedEventHandler } from './listeners/bet-placed.listener';
import { BetSettledEventHandler } from './listeners/bet-settled.listener';
import { SpinSettledEventHandler } from './listeners/spin-settled.listener';
import { StakeCreditedEventHandler } from './listeners/stake-credited.listener';
import { StakeDebitedEventHandler } from './listeners/stake-debited.listener';
import { SeasonService } from './services/season.service';
import { SeasonalLeaderboardService } from './services/seasonal-leaderboard.service';
import { SeasonResetService } from './services/season-reset.service';
import { SeasonController } from './controllers/season.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Leaderboard,
      LeaderboardStats,
      UserLeaderboardStats,
      User,
      Season,
      SeasonalLeaderboard,
    ]),
    CqrsModule,
  ],
  controllers: [LeaderboardController, SeasonController],
  providers: [
    LeaderboardService,
    LeaderboardQueryService,
    LeaderboardAggregationService,
    LeaderboardSyncService,
    // LeaderboardGateway,
    BetPlacedEventHandler,
    BetSettledEventHandler,
    SpinSettledEventHandler,
    StakeCreditedEventHandler,
    StakeDebitedEventHandler,
    SeasonService,
    SeasonalLeaderboardService,
    SeasonResetService,
  ],
  exports: [
    LeaderboardService,
    LeaderboardQueryService,
    LeaderboardAggregationService,
    LeaderboardSyncService,
    // LeaderboardGateway,
    SeasonService,
    SeasonalLeaderboardService,
    SeasonResetService,
  ],
})
export class LeaderboardModule {}