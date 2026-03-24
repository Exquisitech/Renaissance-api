import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Leaderboard } from '../leaderboard/entities/leaderboard.entity';
import { User } from '../users/entities/user.entity';
// import { BlockchainService } from '../blockchain/blockchain.service';
import { BetsService } from '../bets/bets.service';

/**
 * User leaderboard stats with derived metrics
 */
export interface UserLeaderboardStats {
  userId: string;
  username: string;
  email: string;

  // Basic Stats
  totalBets: number;
  betsWon: number;
  betsLost: number;
  totalWinnings: number;
  totalStaked: number;
  totalStakingRewards: number;
  activeStakes: number;

  // Derived Metrics
  bettingAccuracy: number;
  winningStreak: number;
  highestWinningStreak: number;
  netEarnings: number;
  bestPredictor: number;
  roi: number;

  // Activity Tracking
  lastBetAt: Date;
  lastStakeAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Event interfaces for on-chain data
 */
export interface OnChainStakeEvent {
  userId: string;
  amount: string;
  timestamp: number;
  stakeId: string;
  contractAddress: string;
  rewardsEarned?: string;
}

export interface OffChainBetSettlement {
  userId: string;
  betId: string;
  amount: string;
  isWin: boolean;
  winningsAmount: string;
  timestamp: number;
  betType: string;
  odds: number;
}

/**
 * Aggregated metrics for leaderboard ranking
 */
export interface LeaderboardMetrics {
  // Performance Metrics
  netEarnings: number; // Total winnings - total losses
  roi: number; // Return on investment percentage
  bestPredictor: number; // Prediction accuracy score

  // Activity Metrics
  totalBets: number;
  winningStreak: number;
  avgBetSize: number;

  // Staking Metrics
  totalStaked: number;
  stakingYield: number;
  activeStakes: number;
}

/**
 * Service to aggregate on-chain and off-chain metrics for frontend leaderboards
 * Combines blockchain data with off-chain settlements for comprehensive user statistics
 */
@Injectable()
export class LeaderboardAggregationService {
  private readonly logger = new Logger(LeaderboardAggregationService.name);

  constructor(
    @InjectRepository(Leaderboard)
    private readonly leaderboardRepository: Repository<Leaderboard>,
    private readonly dataSource: DataSource,
    // private readonly blockchainService: BlockchainService,
    private readonly betsService: BetsService,
  ) {}

  /**
   * Get comprehensive user leaderboard stats
   * Combines on-chain and off-chain data
   */
  async getUserLeaderboardStats(userId: string): Promise<UserLeaderboardStats> {
    this.logger.log(`Fetching leaderboard stats for user: ${userId}`);

    // Get base leaderboard data
    const leaderboard = await this.leaderboardRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!leaderboard) {
      throw new Error(`Leaderboard not found for user: ${userId}`);
    }

    // Get additional off-chain data
    const offChainStats = await this.getOffChainBetStats(userId);

    // Get on-chain staking data
    const onChainStakes = await this.getOnChainStakingData(userId);

    // Calculate derived metrics
    const derivedMetrics = this.calculateDerivedMetrics(
      leaderboard,
      offChainStats,
      onChainStakes,
    );

    return {
      userId: leaderboard.userId,
      username: leaderboard.user?.username || 'Unknown',
      email: leaderboard.user?.email || '',

      // Basic Stats
      totalBets: leaderboard.totalBets,
      betsWon: leaderboard.betsWon,
      betsLost: leaderboard.betsLost,
      totalWinnings: Number(leaderboard.totalWinnings),
      totalStaked: Number(leaderboard.totalStaked),
      totalStakingRewards: Number(leaderboard.totalStakingRewards),
      activeStakes: Number(leaderboard.activeStakes),

      // Derived Metrics
      bettingAccuracy: Number(leaderboard.bettingAccuracy),
      winningStreak: leaderboard.winningStreak,
      highestWinningStreak: leaderboard.highestWinningStreak,
      netEarnings: derivedMetrics.netEarnings,
      bestPredictor: derivedMetrics.bestPredictor,
      roi: derivedMetrics.roi,

      // Activity Tracking
      lastBetAt: leaderboard.lastBetAt,
      lastStakeAt: leaderboard.lastStakeAt,
      createdAt: leaderboard.createdAt,
      updatedAt: leaderboard.updatedAt,
    };
  }

