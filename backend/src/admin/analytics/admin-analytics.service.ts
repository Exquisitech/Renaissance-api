import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  AdminRevenueAnalytics,
  AdminUserActivity,
  AdminGeographicalStats,
  AdminTrendAnalysis,
  AdminBetVolume,
  AdminRealTimeMetrics,
  TimeGranularity,
} from './entities/admin-analytics.entity';
import { User, UserStatus } from '../../users/entities/user.entity';
import { Transaction, TransactionType, TransactionStatus } from '../../transactions/entities/transaction.entity';
import { SpinGame, SpinStatus, RewardType } from '../../spin-game/entities/spin-game.entity';
import { Bet } from '../../bets/entities/bet.entity';

export interface RevenueQueryParams {
  startDate: string;
  endDate: string;
  granularity?: TimeGranularity;
}

export interface UserActivityQueryParams {
  startDate: string;
  endDate: string;
}

export interface BetVolumeQueryParams {
  startDate: string;
  endDate: string;
  granularity?: TimeGranularity;
}

export interface TrendQueryParams {
  metricName: string;
  startDate: string;
  endDate: string;
}

export interface GeoQueryParams {
  limit?: number;
  sortBy?: 'userCount' | 'revenue' | 'volume';
}

@Injectable()
export class AdminAnalyticsService {
  private readonly logger = new Logger(AdminAnalyticsService.name);

