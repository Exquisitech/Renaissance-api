import { DataSource } from 'typeorm';
import { Player } from '../src/players/entities/player.entity';
import { User } from '../src/users/entities/user.entity';
import { Bet } from '../src/bets/entities/bet.entity';
import { Match } from '../src/matches/entities/match.entity';
import { AnalyticsEvent } from '../src/analytics/entities/analytics-event.entity';
import { Post } from '../src/posts/entities/post.entity';
import { Comment } from '../src/comments/entities/comment.entity';
import { Category } from '../src/categories/entities/category.entity';
import { Media } from '../src/media/entities/media.entity';
import { Prediction } from '../src/predictions/entities/prediction.entity';
import { FreeBetVoucher } from '../src/free-bet-vouchers/entities/free-bet-voucher.entity';
import { Spin } from '../src/spin/entities/spin.entity';
import { SpinSession } from '../src/spin/entities/spin-session.entity';
import { Leaderboard } from '../src/leaderboard/entities/leaderboard.entity';
import { UserLeaderboardStats } from '../src/leaderboard/entities/user-leaderboard-stats.entity';
import { Achievement } from '../src/gamification/entities/achievement.entity';
import { UserAchievement } from '../src/gamification/entities/user-achievement.entity';
import { NFTListing } from '../src/nft/entities/nft-listing.entity';
import { NFTOffer } from '../src/nft/entities/nft-offer.entity';
import { NFTPlayerCard } from '../src/nft/entities/nft.entity';
import { Team } from '../src/teams/entities/team.entity';
import { PlayerCardMetadata } from '../src/player-card-metadata/entities/player-card-metadata.entity';

export async function createTestDataSource(): Promise<DataSource> {
  const dataSource = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    entities: [
      User,
      Player,
      Bet,
      Match,
      AnalyticsEvent,
      Post,
      Comment,
      Category,
      Media,
      Prediction,
      FreeBetVoucher,
      Spin,
      SpinSession,
      Leaderboard,
      UserLeaderboardStats,
      Achievement,
      UserAchievement,
      NFTListing,
      NFTOffer,
      NFTPlayerCard,
      Team,
      PlayerCardMetadata,
    ],
    synchronize: true,
    dropSchema: true,
    logging: false,
  });

  await dataSource.initialize();
  return dataSource;
}

export async function createTestDataSourceWithEntities(entities: any[] = []): Promise<DataSource> {
  const dataSource = new DataSource({
    type: 'sqlite',
    database: `:memory:${Math.random()}`,
    entities: entities,
    synchronize: true,
    dropSchema: true,
    logging: false,
  });

  await dataSource.initialize();
  return dataSource;
}
