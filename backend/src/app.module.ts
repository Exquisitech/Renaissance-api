import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getTypeOrmConfig } from './database/typeorm.config';
import { User } from './users/entities/user.entity';
import { Post } from './posts/entities/post.entity';
import { Comment } from './comments/entities/comment.entity';
import { Category } from './categories/entities/category.entity';
import { Media } from './media/entities/media.entity';
import { Match } from './matches/entities/match.entity';
import { Bet } from './bets/entities/bet.entity';
import { PlayerCardMetadata } from './player-card-metadata/entities/player-card-metadata.entity';
import { Prediction } from './predictions/entities/prediction.entity';
import { Spin } from './spin/entities/spin.entity';
import configuration from './config/configuration';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { BetsModule } from './bets/bets.module';
import { MatchesModule } from './matches/matches.module';
import { PlayerCardMetadataModule } from './player-card-metadata/player-card-metadata.module';
import { PostsModule } from './posts/posts.module';
import { PredictionsModule } from './predictions/predictions.module';
import { validate } from './common/config/env.validation';
import { BlockchainModule } from './blockchain/blockchain.module';
import { SpinModule } from './spin/spin.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
      validate,
      cache: true,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('THROTTLE_TTL', 60000), // 60 seconds
            limit: config.get<number>('THROTTLE_LIMIT', 10), // 10 requests
          },
        ],
      }),
    }),
    TypeOrmModule.forRootAsync({
     imports: [ConfigModule],
     inject: [ConfigService],
     useFactory: (configService: ConfigService) => getTypeOrmConfig(configService),
    }),
    TypeOrmModule.forFeature([
      User,
      Post,
      Comment,
      Category,
      Media,
      Match,
      Bet,
      PlayerCardMetadata,
      Prediction,
      Spin,
    ]),
    AuthModule,
    BetsModule,
    MatchesModule,
    PlayerCardMetadataModule,
    PostsModule,
    PredictionsModule,
    SpinModule,
    LeaderboardModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