  constructor(
    @InjectRepository(AdminRevenueAnalytics)
    private revenueRepo: Repository<AdminRevenueAnalytics>,
    @InjectRepository(AdminUserActivity)
    private userActivityRepo: Repository<AdminUserActivity>,
    @InjectRepository(AdminGeographicalStats)
    private geoRepo: Repository<AdminGeographicalStats>,
    @InjectRepository(AdminTrendAnalysis)
    private trendRepo: Repository<AdminTrendAnalysis>,
    @InjectRepository(AdminBetVolume)
    private betVolumeRepo: Repository<AdminBetVolume>,
    @InjectRepository(AdminRealTimeMetrics)
    private realTimeRepo: Repository<AdminRealTimeMetrics>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Transaction)
    private transactionRepo: Repository<Transaction>,
    @InjectRepository(SpinGame)
    private spinGameRepo: Repository<SpinGame>,
    @InjectRepository(Bet)
    private betRepo: Repository<Bet>,
    private configService: ConfigService,
  ) {}

  // ==================== REVENUE ANALYTICS ====================

  async getRevenueAnalytics(params: RevenueQueryParams) {
    const { startDate, endDate, granularity = TimeGranularity.DAILY } = params;

    // Try to get from stored analytics first
    const stored = await this.revenueRepo.find({
      where: {
        date: Between(new Date(startDate), new Date(endDate)),
      },
      order: { date: 'ASC' },
    });

    if (stored.length > 0) {
      return this.formatRevenueResponse(stored, granularity);
    }

    // Otherwise compute from raw data
    return this.computeRevenueAnalytics(startDate, endDate, granularity);
  }

  private async computeRevenueAnalytics(startDate: string, endDate: string, granularity: TimeGranularity) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Get transactions for the period
    const transactions = await this.transactionRepo.find({
      where: {
        createdAt: Between(start, end),
        status: TransactionStatus.COMPLETED,
      },
    });

    // Get spin games for the period
    const spinGames = await this.spinGameRepo.find({
      where: {
        createdAt: Between(start, end),
        status: SpinStatus.COMPLETED,
      },
    });

    // Get bets for the period
    const bets = await this.betRepo.find({
      where: {
        createdAt: Between(start, end),
      },
    });

    // Group by date
    const dailyData = this.groupByDate(transactions, spinGames, bets, start, end);

    return Object.entries(dailyData).map(([date, data]: [string, any]) => ({
      date,
      totalStaked: data.totalStaked,
      totalPayout: data.totalPayout,
      netRevenue: data.netRevenue,
      spinGameRevenue: data.spinGameRevenue,
      betRevenue: data.betRevenue,
      jackpotPayout: data.jackpotPayout,
      totalTransactions: data.transactionCount,
      payoutRate: data.totalStaked > 0 ? (data.totalPayout / data.totalStaked) * 100 : 0,
    }));
  }

  private groupByDate(transactions: Transaction[], spinGames: SpinGame[], bets: Bet[], start: Date, end: Date): Record<string, any> {
    const result: Record<string, any> = {};

    // Initialize all days in range
    const current = new Date(start);
    while (current <= end) {
      const dateKey = current.toISOString().split('T')[0];
      result[dateKey] = {
        totalStaked: 0,
        totalPayout: 0,
        netRevenue: 0,
        spinGameRevenue: 0,
        betRevenue: 0,
        jackpotPayout: 0,
        transactionCount: 0,
      };
      current.setDate(current.getDate() + 1);
    }

    // Process transactions
    for (const tx of transactions) {
      const dateKey = tx.createdAt.toISOString().split('T')[0];
      if (!result[dateKey]) continue;

      result[dateKey].transactionCount++;

      if (tx.type === TransactionType.BET_PLACEMENT) {
        result[dateKey].totalStaked += Number(tx.amount);
      } else if (tx.type === TransactionType.BET_WINNING) {
        result[dateKey].totalPayout += Number(tx.amount);
      }
    }

    // Process spin games
    for (const spin of spinGames) {
      const dateKey = spin.createdAt.toISOString().split('T')[0];
      if (!result[dateKey]) continue;

      result[dateKey].totalStaked += Number(spin.stakeAmount);
      if (spin.rewardType !== RewardType.LOSS && spin.winAmount) {
        result[dateKey].totalPayout += Number(spin.winAmount);
        result[dateKey].spinGameRevenue += Number(spin.stakeAmount) - Number(spin.winAmount);
      } else {
        result[dateKey].spinGameRevenue += Number(spin.stakeAmount);
      }
    }

    // Process bets
    for (const bet of bets) {
      const dateKey = bet.createdAt.toISOString().split('T')[0];
      if (!result[dateKey]) continue;

      result[dateKey].totalStaked += Number(bet.stakeAmount);
    }

    // Calculate net revenue
    for (const dateKey of Object.keys(result)) {
      result[dateKey].netRevenue = result[dateKey].totalStaked - result[dateKey].totalPayout;
    }

    return result;
  }

  private formatRevenueResponse(data: AdminRevenueAnalytics[], granularity: TimeGranularity) {
    return data.map((item) => ({
      date: item.date,
      totalStaked: Number(item.totalStaked),
      totalPayout: Number(item.totalPayout),
      netRevenue: Number(item.netRevenue),
      spinGameRevenue: Number(item.spinGameRevenue),
      betRevenue: Number(item.betRevenue),
      jackpotPayout: Number(item.jackpotPayout),
      totalTransactions: item.totalTransactions,
      payoutRate: Number(item.payoutRate),
    }));
  }

  // ==================== USER ACTIVITY ====================

  async getUserActivity(params: UserActivityQueryParams) {
    const { startDate, endDate } = params;
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Try to get from stored analytics first
    const stored = await this.userActivityRepo.find({
      where: {
        date: Between(start, end),
      },
      order: { date: 'ASC' },
    });

    if (stored.length > 0) {
      return this.formatUserActivityResponse(stored);
    }

    // Compute from raw data
    return this.computeUserActivity(startDate, endDate);
  }

  private async computeUserActivity(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Get all users
    const totalUsers = await this.userRepo.count({
      where: { status: UserStatus.ACTIVE },
    });

    // Get users created in period
    const newUsers = await this.userRepo.count({
      where: {
        createdAt: Between(start, end),
      },
    });

    // Get users with activity in period
    const activeUsers = await this.userRepo
      .createQueryBuilder('user')
      .leftJoin('user.transactions', 'tx')
      .where('tx.createdAt BETWEEN :start AND :end', { start, end })
      .andWhere('tx.status = :status', { status: TransactionStatus.COMPLETED })
      .distinct(true)
      .getCount();

    // Group activity by day
    const activityByDay = await this.transactionRepo
      .createQueryBuilder('tx')
      .select('DATE(tx.createdAt)', 'date')
      .addSelect('COUNT(DISTINCT tx.userId)', 'activeUsers')
      .where('tx.createdAt BETWEEN :start AND :end', { start, end })
      .andWhere('tx.status = :status', { status: TransactionStatus.COMPLETED })
      .groupBy('DATE(tx.createdAt)')
      .orderBy('date', 'ASC')
      .getRawMany();

    return activityByDay.map((day) => ({
      date: day.date,
      totalUsers,
      activeUsers: parseInt(day.activeUsers) || 0,
      newUsers: 0, // Would need more complex query
      returningUsers: parseInt(day.activeUsers) || 0,
      activeRate: totalUsers > 0 ? (parseInt(day.activeUsers) / totalUsers) * 100 : 0,
    }));
  }

  private formatUserActivityResponse(data: AdminUserActivity[]) {
    return data.map((item) => ({
      date: item.date,
      totalUsers: item.totalUsers,
      activeUsers: item.activeUsers,
      newUsers: item.newUsers,
      returningUsers: item.returningUsers,
      activeRate: Number(item.activeRate),
      retentionRate: Number(item.retentionRate),
    }));
  }

  // ==================== BET VOLUME ====================

  async getBetVolume(params: BetVolumeQueryParams) {
    const { startDate, endDate, granularity = TimeGranularity.DAILY } = params;
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Try stored first
    const stored = await this.betVolumeRepo.find({
      where: {
        date: Between(start, end),
        granularity,
      },
      order: { date: 'ASC' },
    });

    if (stored.length > 0) {
      return this.formatBetVolumeResponse(stored);
    }

    // Compute from raw data
    return this.computeBetVolume(startDate, endDate, granularity);
  }

  private async computeBetVolume(startDate: string, endDate: string, granularity: TimeGranularity) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const [spinGames, bets] = await Promise.all([
      this.spinGameRepo.find({
        where: { createdAt: Between(start, end), status: SpinStatus.COMPLETED },
      }),
      this.betRepo.find({
        where: { createdAt: Between(start, end) },
      }),
    ]);

    // Group by day
    const dailyData: Record<string, any> = {};

    // Initialize days
    const current = new Date(start);
    while (current <= end) {
      const dateKey = current.toISOString().split('T')[0];
      dailyData[dateKey] = {
        totalBets: 0,
        spinGames: 0,
        sportsBets: 0,
        totalVolume: 0,
        spinGameVolume: 0,
        sportsBetVolume: 0,
      };
      current.setDate(current.getDate() + 1);
    }

    // Process spin games
    for (const spin of spinGames) {
      const dateKey = spin.createdAt.toISOString().split('T')[0];
      if (dailyData[dateKey]) {
        dailyData[dateKey].spinGames++;
        dailyData[dateKey].totalBets++;
        dailyData[dateKey].totalVolume += Number(spin.stakeAmount);
        dailyData[dateKey].spinGameVolume += Number(spin.stakeAmount);
      }
    }

    // Process bets
    for (const bet of bets) {
      const dateKey = bet.createdAt.toISOString().split('T')[0];
      if (dailyData[dateKey]) {
        dailyData[dateKey].sportsBets++;
        dailyData[dateKey].totalBets++;
        dailyData[dateKey].totalVolume += Number(bet.amount);
        dailyData[dateKey].sportsBetVolume += Number(bet.amount);
      }
    }

    // Calculate averages
    return Object.entries(dailyData).map(([date, data]: [string, any]) => {
      const totalBets = data.totalBets;
      return {
        date,
        totalBets: data.totalBets,
        spinGames: data.spinGames,
        sportsBets: data.sportsBets,
        totalVolume: data.totalVolume,
        spinGameVolume: data.spinGameVolume,
        sportsBetVolume: data.sportsBetVolume,
        avgBetSize: totalBets > 0 ? data.totalVolume / totalBets : 0,
        maxBetSize: Math.max(
          ...spinGames.filter((s) => s.createdAt.toISOString().split('T')[0] === date).map((s) => Number(s.stakeAmount)),
          0,
        ),
        minBetSize: Math.min(
          ...spinGames.filter((s) => s.createdAt.toISOString().split('T')[0] === date).map((s) => Number(s.stakeAmount)),
          0,
        ),
      };
    });
  }

  private formatBetVolumeResponse(data: AdminBetVolume[]) {
    return data.map((item) => ({
      date: item.date,
      hour: item.hour,
      totalBets: item.totalBets,
      spinGames: item.spinGames,
      sportsBets: item.sportsBets,
      totalVolume: Number(item.totalVolume),
      spinGameVolume: Number(item.spinGameVolume),
      sportsBetVolume: Number(item.sportsBetVolume),
      avgBetSize: Number(item.avgBetSize),
      maxBetSize: Number(item.maxBetSize),
      minBetSize: Number(item.minBetSize),
    }));
  }

  // ==================== GEOGRAPHICAL DISTRIBUTION ====================

  async getGeographicalStats(params: GeoQueryParams = {}) {
    const { limit = 20, sortBy = 'userCount' } = params;

    // Try stored first
    const stored = await this.geoRepo.find({
      order: { [sortBy === 'revenue' ? 'totalRevenue' : sortBy === 'volume' ? 'transactionCount' : 'userCount']: 'DESC' },
      take: limit,
    });

    if (stored.length > 0) {
      return this.formatGeoResponse(stored);
    }

    // Compute from raw data - aggregate by location
    const usersWithLocation = await this.userRepo
      .createQueryBuilder('user')
      .select('user.location', 'location')
      .addSelect('COUNT(*)', 'count')
      .where('user.location IS NOT NULL')
      .groupBy('user.location')
      .getRawMany();

    return usersWithLocation.slice(0, limit).map((item) => ({
      countryCode: item.location?.substring(0, 2).toUpperCase() || 'XX',
      countryName: item.location || 'Unknown',
      userCount: parseInt(item.count) || 0,
      activeUsers: Math.floor(parseInt(item.count) * 0.7), // Estimate
      totalStaked: 0,
      totalRevenue: 0,
      transactionCount: 0,
    }));
  }

  private formatGeoResponse(data: AdminGeographicalStats[]) {
    return data.map((item) => ({
      countryCode: item.countryCode,
      countryName: item.countryName,
      userCount: item.userCount,
      activeUsers: item.activeUsers,
      totalStaked: Number(item.totalStaked),
      totalRevenue: Number(item.totalRevenue),
      transactionCount: item.transactionCount,
    }));
  }

  // ==================== TREND ANALYSIS ====================

  async getTrendAnalysis(params: TrendQueryParams) {
    const { metricName, startDate, endDate } = params;
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Try stored first
    const stored = await this.trendRepo.find({
      where: {
        metricName,
        date: Between(start, end),
      },
      order: { date: 'ASC' },
    });

    if (stored.length > 0) {
      return this.formatTrendResponse(stored);
    }

    // Compute trends based on metric name
    return this.computeTrends(metricName, startDate, endDate);
  }

  private async computeTrends(metricName: string, startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const sevenDaysAgo = new Date(start);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date(start);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let currentValue = 0;
    let previousValue = 0;
    let value7DaysAgo = 0;
    let value30DaysAgo = 0;

    switch (metricName) {
      case 'revenue':
        const currentTx = await this.transactionRepo
          .createQueryBuilder('tx')
          .select('SUM(CASE WHEN tx.type = :betType THEN tx.amount ELSE 0 END) - SUM(CASE WHEN tx.type = :winType THEN tx.amount ELSE 0 END)', 'revenue')
          .setParameter('betType', TransactionType.BET_PLACEMENT)
          .setParameter('winType', TransactionType.BET_WINNING)
          .where('tx.createdAt BETWEEN :start AND :end', { start, end })
          .andWhere('tx.status = :status', { status: TransactionStatus.COMPLETED })
          .getRawOne();
        currentValue = Number(currentTx?.revenue || 0);
        break;

      case 'activeUsers':
        currentValue = await this.userRepo
          .createQueryBuilder('user')
          .leftJoin('user.transactions', 'tx')
          .where('tx.createdAt BETWEEN :start AND :end', { start, end })
          .distinct(true)
          .getCount();
        break;

      case 'betVolume':
        const volumeData = await this.spinGameRepo
          .createQueryBuilder('spin')
          .select('SUM(spin.stakeAmount)', 'volume')
          .where('spin.createdAt BETWEEN :start AND :end', { start, end })
          .andWhere('spin.status = :status', { status: SpinStatus.COMPLETED })
          .getRawOne();
        currentValue = Number(volumeData?.volume || 0);
        break;

      default:
        currentValue = 0;
    }

    const dailyChange = previousValue > 0 ? ((currentValue - previousValue) / previousValue) * 100 : 0;
    const weeklyChange = value7DaysAgo > 0 ? ((currentValue - value7DaysAgo) / value7DaysAgo) * 100 : 0;
    const monthlyChange = value30DaysAgo > 0 ? ((currentValue - value30DaysAgo) / value30DaysAgo) * 100 : 0;

    return {
      metricName,
      startDate,
      endDate,
      currentValue,
      previousValue,
      value7DaysAgo,
      value30DaysAgo,
      dailyChange,
      weeklyChange,
      monthlyChange,
      movingAverage7Days: currentValue, // Simplified
      movingAverage30Days: currentValue, // Simplified
    };
  }

  private formatTrendResponse(data: AdminTrendAnalysis[]) {
    return data.map((item) => ({
      date: item.date,
      currentValue: Number(item.currentValue),
      previousValue: Number(item.previousValue),
      value7DaysAgo: Number(item.value7DaysAgo),
      value30DaysAgo: Number(item.value30DaysAgo),
      dailyChange: Number(item.dailyChange),
      weeklyChange: Number(item.weeklyChange),
      monthlyChange: Number(item.monthlyChange),
      movingAverage7Days: Number(item.movingAverage7Days),
      movingAverage30Days: Number(item.movingAverage30Days),
    }));
  }

  // ==================== REAL-TIME METRICS ====================

  async getRealTimeMetrics() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const todayStart = new Date(now.toISOString().split('T')[0]);

    // Get current active users (users with transactions in last hour)
    const activeUsersLastHour = await this.transactionRepo
      .createQueryBuilder('tx')
      .select('COUNT(DISTINCT tx.userId)', 'count')
      .where('tx.createdAt >= :oneHourAgo', { oneHourAgo })
      .andWhere('tx.status = :status', { status: TransactionStatus.COMPLETED })
      .getRawOne();

    // Get today's stats
    const todayStats = await this.transactionRepo
      .createQueryBuilder('tx')
      .select('COUNT(*)', 'count')
      .addSelect('SUM(CASE WHEN tx.type = :betType THEN tx.amount ELSE 0 END)', 'staked')
      .addSelect('SUM(CASE WHEN tx.type = :winType THEN tx.amount ELSE 0 END)', 'payout')
      .setParameter('betType', TransactionType.BET_PLACEMENT)
      .setParameter('winType', TransactionType.BET_WINNING)
      .where('tx.createdAt >= :todayStart', { todayStart })
      .andWhere('tx.status = :status', { status: TransactionStatus.COMPLETED })
      .getRawOne();

    // Get spin games today
    const spinGamesToday = await this.spinGameRepo
      .createQueryBuilder('spin')
      .select('COUNT(*)', 'count')
      .addSelect('SUM(spin.stakeAmount)', 'volume')
      .addSelect('SUM(CASE WHEN spin.rewardType != :lossType AND spin.winAmount IS NOT NULL THEN spin.winAmount ELSE 0 END)', 'payout')
      .setParameter('lossType', RewardType.LOSS)
      .where('spin.createdAt >= :todayStart', { todayStart })
      .andWhere('spin.status = :status', { status: SpinStatus.COMPLETED })
      .getRawOne();

    return {
      timestamp: now.toISOString(),
      metrics: {
        activeUsersLastHour: parseInt(activeUsersLastHour?.count || 0),
        transactionsToday: parseInt(todayStats?.count || 0),
        volumeToday: Number(todayStats?.staked || 0),
        payoutToday: Number(todayStats?.payout || 0),
        spinGamesToday: parseInt(spinGamesToday?.count || 0),
        spinGameVolumeToday: Number(spinGamesToday?.volume || 0),
        spinGamePayoutToday: Number(spinGamesToday?.payout || 0),
      },
    };
  }

  // ==================== EXPORTABLE REPORTS ====================

  async generateReport(params: {
    type: 'revenue' | 'user_activity' | 'bet_volume' | 'geographical';
    startDate: string;
    endDate: string;
    format: 'json' | 'csv';
  }) {
    let data: any[];

    switch (params.type) {
      case 'revenue':
        data = await this.getRevenueAnalytics({ startDate: params.startDate, endDate: params.endDate });
        break;
      case 'user_activity':
        data = await this.getUserActivity({ startDate: params.startDate, endDate: params.endDate });
        break;
      case 'bet_volume':
        data = await this.getBetVolume({ startDate: params.startDate, endDate: params.endDate });
        break;
      case 'geographical':
        data = await this.getGeographicalStats({});
        break;
      default:
        data = [];
    }

    if (params.format === 'csv') {
      return this.convertToCSV(data);
    }

    return data;
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const rows = data.map((item) => headers.map((header) => JSON.stringify(item[header] || '')).join(','));
    return [headers.join(','), ...rows].join('\n');
  }

  // ==================== DASHBOARD SUMMARY ====================

  async getDashboardSummary() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    const [todayRevenue, yesterdayRevenue, monthRevenue, activeUsers, totalUsers] = await Promise.all([
      this.getRevenueAnalytics({ startDate: today, endDate: today }),
      this.getRevenueAnalytics({ startDate: yesterday, endDate: yesterday }),
      this.getRevenueAnalytics({ startDate: thisMonthStart, endDate: today }),
      this.transactionRepo
        .createQueryBuilder('tx')
        .select('COUNT(DISTINCT tx.userId)', 'count')
        .where('tx.createdAt >= :oneDayAgo', { oneDayAgo: new Date(now.getTime() - 24 * 60 * 60 * 1000) })
        .andWhere('tx.status = :status', { status: TransactionStatus.COMPLETED })
        .getRawOne(),
      this.userRepo.count({ where: { status: UserStatus.ACTIVE } }),
    ]);

    const todayData = todayRevenue[0] || { netRevenue: 0, totalStaked: 0 };
    const yesterdayData = yesterdayRevenue[0] || { netRevenue: 0, totalStaked: 0 };
    const monthData = monthRevenue.reduce(
      (acc, day) => ({
        netRevenue: acc.netRevenue + Number(day.netRevenue),
        totalStaked: acc.totalStaked + Number(day.totalStaked),
      }),
      { netRevenue: 0, totalStaked: 0 },
    );

    const dailyChange = yesterdayData.netRevenue !== 0 ? ((Number(todayData.netRevenue) - Number(yesterdayData.netRevenue)) / Number(yesterdayData.netRevenue)) * 100 : 0;

    return {
      summary: {
        today: {
          revenue: Number(todayData.netRevenue),
          staked: Number(todayData.totalStaked),
          change: dailyChange,
        },
        month: {
          revenue: monthData.netRevenue,
          staked: monthData.totalStaked,
        },
        users: {
          active: parseInt(activeUsers?.count || 0),
          total: totalUsers,
        },
      },
      timestamp: now.toISOString(),
    };
  }
}