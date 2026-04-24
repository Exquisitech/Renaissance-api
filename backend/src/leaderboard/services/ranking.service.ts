import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, SelectQueryBuilder } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Leaderboard } from '../entities/leaderboard.entity';
import { User } from '../../users/entities/user.entity';
import { Bet } from '../../bets/entities/bet.entity';

export interface RankingQuery {
  page?: number;
  limit?: number;
  timeFrame?: 'daily' | 'weekly' | 'all-time';
  userId?: string;
}

export interface PaginatedRanking<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  timeFrame: string;
  lastUpdated: Date;
}

export interface UserRanking {
  userId: string;
  username: string;
  rank: number;
  value: number;
  percentile: number;
  totalUsers: number;
}

export interface HighestEarner {
  userId: string;
  username: string;
  email: string;
  totalWinnings: number;
  netEarnings: number;
  roi: number;
  totalBets: number;
  betsWon: number;
  bettingAccuracy: number;
  rank: number;
  lastBetAt: Date;
}

export interface BiggestStaker {
  userId: string;
  username: string;
  email: string;
  totalStaked: number;
  activeStakes: number;
  totalStakingRewards: number;
  stakingROI: number;
  rank: number;
  lastStakeAt: Date;
}

export interface BestPredictor {
  userId: string;
  username: string;
  email: string;
  bettingAccuracy: number;
  totalBets: number;
  betsWon: number;
  betsLost: number;
  winningStreak: number;
  highestWinningStreak: number;
  confidence: number;
  rank: number;
  lastBetAt: Date;
}

export interface H2HComparison {
  userA: {
    userId: string;
    username: string;
    winRate: number;
    totalProfit: number;
    avgOdds: number;
    currentStreak: number;
    highestStreak: number;
    totalBets: number;
  };
  userB: {
    userId: string;
    username: string;
    winRate: number;
    totalProfit: number;
    avgOdds: number;
    currentStreak: number;
    highestStreak: number;
    totalBets: number;
  };
  winner: string | null; // userId of overall winner or null if tied
}

@Injectable()
export class RankingService {
  private readonly logger = new Logger(RankingService.name);

