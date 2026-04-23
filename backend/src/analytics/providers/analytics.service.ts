import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { DateRangeDto } from '../dto/date-range.dto';
import { Bet } from '../../bets/entities/bet.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { Spin } from '../../spin/entities/spin.entity';
import { User } from '../../users/entities/user.entity';
import { Match } from '../../matches/entities/match.entity';
import { NFTReward } from '../../spin-game/entities/nft-reward.entity';
import { Prediction } from '../../predictions/entities/prediction.entity';
import { AnalyticsEventService, PlatformMetrics } from './analytics-event.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @InjectRepository(Bet)
    private betRepository: Repository<Bet>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(Spin)
    private spinRepository: Repository<Spin>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Match)
    private matchRepository: Repository<Match>,
    @InjectRepository(NFTReward)
    private nftRewardRepository: Repository<NFTReward>,
    @InjectRepository(Prediction)
    private predictionRepository: Repository<Prediction>,
    private analyticsEventService: AnalyticsEventService,
  ) {}

  private applyDateFilter(
    qb: SelectQueryBuilder<any>,
    dateRange: DateRangeDto,
    dateField = 'createdAt',
  ): SelectQueryBuilder<any> {
    if (!dateRange.startDate || !dateRange.endDate) {
      return qb;
    }

    return qb.andWhere(`${dateField} BETWEEN :startDate AND :endDate`, {
      startDate: new Date(dateRange.startDate),
      endDate: new Date(dateRange.endDate),
    });
  }

  async totalStaked(dateRange: DateRangeDto) {
    const cacheKey = `total_staked_${JSON.stringify(dateRange)}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    try {
      const result = await this.betRepository
        .createQueryBuilder('bet')
        .select('SUM(bet.amount)', 'total')
        .where('1=1');

      this.applyDateFilter(result, dateRange, 'bet.createdAt');
      const totalResult = await result.getRawOne();
      const total = totalResult?.total || 0;
      await this.cacheManager.set(cacheKey, { total }, 300); // 5 min cache
      return { total };
    } catch (error) {
      this.logger.error(`Error calculating total staked: ${error.message}`);
      return { total: 0 };
    }
  }

  async spinRevenue(dateRange: DateRangeDto) {
    const cacheKey = `spin_revenue_${JSON.stringify(dateRange)}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    try {
      const revenueResult = await this.spinRepository
        .createQueryBuilder('spin')
        .select('SUM(spin.betAmount)', 'revenue')
        .addSelect('SUM(spin.winAmount)', 'payout')
        .where('1=1');
      this.applyDateFilter(revenueResult, dateRange, 'spin.createdAt');
      const computedRevenue = await revenueResult.getRawOne();
      const revenue = computedRevenue?.revenue || 0;
      const payout = computedRevenue?.payout || 0;
      const profit = revenue - payout;

      const result = { revenue, payout, profit };
      await this.cacheManager.set(cacheKey, result, 300);
      return result;
    } catch (error) {
      this.logger.error(`Error calculating spin revenue: ${error.message}`);
      return { revenue: 0, payout: 0, profit: 0 };
    }
  }

  async mostPopularNFTs() {
    const cacheKey = 'most_popular_nfts';
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    try {
      const popularNFTs = await this.nftRewardRepository
        .createQueryBuilder('reward')
        .select('reward.nftId', 'nftId')
        .addSelect('reward.tier', 'tier')
        .addSelect('COUNT(reward.id)', 'mintCount')
        .where('reward.isMinted = :minted', { minted: true })
        .groupBy('reward.nftId')
        .addGroupBy('reward.tier')
        .orderBy('mintCount', 'DESC')
        .limit(10)
        .getRawMany();

      await this.cacheManager.set(cacheKey, popularNFTs, 600); // 10 min cache
      return popularNFTs;
    } catch (error) {
      this.logger.error(`Error getting popular NFTs: ${error.message}`);
      return [];
    }
  }

  async betSettlementStats(dateRange: DateRangeDto) {
    const cacheKey = `bet_settlement_stats_${JSON.stringify(dateRange)}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    try {
      const stats = await this.betRepository
        .createQueryBuilder('bet')
        .select('bet.status', 'status')
        .addSelect('COUNT(bet.id)', 'count')
        .addSelect('SUM(bet.amount)', 'totalAmount')
        .addSelect('SUM(bet.potentialWin)', 'totalPotentialWin')
        .where('1=1');
      this.applyDateFilter(stats, dateRange, 'bet.createdAt');
      const computedStats = await stats
        .groupBy('bet.status')
        .getRawMany();

      await this.cacheManager.set(cacheKey, computedStats, 300);
      return computedStats;
    } catch (error) {
      this.logger.error(`Error getting bet settlement stats: ${error.message}`);
      return [];
    }
  }

  async userEngagementMetrics(dateRange: DateRangeDto) {
    const cacheKey = `user_engagement_${JSON.stringify(dateRange)}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    try {
      const startDate = new Date(dateRange.startDate || '2024-01-01');
      const endDate = new Date(dateRange.endDate || new Date().toISOString());

      const metrics = await this.analyticsEventService.getPlatformMetrics(startDate, endDate);
      await this.cacheManager.set(cacheKey, metrics, 300);
      return metrics;
    } catch (error) {
      this.logger.error(`Error getting user engagement metrics: ${error.message}`);
      return {
        totalUsers: 0,
        activeUsers: 0,
        newUsers: 0,
        totalEvents: 0,
        eventsByType: {},
        eventsByCategory: {},
        revenue: 0,
        avgRevenuePerUser: 0,
        topEvents: [],
      };
    }
  }

  async revenueAnalytics(dateRange: DateRangeDto) {
    const cacheKey = `revenue_analytics_${JSON.stringify(dateRange)}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    try {
      const [betRevenue, spinRevenue, nftRevenue] = await Promise.all([
        this.betRepository
          .createQueryBuilder('bet')
          .select('SUM(bet.amount)', 'bets')
          .where('1=1'),
        this.spinRepository
          .createQueryBuilder('spin')
          .select('SUM(spin.betAmount)', 'spins')
          .where('1=1'),
        this.nftRewardRepository
          .createQueryBuilder('reward')
          .select('COUNT(reward.id)', 'nfts')
          .where('reward.isMinted = :minted', { minted: true }),
      ]);
      this.applyDateFilter(betRevenue, dateRange, 'bet.createdAt');
      this.applyDateFilter(spinRevenue, dateRange, 'spin.createdAt');
      this.applyDateFilter(nftRevenue, dateRange, 'reward.createdAt');
      const [betRevenueRaw, spinRevenueRaw, nftRevenueRaw] = await Promise.all([
        betRevenue.getRawOne(),
        spinRevenue.getRawOne(),
        nftRevenue.getRawOne(),
      ]);

      const totalRevenue = (betRevenueRaw?.bets || 0) + (spinRevenueRaw?.spins || 0) + (nftRevenueRaw?.nfts || 0);

      const result = {
        bets: betRevenueRaw?.bets || 0,
        spins: spinRevenueRaw?.spins || 0,
        nfts: nftRevenueRaw?.nfts || 0,
        total: totalRevenue,
      };

      await this.cacheManager.set(cacheKey, result, 300);
      return result;
    } catch (error) {
      this.logger.error(`Error calculating revenue analytics: ${error.message}`);
      return { bets: 0, spins: 0, nfts: 0, total: 0 };
    }
  }

  async performanceMetrics(dateRange: DateRangeDto) {
    const cacheKey = `performance_metrics_${JSON.stringify(dateRange)}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    try {
      const [matchStats, predictionStats, userStats] = await Promise.all([
        this.matchRepository
          .createQueryBuilder('match')
          .select('COUNT(match.id)', 'totalMatches')
          .addSelect('AVG(match.homeScore + match.awayScore)', 'avgGoals')
          .where('1=1'),
        this.predictionRepository
          .createQueryBuilder('prediction')
          .select('COUNT(prediction.id)', 'totalPredictions')
          .addSelect('SUM(CASE WHEN prediction.isCorrect THEN 1 ELSE 0 END)', 'correctPredictions')
          .where('1=1'),
        this.userRepository
          .createQueryBuilder('user')
          .select('COUNT(user.id)', 'totalUsers')
          .addSelect('COUNT(CASE WHEN user.lastLogin > :recent THEN 1 END)', 'activeUsers')
          .where('1=1')
          .setParameters({ recent: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) })
      ]);
      this.applyDateFilter(matchStats, dateRange, 'match.createdAt');
      this.applyDateFilter(predictionStats, dateRange, 'prediction.createdAt');
      this.applyDateFilter(userStats, dateRange, 'user.createdAt');
      const [matchStatsRaw, predictionStatsRaw, userStatsRaw] = await Promise.all([
        matchStats.getRawOne(),
        predictionStats.getRawOne(),
        userStats.getRawOne(),
      ]);

      const predictionAccuracy = predictionStatsRaw?.totalPredictions > 0
        ? (predictionStatsRaw.correctPredictions / predictionStatsRaw.totalPredictions) * 100
        : 0;

      const result = {
        matches: {
          total: matchStatsRaw?.totalMatches || 0,
          avgGoals: matchStatsRaw?.avgGoals || 0,
        },
        predictions: {
          total: predictionStatsRaw?.totalPredictions || 0,
          accuracy: predictionAccuracy,
        },
        users: {
          total: userStatsRaw?.totalUsers || 0,
          active: userStatsRaw?.activeUsers || 0,
        },
      };

      await this.cacheManager.set(cacheKey, result, 300);
      return result;
    } catch (error) {
      this.logger.error(`Error calculating performance metrics: ${error.message}`);
      return {
        matches: { total: 0, avgGoals: 0 },
        predictions: { total: 0, accuracy: 0 },
        users: { total: 0, active: 0 },
      };
    }
  }

  /**
   * Get comprehensive dashboard metrics
   * Includes DAU, MAU, bet volume, revenue, user growth
   */
  async getDashboardMetrics(dateRange: DateRangeDto) {
    const cacheKey = `dashboard_metrics_${JSON.stringify(dateRange)}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    try {
      const startDate = new Date(dateRange.startDate || '2024-01-01');
      const endDate = new Date(dateRange.endDate || new Date());

      // Calculate DAU (Daily Active Users)
      const dauResult = await this.userRepository
        .createQueryBuilder('user')
        .select('COUNT(DISTINCT user.id)', 'dau')
        .where('user.lastLogin >= :startDate AND user.lastLogin <= :endDate', {
          startDate: new Date(startDate.toDateString()),
          endDate: new Date(new Date(startDate).setDate(startDate.getDate() + 1)),
        })
        .getRawOne();

      // Calculate MAU (Monthly Active Users)
      const mauResult = await this.userRepository
        .createQueryBuilder('user')
        .select('COUNT(DISTINCT user.id)', 'mau')
        .where('user.lastLogin >= :monthStart', {
          monthStart: new Date(startDate.getFullYear(), startDate.getMonth(), 1),
        })
        .getRawOne();

      // Bet Volume
      const betVolumeResult = await this.betRepository
        .createQueryBuilder('bet')
        .select('COUNT(bet.id)', 'totalBets')
        .addSelect('SUM(bet.amount)', 'totalVolume')
        .addSelect('AVG(bet.amount)', 'avgBetSize')
        .where('bet.createdAt >= :startDate AND bet.createdAt <= :endDate', {
          startDate,
          endDate,
        })
        .getRawOne();

      // Revenue Metrics
      const [betRevenue, spinRevenue] = await Promise.all([
        this.betRepository
          .createQueryBuilder('bet')
          .select('SUM(bet.amount)', 'betRevenue')
          .addSelect('SUM(CASE WHEN bet.status = \'won\' THEN bet.potentialWin ELSE 0 END)', 'payouts')
          .where('bet.createdAt >= :startDate AND bet.createdAt <= :endDate', {
            startDate,
            endDate,
          })
          .getRawOne(),
        this.spinRepository
          .createQueryBuilder('spin')
          .select('SUM(spin.betAmount)', 'spinRevenue')
          .addSelect('SUM(spin.winAmount)', 'spinPayouts')
          .where('spin.createdAt >= :startDate AND spin.createdAt <= :endDate', {
            startDate,
            endDate,
          })
          .getRawOne(),
      ]);

      const totalRevenue = (betRevenue?.betRevenue || 0) + (spinRevenue?.spinRevenue || 0);
      const totalPayouts = (betRevenue?.payouts || 0) + (spinRevenue?.spinPayouts || 0);
      const netRevenue = totalRevenue - totalPayouts;

      // User Growth
      const newUserCount = await this.userRepository
        .createQueryBuilder('user')
        .select('COUNT(user.id)', 'newUsers')
        .where('user.createdAt >= :startDate AND user.createdAt <= :endDate', {
          startDate,
          endDate,
        })
        .getRawOne();

      // Previous period comparison for growth rate
      const previousStartDate = new Date(startDate);
      const previousEndDate = new Date(startDate);
      const dateDiff = endDate.getTime() - startDate.getTime();
      previousStartDate.setTime(previousStartDate.getTime() - dateDiff);

      const previousUserCount = await this.userRepository
        .createQueryBuilder('user')
        .select('COUNT(user.id)', 'previousUsers')
        .where('user.createdAt >= :previousStartDate AND user.createdAt < :previousEndDate', {
          previousStartDate,
          previousEndDate: startDate,
        })
        .getRawOne();

      const userGrowthRate = previousUserCount?.previousUsers > 0
        ? ((newUserCount?.newUsers || 0) - previousUserCount.previousUsers) / previousUserCount.previousUsers * 100
        : 0;

      const result = {
        dau: dauResult?.dau || 0,
        mau: mauResult?.mau || 0,
        betVolume: {
          totalBets: betVolumeResult?.totalBets || 0,
          totalVolume: betVolumeResult?.totalVolume || 0,
          avgBetSize: betVolumeResult?.avgBetSize || 0,
        },
        revenue: {
          totalRevenue,
          totalPayouts,
          netRevenue,
          betRevenue: betRevenue?.betRevenue || 0,
          spinRevenue: spinRevenue?.spinRevenue || 0,
        },
        userGrowth: {
          newUsers: newUserCount?.newUsers || 0,
          growthRate: userGrowthRate,
        },
        dateRange: {
          startDate,
          endDate,
        },
      };

      await this.cacheManager.set(cacheKey, result, 300);
      return result;
    } catch (error) {
      this.logger.error(`Error calculating dashboard metrics: ${error.message}`);
      return {
        dau: 0,
        mau: 0,
        betVolume: { totalBets: 0, totalVolume: 0, avgBetSize: 0 },
        revenue: { totalRevenue: 0, totalPayouts: 0, netRevenue: 0, betRevenue: 0, spinRevenue: 0 },
        userGrowth: { newUsers: 0, growthRate: 0 },
        dateRange: { startDate: new Date(), endDate: new Date() },
      };
    }
  }
}