  /**
   * Get top users by various metrics
   * Supports multiple ranking criteria
   */
  async getTopLeaderboard(
    limit: number = 100,
    offset: number = 0,
    orderBy:
      | 'netEarnings'
      | 'roi'
      | 'bestPredictor'
      | 'winningStreak'
      | 'totalBets' = 'netEarnings',
  ): Promise<UserLeaderboardStats[]> {
    this.logger.log(`Fetching top leaderboard: ${orderBy}, limit: ${limit}`);

    const query = this.leaderboardRepository
      .createQueryBuilder('leaderboard')
      .leftJoinAndSelect('leaderboard.user', 'user')
      .select([
        'leaderboard.id',
        'leaderboard.userId',
        'leaderboard.totalBets',
        'leaderboard.betsWon',
        'leaderboard.betsLost',
        'leaderboard.totalWinnings',
        'leaderboard.totalStaked',
        'leaderboard.totalStakingRewards',
        'leaderboard.activeStakes',
        'leaderboard.bettingAccuracy',
        'leaderboard.winningStreak',
        'leaderboard.highestWinningStreak',
        'leaderboard.lastBetAt',
        'leaderboard.lastStakeAt',
        'leaderboard.createdAt',
        'leaderboard.updatedAt',
        'user.id',
        'user.username',
        'user.email',
      ]);

    // Apply ordering based on derived metrics
    switch (orderBy) {
      case 'netEarnings':
        query.orderBy('leaderboard.totalWinnings', 'DESC');
        break;
      case 'roi':
        query
          .where('leaderboard.totalBets > :minBets', { minBets: 10 })
          .orderBy('leaderboard.bettingAccuracy', 'DESC');
        break;
      case 'bestPredictor':
        query
          .where('leaderboard.totalBets > :minBets', { minBets: 20 })
          .orderBy('leaderboard.bettingAccuracy', 'DESC');
        break;
      case 'winningStreak':
        query.orderBy('leaderboard.winningStreak', 'DESC');
        break;
      case 'totalBets':
        query.orderBy('leaderboard.totalBets', 'DESC');
        break;
    }

    const results = await query.skip(offset).take(limit).getMany();

    // Calculate derived metrics for each result
    return Promise.all(
      results.map(async (leaderboard) => {
        const offChainStats = await this.getOffChainBetStats(
          leaderboard.userId,
        );
        const onChainStakes = await this.getOnChainStakingData(
          leaderboard.userId,
        );
        const derivedMetrics = this.calculateDerivedMetrics(
          leaderboard,
          offChainStats,
          onChainStakes,
        );

        return {
          userId: leaderboard.userId,
          username: leaderboard.user?.username || 'Unknown',
          email: leaderboard.user?.email || '',

          // Basic Stats
          totalBets: leaderboard.totalBets,
          betsWon: leaderboard.betsWon,
          betsLost: leaderboard.betsLost,
          totalWinnings: Number(leaderboard.totalWinnings),
          totalStaked: Number(leaderboard.totalStaked),
          totalStakingRewards: Number(leaderboard.totalStakingRewards),
          activeStakes: Number(leaderboard.activeStakes),

          // Derived Metrics
          bettingAccuracy: Number(leaderboard.bettingAccuracy),
          winningStreak: leaderboard.winningStreak,
          highestWinningStreak: leaderboard.highestWinningStreak,
          netEarnings: derivedMetrics.netEarnings,
          bestPredictor: derivedMetrics.bestPredictor,
          roi: derivedMetrics.roi,

          // Activity Tracking
          lastBetAt: leaderboard.lastBetAt,
          lastStakeAt: leaderboard.lastStakeAt,
          createdAt: leaderboard.createdAt,
          updatedAt: leaderboard.updatedAt,
        };
      }),
    );
  }

