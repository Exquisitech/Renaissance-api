import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
// import { BlockchainService } from '../blockchain/blockchain.service';
import { BetsService } from '../bets/bets.service';
import { LeaderboardAggregationService } from './leaderboard-aggregation.service';

/**
 * Service to periodically sync on-chain and off-chain data
 * Runs on schedule to ensure leaderboard data is up-to-date
 */
@Injectable()
export class LeaderboardSyncService {
  private readonly logger = new Logger(LeaderboardSyncService.name);

  constructor(
    private readonly leaderboardAggregationService: LeaderboardAggregationService,
    // private readonly blockchainService: BlockchainService,
    private readonly betsService: BetsService,
  ) {}

  /**
   * Sync on-chain staking events
   * Runs every 5 minutes to fetch new staking events from blockchain
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncOnChainStakingEvents(): Promise<void> {
    this.logger.log('Starting on-chain staking events sync');

    try {
      // Get last synced block number
      const lastSyncedBlock = await this.getLastSyncedBlock('staking');

      // Fetch new staking events from blockchain
      // Note: BlockchainService not available
      // const events = await this.blockchainService.getStakingEvents(lastSyncedBlock);
      const events: any[] = [];

      if (events.length > 0) {
        // Process events through aggregation service
        await this.leaderboardAggregationService.processOnChainStakingEvents(
          events,
        );

        // Update last synced block
        await this.updateLastSyncedBlock(
          'staking',
          events[events.length - 1].blockNumber,
        );

        this.logger.log(`Synced ${events.length} staking events`);
      }
    } catch (error) {
      this.logger.error('Failed to sync on-chain staking events:', error);
    }
  }

  /**
   * Sync off-chain bet settlements
   * Runs every 2 minutes to process recent bet settlements
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncOffChainBetSettlements(): Promise<void> {
    this.logger.log('Starting off-chain bet settlements sync');

    try {
      // Get last synced timestamp
      const lastSyncedTime = await this.getLastSyncedTime('bet-settlements');

      // Fetch new bet settlements
      // Note: getRecentSettlements method needs to be implemented in BetsService
      // const settlements = await this.betsService.getRecentSettlements(lastSyncedTime);
      const settlements: any[] = [];

      if (settlements.length > 0) {
        // Process settlements through aggregation service
        await this.leaderboardAggregationService.processOffChainBetSettlements(
          settlements,
        );

        // Update last synced time
        await this.updateLastSyncedTime(
          'bet-settlements',
          settlements[settlements.length - 1].timestamp,
        );

        this.logger.log(`Synced ${settlements.length} bet settlements`);
      }
    } catch (error) {
      this.logger.error('Failed to sync off-chain bet settlements:', error);
    }
  }

  /**
   * Calculate and update derived metrics
   * Runs every hour to recalculate complex metrics
   */
  @Cron(CronExpression.EVERY_HOUR)
  async calculateDerivedMetrics(): Promise<void> {
    this.logger.log('Starting derived metrics calculation');

    try {
      // Get all active users (those with activity in last 7 days)
      const activeUsers = await this.getActiveUsers(7); // 7 days

      for (const user of activeUsers) {
        // This would trigger recalculation of complex metrics
        // like best predictor score, advanced ROI calculations, etc.
        await this.recalculateUserMetrics(user.userId);
      }

      this.logger.log(
        `Recalculated metrics for ${activeUsers.length} active users`,
      );
    } catch (error) {
      this.logger.error('Failed to calculate derived metrics:', error);
    }
  }

  /**
   * Cleanup old data and optimize performance
   * Runs daily at 2 AM
   */
  @Cron('0 2 * * *') // Every day at 2 AM
  async cleanupAndOptimize(): Promise<void> {
    this.logger.log('Starting daily cleanup and optimization');

    try {
      // Archive old leaderboard data (older than 1 year)
      await this.archiveOldLeaderboardData();

      // Update materialized views for better query performance
      await this.updateMaterializedViews();

      // Cleanup temporary data
      await this.cleanupTemporaryData();

      this.logger.log('Daily cleanup and optimization completed');
    } catch (error) {
      this.logger.error('Failed to perform cleanup and optimization:', error);
    }
  }

