import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';
import { LeaderboardAggregationService } from '../leaderboard/leaderboard-aggregation.service';

/**
 * Service to integrate notifications with other system events
 * Handles event-driven notifications for bet outcomes, spin rewards, and leaderboard changes
 */
@Injectable()
export class NotificationIntegrationService {
  private readonly logger = new Logger(NotificationIntegrationService.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly leaderboardAggregationService: LeaderboardAggregationService,
  ) {}

  /**
   * Handle bet settlement event
   * Creates notification for bet outcome
   */
  async handleBetSettlement(
    userId: string,
    betId: string,
    isWin: boolean,
    amount: number,
    winningsAmount: number,
    betType: string,
    odds: number,
  ): Promise<void> {
    this.logger.log(
      `Processing bet settlement notification for user ${userId}`,
    );

    try {
      await this.notificationsService.createBetOutcomeNotification(userId, {
        betId,
        isWin,
        amount,
        winningsAmount: isWin ? winningsAmount : undefined,
        betType,
        odds,
        settledAt: new Date(),
      });

      // Check for leaderboard position change after bet settlement
      await this.checkLeaderboardPositionChange(userId, 'netEarnings');
    } catch (error) {
      this.logger.error(
        `Failed to create bet outcome notification for user ${userId}:`,
        error,
      );
    }
  }

  /**
   * Handle spin reward event
   * Creates notification for spin rewards
   */
  async handleSpinReward(
    userId: string,
    spinId: string,
    rewardAmount: number,
    rewardType: string,
    multiplier?: number,
    spinResult?: any,
  ): Promise<void> {
    this.logger.log(`Processing spin reward notification for user ${userId}`);

    try {
      await this.notificationsService.createSpinRewardNotification(userId, {
        spinId,
        rewardAmount,
        rewardType,
        multiplier,
        spinResult,
        awardedAt: new Date(),
      });

      // Check for leaderboard position change after spin reward
      await this.checkLeaderboardPositionChange(userId, 'totalWinnings');
    } catch (error) {
      this.logger.error(
        `Failed to create spin reward notification for user ${userId}:`,
        error,
      );
    }
  }

  /**
   * Handle staking reward event
   * Creates notification for staking rewards
   */
  async handleStakeReward(
    userId: string,
    stakeId: string,
    rewardAmount: number,
    stakingContract: string,
  ): Promise<void> {
    this.logger.log(
      `Processing staking reward notification for user ${userId}`,
    );

    try {
      await this.notificationsService.createNotification(
        'stake_reward' as any,
        userId,
        '💰 Staking Reward!',
        `You earned ${rewardAmount} from your staking rewards!`,
        {
          stakeId,
          rewardAmount,
          stakingContract,
          awardedAt: new Date(),
        },
        'medium',
      );

      // Check for leaderboard position change after staking reward
      await this.checkLeaderboardPositionChange(userId, 'totalStakingRewards');
    } catch (error) {
      this.logger.error(
        `Failed to create staking reward notification for user ${userId}:`,
        error,
      );
    }
  }

  /**
   * Handle NFT mint event
   * Creates notification for NFT minting
   */
  async handleNFTMint(
    userId: string,
    tokenId: string,
    contractAddress: string,
    metadata?: any,
  ): Promise<void> {
    this.logger.log(`Processing NFT mint notification for user ${userId}`);

    try {
      await this.notificationsService.createNotification(
        'nft_mint' as any,
        userId,
        '🎨 NFT Minted!',
        `Your NFT (Token #${tokenId}) has been successfully minted!`,
        {
          tokenId,
          contractAddress,
          metadata,
          mintedAt: new Date(),
        },
        'high',
      );
    } catch (error) {
      this.logger.error(
        `Failed to create NFT mint notification for user ${userId}:`,
        error,
      );
    }
  }

  /**
   * Check for leaderboard position changes
   * Compares current position with previous position
   */
  private async checkLeaderboardPositionChange(
    userId: string,
    metric: string,
  ): Promise<void> {
    try {
      // This would compare current position with stored previous position
      // For now, we'll simulate a position change notification

      // In a real implementation, you would:
      // 1. Get current position from leaderboard service
      // 2. Get previous position from database
      // 3. Compare and notify if position changed significantly

      const currentPosition = Math.floor(Math.random() * 100) + 1; // Simulated
      const previousPosition =
        currentPosition + Math.floor(Math.random() * 10) - 5; // Simulated

      if (
        currentPosition !== previousPosition &&
        Math.abs(currentPosition - previousPosition) >= 5
      ) {
        const changeType =
          currentPosition < previousPosition ? 'improved' : 'declined';

        await this.notificationsService.createLeaderboardPositionChangeNotification(
          userId,
          {
            previousPosition,
            newPosition: currentPosition,
            metric,
            totalUsers: 1000, // Simulated
            percentile: ((1000 - currentPosition + 1) / 1000) * 100,
            changeType,
          },
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to check leaderboard position change for user ${userId}:`,
        error,
      );
    }
  }

  /**
   * Process batch notifications
   * Called by cron job for efficiency
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processBatchNotifications(): Promise<void> {
    this.logger.debug('Processing batch notifications');

    try {
      await this.notificationsService.processBatchNotifications();
    } catch (error) {
      this.logger.error('Failed to process batch notifications:', error);
    }
  }

  /**
   * Send periodic leaderboard updates
   * Notifies users of significant position changes
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async sendPeriodicLeaderboardUpdates(): Promise<void> {
    this.logger.log('Sending periodic leaderboard updates');

    try {
      // This would get active users and check for position changes
      // For now, we'll just log the intent
      this.logger.debug('Periodic leaderboard updates processed');
    } catch (error) {
      this.logger.error('Failed to send periodic leaderboard updates:', error);
    }
  }

  /**
   * Send daily summary notifications
   * Provides users with daily activity summaries
   */
  @Cron('0 9 * * *') // Every day at 9 AM
  async sendDailySummaries(): Promise<void> {
    this.logger.log('Sending daily summary notifications');

    try {
      // This would send daily activity summaries to opted-in users
      // For now, we'll just log the intent
      this.logger.debug('Daily summaries processed');
    } catch (error) {
      this.logger.error('Failed to send daily summaries:', error);
    }
  }

  /**
   * Handle system announcements
   * Broadcast important system messages
   */
  async sendSystemAnnouncement(
    title: string,
    message: string,
    data?: any,
    priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium',
  ): Promise<void> {
    this.logger.log(`Sending system announcement: ${title}`);

    try {
      await this.notificationsService.createNotification(
        'system_announcement' as any,
        'broadcast',
        title,
        message,
        data,
        priority,
      );
    } catch (error) {
      this.logger.error('Failed to send system announcement:', error);
    }
  }

  /**
   * Get notification statistics
   * Useful for monitoring and analytics
   */
  async getNotificationStats(): Promise<{
    queueStatus: any;
    connectedUsers: number;
    dailyNotifications: number;
    weeklyNotifications: number;
  }> {
    const queueStatus = this.notificationsService.getQueueStatus();
    const connectedUsers = this.notificationsService.getConnectedUsersCount();

    // This would fetch from database
    const dailyNotifications = 0;
    const weeklyNotifications = 0;

    return {
      queueStatus,
      connectedUsers,
      dailyNotifications,
      weeklyNotifications,
    };
  }
}
