import { Module, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { getTypeOrmConfig } from './database/typeorm.config';
import { User } from './users/entities/user.entity';
import { Post } from './posts/entities/post.entity';
import { Category } from './categories/entities/category.entity';
import { Media } from './media/entities/media.entity';
import { Match } from './matches/entities/match.entity';
import { Bet } from './bets/entities/bet.entity';
import { PlayerCardMetadata } from './player-card-metadata/entities/player-card-metadata.entity';
import { Prediction } from './predictions/entities/prediction.entity';
import { FreeBetVoucher } from './free-bet-vouchers/entities/free-bet-voucher.entity';
import { Comment } from './comments/entities/comment.entity';
import configuration from './config/configuration';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { MatchesModule } from './matches/matches.module';
import { PlayerCardMetadataModule } from './player-card-metadata/player-card-metadata.module';
import { PostsModule } from './posts/posts.module';
import { PredictionsModule } from './predictions/predictions.module';
import { FreeBetVouchersModule } from './free-bet-vouchers/free-bet-vouchers.module';
import { CommentsModule } from './comments/comments.module';
import { validate } from './common/config/env.validation';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { LeaderboardsModule } from './leaderboards/leaderboards.module';
import { HealthModule } from './health/health.module';
import { CacheConfigModule } from './common/cache/cache.module';
import { AdminModule } from './admin/admin.module';
import { UserLeaderboardStats } from './leaderboard/entities/user-leaderboard-stats.entity';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { UsersModule } from './users/users.module';
import { LoggerModule } from './common/logger/logger.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { Leaderboard } from './leaderboard/entities/leaderboard.entity';
import { AuditModule } from './audit/audit.module';
import { CircuitBreakerGuard } from './auth/guards/circuit-breaker.guard';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { EventListenerModule } from './common/events/event-listener.module';
import { BetSettlementModule } from './bet-settlement/bet-settlement.module';
import { OddsModule } from './odds/odds.module';
import { GamificationModule } from './gamification/gamification.module';
import { Achievement } from './gamification/entities/achievement.entity';
import { UserAchievement } from './gamification/entities/user-achievement.entity';
import { Team } from './teams/entities/team.entity';
import { RankingModule } from './leaderboard/ranking.module';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { TreasuryModule } from './treasury/treasury.module';
import { StakingModule } from './stake/staking.module';
import { PlayerModule } from './player/player.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { FraudModule } from './fraud/fraud.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
      validate,
      cache: true,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('THROTTLE_TTL', 60000),
            limit: config.get<number>('THROTTLE_LIMIT', 10),
          },
        ],
      }),
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        getTypeOrmConfig(configService),
    }),
    TypeOrmModule.forFeature([
      User,
      Post,
      Category,
      Media,
      Match,
      Bet,
      PlayerCardMetadata,
      Prediction,
      Leaderboard,
      FreeBetVoucher,
      UserLeaderboardStats,
      Achievement,
      UserAchievement,
      Team,
      Comment,
    ]),
    RateLimitModule,
    AuthModule,
    MatchesModule,
    BetSettlementModule,
    OddsModule,
    LeaderboardModule,
    FreeBetVouchersModule,
    LeaderboardsModule,
    CommentsModule,
    UsersModule,
    HealthModule,
    CacheConfigModule,
    AdminModule,
    ReconciliationModule,
    LoggerModule,
    EventListenerModule,
    GamificationModule,
    RankingModule,
    TreasuryModule,
    StakingModule,
    PlayerModule,
    AnalyticsModule,
    NotificationsModule,
    FraudModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CircuitBreakerGuard,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}