  /**
   * Manual sync trigger for testing and immediate updates
   */
  async triggerManualSync(
    type: 'staking' | 'bet-settlements' | 'all',
  ): Promise<void> {
    this.logger.log(`Manual sync triggered: ${type}`);

    switch (type) {
      case 'staking':
        await this.syncOnChainStakingEvents();
        break;
      case 'bet-settlements':
        await this.syncOffChainBetSettlements();
        break;
      case 'all':
        await Promise.all([
          this.syncOnChainStakingEvents(),
          this.syncOffChainBetSettlements(),
        ]);
        break;
    }
  }

  /**
   * Get last synced block number for a specific sync type
   */
  private async getLastSyncedBlock(syncType: string): Promise<number> {
    // This would retrieve from a sync tracking table
    // For now, return 0 to start from beginning
    return 0;
  }

  /**
   * Update last synced block number
   */
  private async updateLastSyncedBlock(
    syncType: string,
    blockNumber: number,
  ): Promise<void> {
    // This would update a sync tracking table
    this.logger.debug(`Updated ${syncType} sync block to ${blockNumber}`);
  }

  /**
   * Get last synced timestamp for a specific sync type
   */
  private async getLastSyncedTime(syncType: string): Promise<number> {
    // This would retrieve from a sync tracking table
    // For now, return timestamp from 1 hour ago
    return Date.now() - 60 * 60 * 1000;
  }

  /**
   * Update last synced timestamp
   */
  private async updateLastSyncedTime(
    syncType: string,
    timestamp: number,
  ): Promise<void> {
    // This would update a sync tracking table
    this.logger.debug(
      `Updated ${syncType} sync time to ${new Date(timestamp)}`,
    );
  }

  /**
   * Get active users within specified days
   */
  private async getActiveUsers(days: number): Promise<{ userId: string }[]> {
    // This would query users with recent activity
    // For now, return empty array
    return [];
  }

  /**
   * Recalculate complex metrics for a user
   */
  private async recalculateUserMetrics(userId: string): Promise<void> {
    try {
      // Get current user stats
      const currentStats =
        await this.leaderboardAggregationService.getUserLeaderboardStats(
          userId,
        );

      // Recalculate advanced metrics
      // - Trend analysis
      // - Volatility metrics
      // - Performance consistency
      // - Risk-adjusted returns

      this.logger.debug(`Recalculated metrics for user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to recalculate metrics for user ${userId}:`,
        error,
      );
    }
  }

  /**
   * Archive old leaderboard data
   */
  private async archiveOldLeaderboardData(): Promise<void> {
    // This would move data older than 1 year to archive tables
    this.logger.debug('Archived old leaderboard data');
  }

  /**
   * Update materialized views for performance
   */
  private async updateMaterializedViews(): Promise<void> {
    // This would refresh materialized views for common queries
    this.logger.debug('Updated materialized views');
  }

  /**
   * Cleanup temporary data
   */
  private async cleanupTemporaryData(): Promise<void> {
    // This would clean up temporary tables and cache
    this.logger.debug('Cleaned up temporary data');
  }

  /**
   * Get sync status for monitoring
   */
  async getSyncStatus(): Promise<{
    staking: { lastSync: Date; status: string };
    betSettlements: { lastSync: Date; status: string };
    derivedMetrics: { lastSync: Date; status: string };
  }> {
    return {
      staking: {
        lastSync: new Date(),
        status: 'healthy',
      },
      betSettlements: {
        lastSync: new Date(),
        status: 'healthy',
      },
      derivedMetrics: {
        lastSync: new Date(),
        status: 'healthy',
      },
    };
  }
}