  constructor(
    @InjectRepository(Leaderboard)
    private leaderboardRepository: Repository<Leaderboard>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Bet)
    private betRepository: Repository<Bet>,
    private dataSource: DataSource,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getHighestEarners(query: RankingQuery): Promise<PaginatedRanking<HighestEarner>> {
    const { page = 1, limit = 10, timeFrame = 'all-time' } = query;
    const cacheKey = `highest_earners_${timeFrame}_${page}_${limit}`;

    try {
      const cached = await this.cacheManager.get<PaginatedRanking<HighestEarner>>(cacheKey);
      if (cached) {
        return cached;
      }

      const queryBuilder = this.createBaseQuery()
        .select([
          'leaderboard.userId',
          'user.username',
          'user.email',
          'leaderboard.totalWinnings',
          'leaderboard.totalBets',
          'leaderboard.betsWon',
          'leaderboard.bettingAccuracy',
          'leaderboard.lastBetAt',
        ])
        .addSelect(
          '(leaderboard.totalWinnings - leaderboard.totalStaked)',
          'netEarnings'
        )
        .addSelect(
          `CASE 
            WHEN leaderboard.totalStaked > 0 
            THEN ROUND(((leaderboard.totalWinnings - leaderboard.totalStaked) / leaderboard.totalStaked) * 100, 2)
            ELSE 0 
          END`,
          'roi'
        )
        .orderBy('netEarnings', 'DESC')
        .addOrderBy('leaderboard.totalWinnings', 'DESC');

      this.applyTimeFrameFilter(queryBuilder, timeFrame, 'leaderboard.lastBetAt');

      const [data, total] = await queryBuilder
        .skip((page - 1) * limit)
        .take(limit)
        .getRawMany();

      const rankings = data.map((row, index) => ({
        userId: row.leaderboard_userId,
        username: row.user_username,
        email: row.user_email,
        totalWinnings: Number(row.leaderboard_totalWinnings),
        netEarnings: Number(row.netEarnings),
        roi: Number(row.roi),
        totalBets: row.leaderboard_totalBets,
        betsWon: row.leaderboard_betsWon,
        bettingAccuracy: Number(row.leaderboard_bettingAccuracy),
        rank: (page - 1) * limit + index + 1,
        lastBetAt: row.leaderboard_lastBetAt,
      }));

      const result: PaginatedRanking<HighestEarner> = {
        data: rankings,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        timeFrame,
        lastUpdated: new Date(),
      };

      await this.cacheManager.set(cacheKey, result, 300);
      return result;
    } catch (error) {
      this.logger.error(`Error getting highest earners: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getBiggestStakers(query: RankingQuery): Promise<PaginatedRanking<BiggestStaker>> {
    const { page = 1, limit = 10, timeFrame = 'all-time' } = query;
    const cacheKey = `biggest_stakers_${timeFrame}_${page}_${limit}`;

    try {
      const cached = await this.cacheManager.get<PaginatedRanking<BiggestStaker>>(cacheKey);
      if (cached) {
        return cached;
      }

      const queryBuilder = this.createBaseQuery()
        .select([
          'leaderboard.userId',
          'user.username',
          'user.email',
          'leaderboard.totalStaked',
          'leaderboard.activeStakes',
          'leaderboard.totalStakingRewards',
          'leaderboard.lastStakeAt',
        ])
        .addSelect(
          `CASE 
            WHEN leaderboard.totalStaked > 0 
            THEN ROUND((leaderboard.totalStakingRewards / leaderboard.totalStaked) * 100, 2)
            ELSE 0 
          END`,
          'stakingROI'
        )
        .where('leaderboard.totalStaked > 0')
        .orderBy('leaderboard.totalStaked', 'DESC')
        .addOrderBy('stakingROI', 'DESC');

      this.applyTimeFrameFilter(queryBuilder, timeFrame, 'leaderboard.lastStakeAt');

      const [data, total] = await queryBuilder
        .skip((page - 1) * limit)
        .take(limit)
        .getRawMany();

      const rankings = data.map((row, index) => ({
        userId: row.leaderboard_userId,
        username: row.user_username,
        email: row.user_email,
        totalStaked: Number(row.leaderboard_totalStaked),
        activeStakes: Number(row.leaderboard_activeStakes),
        totalStakingRewards: Number(row.leaderboard_totalStakingRewards),
        stakingROI: Number(row.stakingROI),
        rank: (page - 1) * limit + index + 1,
        lastStakeAt: row.leaderboard_lastStakeAt,
      }));

      const result: PaginatedRanking<BiggestStaker> = {
        data: rankings,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        timeFrame,
        lastUpdated: new Date(),
      };

      await this.cacheManager.set(cacheKey, result, 300);
      return result;
    } catch (error) {
      this.logger.error(`Error getting biggest stakers: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getBestPredictors(query: RankingQuery): Promise<PaginatedRanking<BestPredictor>> {
    const { page = 1, limit = 10, timeFrame = 'all-time' } = query;
    const cacheKey = `best_predictors_${timeFrame}_${page}_${limit}`;

    try {
      const cached = await this.cacheManager.get<PaginatedRanking<BestPredictor>>(cacheKey);
      if (cached) {
        return cached;
      }

      const queryBuilder = this.createBaseQuery()
        .select([
          'leaderboard.userId',
          'user.username',
          'user.email',
          'leaderboard.totalBets',
          'leaderboard.betsWon',
          'leaderboard.betsLost',
          'leaderboard.bettingAccuracy',
          'leaderboard.winningStreak',
          'leaderboard.highestWinningStreak',
          'leaderboard.lastBetAt',
        ])
        .addSelect(
          `CASE 
            WHEN leaderboard.totalBets >= 10 
            THEN ROUND(leaderboard.bettingAccuracy * (1 + (leaderboard.totalBets / 100)), 2)
            ELSE ROUND(leaderboard.bettingAccuracy * 0.5, 2)
          END`,
          'confidence'
        )
        .where('leaderboard.totalBets >= 5')
        .orderBy('confidence', 'DESC')
        .addOrderBy('leaderboard.bettingAccuracy', 'DESC')
        .addOrderBy('leaderboard.totalBets', 'DESC');

      this.applyTimeFrameFilter(queryBuilder, timeFrame, 'leaderboard.lastBetAt');

      const [data, total] = await queryBuilder
        .skip((page - 1) * limit)
        .take(limit)
        .getRawMany();

      const rankings = data.map((row, index) => ({
        userId: row.leaderboard_userId,
        username: row.user_username,
        email: row.user_email,
        bettingAccuracy: Number(row.leaderboard_bettingAccuracy),
        totalBets: row.leaderboard_totalBets,
        betsWon: row.leaderboard_betsWon,
        betsLost: row.leaderboard_betsLost,
        winningStreak: row.leaderboard_winningStreak,
        highestWinningStreak: row.leaderboard_highestWinningStreak,
        confidence: Number(row.confidence),
        rank: (page - 1) * limit + index + 1,
        lastBetAt: row.leaderboard_lastBetAt,
      }));

      const result: PaginatedRanking<BestPredictor> = {
        data: rankings,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        timeFrame,
        lastUpdated: new Date(),
      };

      await this.cacheManager.set(cacheKey, result, 300);
      return result;
    } catch (error) {
      this.logger.error(`Error getting best predictors: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getUserPosition(userId: string, rankingType: 'earners' | 'stakers' | 'predictors'): Promise<UserRanking | null> {
    const cacheKey = `user_position_${userId}_${rankingType}`;
    
    try {
      const cached = await this.cacheManager.get<UserRanking>(cacheKey);
      if (cached) {
        return cached;
      }

      let queryBuilder: SelectQueryBuilder<Leaderboard>;
      let valueField: string;
      let orderByField: string;

      switch (rankingType) {
        case 'earners':
          queryBuilder = this.createBaseQuery()
            .select([
              'leaderboard.userId',
              'user.username',
              '(leaderboard.totalWinnings - leaderboard.totalStaked)',
              'netEarnings'
            ])
            .orderBy('netEarnings', 'DESC');
          valueField = 'netEarnings';
          orderByField = 'netEarnings';
          break;
        case 'stakers':
          queryBuilder = this.createBaseQuery()
            .select([
              'leaderboard.userId',
              'user.username',
              'leaderboard.totalStaked'
            ])
            .where('leaderboard.totalStaked > 0')
            .orderBy('leaderboard.totalStaked', 'DESC');
          valueField = 'leaderboard.totalStaked';
          orderByField = 'leaderboard.totalStaked';
          break;
        case 'predictors':
          queryBuilder = this.createBaseQuery()
            .select([
              'leaderboard.userId',
              'user.username',
              'leaderboard.bettingAccuracy',
              'leaderboard.totalBets'
            ])
            .where('leaderboard.totalBets >= 5')
            .orderBy('leaderboard.bettingAccuracy', 'DESC')
            .addOrderBy('leaderboard.totalBets', 'DESC');
          valueField = 'leaderboard.bettingAccuracy';
          orderByField = 'leaderboard.bettingAccuracy';
          break;
      }

      const allUsers = await queryBuilder.getRawMany();
      const userIndex = allUsers.findIndex(row => row.leaderboard_userId === userId);

      if (userIndex === -1) {
        return null;
      }

      const user = allUsers[userIndex];
      const rank = userIndex + 1;
      const totalUsers = allUsers.length;
      const percentile = ((totalUsers - rank + 1) / totalUsers) * 100;

      const result: UserRanking = {
        userId: user.leaderboard_userId,
        username: user.user_username,
        rank,
        value: Number(user[valueField]),
        percentile: Math.round(percentile * 100) / 100,
        totalUsers,
      };

      await this.cacheManager.set(cacheKey, result, 600);
      return result;
    } catch (error) {
      this.logger.error(`Error getting user position: ${error.message}`, error.stack);
      return null;
    }
  }

  private createBaseQuery(): SelectQueryBuilder<Leaderboard> {
    return this.leaderboardRepository
      .createQueryBuilder('leaderboard')
      .innerJoin('leaderboard.user', 'user');
  }

  private applyTimeFrameFilter(
    queryBuilder: SelectQueryBuilder<Leaderboard>,
    timeFrame: string,
    dateField: string
  ): void {
    const now = new Date();
    let filterDate: Date;

    switch (timeFrame) {
      case 'daily':
        filterDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        filterDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'all-time':
      default:
        return;
    }

    queryBuilder.andWhere(`${dateField} >= :filterDate`, { filterDate });
  }

  async invalidateRankingCache(): Promise<void> {
    const keys = [
      'highest_earners_',
      'biggest_stakers_',
      'best_predictors_',
      'user_position_',
    ];

    for (const key of keys) {
      try {
        await this.cacheManager.del(key);
      } catch (error) {
        this.logger.warn(`Failed to clear cache key ${key}: ${error.message}`);
      }
    }

    this.logger.log('Ranking cache invalidated');
  }

  async getH2HComparison(userAId: string, userBId: string): Promise<H2HComparison> {
    const [a, b] = await Promise.all([
      this.leaderboardRepository.findOne({ where: { userId: userAId }, relations: ['user'] }),
      this.leaderboardRepository.findOne({ where: { userId: userBId }, relations: ['user'] }),
    ]);

    if (!a || !b) throw new Error('One or both users not found in leaderboard');

    const toStats = (entry: Leaderboard, user: any) => ({
      userId: entry.userId,
      username: user?.username ?? entry.userId,
      winRate: entry.totalBets > 0 ? Number(((entry.betsWon / entry.totalBets) * 100).toFixed(2)) : 0,
      totalProfit: Number(entry.totalWinnings),
      avgOdds: entry.totalBets > 0 ? Number((Number(entry.totalWinnings) / entry.totalBets).toFixed(4)) : 0,
      currentStreak: entry.winningStreak,
      highestStreak: entry.highestWinningStreak,
      totalBets: entry.totalBets,
    });

    const statsA = toStats(a, a.user);
    const statsB = toStats(b, b.user);

    // Determine winner by score: winRate (40%) + profit (40%) + streak (20%)
    const scoreA = statsA.winRate * 0.4 + statsA.totalProfit * 0.4 + statsA.highestStreak * 0.2;
    const scoreB = statsB.winRate * 0.4 + statsB.totalProfit * 0.4 + statsB.highestStreak * 0.2;

    return {
      userA: statsA,
      userB: statsB,
      winner: scoreA > scoreB ? userAId : scoreB > scoreA ? userBId : null,
    };
  }
}