  /**
   * Process on-chain staking events
   * Called by event listeners or cron jobs
   */
  async processOnChainStakingEvents(
    events: OnChainStakeEvent[],
  ): Promise<void> {
    this.logger.log(`Processing ${events.length} staking events`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const event of events) {
        let leaderboard = await queryRunner.manager.findOne(Leaderboard, {
          where: { userId: event.userId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!leaderboard) {
          leaderboard = queryRunner.manager.create(Leaderboard, {
            userId: event.userId,
            totalStaked: Number(event.amount),
            activeStakes: Number(event.amount),
            lastStakeAt: new Date(event.timestamp * 1000),
          });
        } else {
          // Update staking stats
          leaderboard.totalStaked += Number(event.amount);
          if (event.rewardsEarned) {
            leaderboard.totalStakingRewards += Number(event.rewardsEarned);
          }
          leaderboard.lastStakeAt = new Date(event.timestamp * 1000);
        }

        await queryRunner.manager.save(leaderboard);
      }

      await queryRunner.commitTransaction();
      this.logger.log(`Successfully processed ${events.length} staking events`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to process staking events:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Process off-chain bet settlements
   * Called by event listeners or cron jobs
   */
  async processOffChainBetSettlements(
    settlements: OffChainBetSettlement[],
  ): Promise<void> {
    this.logger.log(`Processing ${settlements.length} bet settlements`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const settlement of settlements) {
        let leaderboard = await queryRunner.manager.findOne(Leaderboard, {
          where: { userId: settlement.userId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!leaderboard) {
          leaderboard = queryRunner.manager.create(Leaderboard, {
            userId: settlement.userId,
            totalBets: 1,
            betsWon: settlement.isWin ? 1 : 0,
            betsLost: settlement.isWin ? 0 : 1,
            totalWinnings: settlement.isWin
              ? Number(settlement.winningsAmount)
              : 0,
            lastBetAt: new Date(settlement.timestamp * 1000),
          });
        } else {
          // Update betting stats
          leaderboard.totalBets++;

          if (settlement.isWin) {
            leaderboard.betsWon++;
            leaderboard.totalWinnings += Number(settlement.winningsAmount);
          } else {
            leaderboard.betsLost++;
          }

          // Update derived metrics
          leaderboard.recalculateAccuracy();
          leaderboard.updateWinningStreak(settlement.isWin);
          leaderboard.lastBetAt = new Date(settlement.timestamp * 1000);
        }

        await queryRunner.manager.save(leaderboard);
      }

      await queryRunner.commitTransaction();
      this.logger.log(
        `Successfully processed ${settlements.length} bet settlements`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to process bet settlements:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get off-chain betting statistics
   * Retrieves additional betting data not stored on-chain
   */
  private async getOffChainBetStats(userId: string): Promise<any> {
    try {
      // This would query additional off-chain betting data
      // For now, return empty object
      return {};
    } catch (error) {
      this.logger.warn(
        `Failed to fetch off-chain stats for user ${userId}:`,
        error,
      );
      return {};
    }
  }

  /**
   * Get on-chain staking data
   * Retrieves current staking information from blockchain
   */
  private async getOnChainStakingData(userId: string): Promise<any> {
    try {
      // This would query blockchain for current staking data
      // For now, return empty object
      return {};
    } catch (error) {
      this.logger.warn(
        `Failed to fetch on-chain staking data for user ${userId}:`,
        error,
      );
      return {};
    }
  }

  /**
   * Calculate derived metrics for leaderboard
   * Combines multiple data sources for comprehensive stats
   */
  private calculateDerivedMetrics(
    leaderboard: Leaderboard,
    offChainStats: any,
    onChainStakes: any,
  ): LeaderboardMetrics {
    // Net Earnings = Total Winnings - Total Losses
    const totalLosses = (leaderboard.totalBets - leaderboard.betsWon) * 100; // Assuming avg bet of 100
    const netEarnings = Number(leaderboard.totalWinnings) - totalLosses;

    // ROI = (Net Earnings / Total Investment) * 100
    const totalInvestment = Number(leaderboard.totalBets) * 100; // Assuming avg bet of 100
    const roi = totalInvestment > 0 ? (netEarnings / totalInvestment) * 100 : 0;

    // Best Predictor Score = Weighted combination of accuracy and volume
    const accuracyWeight = 0.7;
    const volumeWeight = 0.3;
    const volumeScore = Math.min(leaderboard.totalBets / 100, 1); // Normalize to 0-1
    const bestPredictor =
      Number(leaderboard.bettingAccuracy) * accuracyWeight +
      volumeScore * 100 * volumeWeight;

    // Staking Yield = (Rewards / Total Staked) * 100
    const stakingYield =
      Number(leaderboard.totalStaked) > 0
        ? (Number(leaderboard.totalStakingRewards) /
            Number(leaderboard.totalStaked)) *
          100
        : 0;

    // Average Bet Size = Total Winnings / Bets Won
    const avgBetSize =
      leaderboard.betsWon > 0
        ? Number(leaderboard.totalWinnings) / leaderboard.betsWon
        : 0;

    return {
      netEarnings,
      roi,
      bestPredictor,
      totalBets: leaderboard.totalBets,
      winningStreak: leaderboard.winningStreak,
      avgBetSize,
      totalStaked: Number(leaderboard.totalStaked),
      stakingYield,
      activeStakes: Number(leaderboard.activeStakes),
    };
  }

  /**
   * Real-time update handler for live leaderboard updates
   * Called by WebSocket or event listeners
   */
  async handleRealTimeUpdate(
    userId: string,
    updateType: 'bet' | 'stake' | 'settlement',
    data: any,
  ): Promise<void> {
    this.logger.debug(`Real-time update for user ${userId}: ${updateType}`);

    switch (updateType) {
      case 'bet':
        // Handle new bet placement
        await this.handleBetUpdate(userId, data);
        break;
      case 'stake':
        // Handle staking activity
        await this.handleStakeUpdate(userId, data);
        break;
      case 'settlement':
        // Handle bet settlement
        await this.handleSettlementUpdate(userId, data);
        break;
    }
  }

  /**
   * Handle bet-related real-time updates
   */
  private async handleBetUpdate(userId: string, data: any): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const leaderboard = await queryRunner.manager.findOne(Leaderboard, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (leaderboard) {
        leaderboard.lastBetAt = new Date();
        await queryRunner.manager.save(leaderboard);
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to handle bet update for user ${userId}:`,
        error,
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Handle staking-related real-time updates
   */
  private async handleStakeUpdate(userId: string, data: any): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const leaderboard = await queryRunner.manager.findOne(Leaderboard, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (leaderboard) {
        leaderboard.lastStakeAt = new Date();
        if (data.amount) {
          leaderboard.activeStakes += Number(data.amount);
        }
        await queryRunner.manager.save(leaderboard);
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to handle stake update for user ${userId}:`,
        error,
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Handle settlement-related real-time updates
   */
  private async handleSettlementUpdate(
    userId: string,
    data: any,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const leaderboard = await queryRunner.manager.findOne(Leaderboard, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (leaderboard) {
        if (data.isWin) {
          leaderboard.betsWon++;
          leaderboard.totalWinnings += Number(data.amount);
        } else {
          leaderboard.betsLost++;
        }

        leaderboard.totalBets++;
        leaderboard.recalculateAccuracy();
        leaderboard.updateWinningStreak(data.isWin);
        leaderboard.lastBetAt = new Date();

        await queryRunner.manager.save(leaderboard);
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to handle settlement update for user ${userId}:`,
        error,
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get leaderboard summary statistics
   * Useful for admin dashboards and analytics
   */
  async getLeaderboardSummary(): Promise<{
    totalUsers: number;
    activeUsers: number;
    totalBets: number;
    totalWinnings: number;
    avgAccuracy: number;
    topEarners: UserLeaderboardStats[];
  }> {
    const [totalUsers, activeUsers] = await Promise.all([
      this.leaderboardRepository.count(),
      this.leaderboardRepository
        .createQueryBuilder('leaderboard')
        .where('leaderboard.lastBetAt > :date', {
          date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        })
        .getCount(),
    ]);

    const stats = await this.leaderboardRepository
      .createQueryBuilder('leaderboard')
      .select([
        'COUNT(*) as totalBets',
        'SUM(leaderboard.totalWinnings) as totalWinnings',
        'AVG(leaderboard.bettingAccuracy) as avgAccuracy',
      ])
      .getRawOne();

    const topEarners = await this.getTopLeaderboard(10, 0, 'netEarnings');

    return {
      totalUsers,
      activeUsers,
      totalBets: Number(stats.totalBets) || 0,
      totalWinnings: Number(stats.totalWinnings) || 0,
      avgAccuracy: Number(stats.avgAccuracy) || 0,
      topEarners,
    };
  }
}
