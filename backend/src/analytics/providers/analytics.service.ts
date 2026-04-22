import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, SelectQueryBuilder } from 'typeorm';
import { DateRangeDto } from '../dto/date-range.dto';
import { Bet } from '../../bets/entities/bet.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { Spin } from '../../spin/entities/spin.entity';
import { User } from '../../users/entities/user.entity';
import { Match } from '../../matches/entities/match.entity';
import { NFTListing } from '../../nft/entities/nft-listing.entity';
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
    @InjectRepository(NFTListing)
    private nftListingRepository: Repository<NFTListing>,
    @InjectRepository(Prediction)
    private predictionRepository: Repository<Prediction>,
    private analyticsEventService: AnalyticsEventService,
  ) {}

  private buildDateFilter(dateRange: DateRangeDto) {
    if (!dateRange.startDate || !dateRange.endDate) return {};

    return {
      createdAt: {
        gte: new Date(dateRange.startDate),
        lte: new Date(dateRange.endDate),
      },
    };
  }

  async totalStaked(dateRange: DateRangeDto) {
    const cacheKey = `total_staked_${JSON.stringify(dateRange)}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    try {
      const result = await this.betRepository
        .createQueryBuilder('bet')
        .select('SUM(bet.amount)', 'total')
        .where(this.buildDateFilter(dateRange))
        .getRawOne();

      const total = result?.total || 0;
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
        .where(this.buildDateFilter(dateRange))
        .getRawOne();

      const revenue = revenueResult?.revenue || 0;
      const payout = revenueResult?.payout || 0;
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
      const popularNFTs = await this.nftListingRepository
        .createQueryBuilder('listing')
        .leftJoin('listing.nft', 'nft')
        .select('nft.id', 'nftId')
        .addSelect('nft.name', 'name')
        .addSelect('COUNT(listing.id)', 'listingCount')
        .addSelect('AVG(listing.price)', 'avgPrice')
        .groupBy('nft.id')
        .addGroupBy('nft.name')
        .orderBy('listingCount', 'DESC')
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
        .where(this.buildDateFilter(dateRange))
        .groupBy('bet.status')
        .getRawMany();

      await this.cacheManager.set(cacheKey, stats, 300);
      return stats;
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
          .where(this.buildDateFilter(dateRange))
          .getRawOne(),
        this.spinRepository
          .createQueryBuilder('spin')
          .select('SUM(spin.betAmount)', 'spins')
          .where(this.buildDateFilter(dateRange))
          .getRawOne(),
        this.nftListingRepository
          .createQueryBuilder('listing')
          .select('SUM(listing.price)', 'nfts')
          .where(this.buildDateFilter(dateRange))
          .andWhere('listing.status = :status', { status: 'sold' })
          .getRawOne(),
      ]);

      const totalRevenue = (betRevenue?.bets || 0) + (spinRevenue?.spins || 0) + (nftRevenue?.nfts || 0);

      const result = {
        bets: betRevenue?.bets || 0,
        spins: spinRevenue?.spins || 0,
        nfts: nftRevenue?.nfts || 0,
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
          .where(this.buildDateFilter(dateRange))
          .getRawOne(),
        this.predictionRepository
          .createQueryBuilder('prediction')
          .select('COUNT(prediction.id)', 'totalPredictions')
          .addSelect('SUM(CASE WHEN prediction.isCorrect THEN 1 ELSE 0 END)', 'correctPredictions')
          .where(this.buildDateFilter(dateRange))
          .getRawOne(),
        this.userRepository
          .createQueryBuilder('user')
          .select('COUNT(user.id)', 'totalUsers')
          .addSelect('COUNT(CASE WHEN user.lastLogin > :recent THEN 1 END)', 'activeUsers')
          .where(this.buildDateFilter(dateRange))
          .setParameters({ recent: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) })
          .getRawOne(),
      ]);

      const predictionAccuracy = predictionStats?.totalPredictions > 0
        ? (predictionStats.correctPredictions / predictionStats.totalPredictions) * 100
        : 0;

      const result = {
        matches: {
          total: matchStats?.totalMatches || 0,
          avgGoals: matchStats?.avgGoals || 0,
        },
        predictions: {
          total: predictionStats?.totalPredictions || 0,
          accuracy: predictionAccuracy,
        },
        users: {
          total: userStats?.totalUsers || 0,
          active: userStats?.activeUsers || 0,
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
}
