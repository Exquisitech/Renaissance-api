import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import {
  NotificationsService,
  NotificationType,
  BaseNotification,
} from './notifications.service';
import { NotificationIntegrationService } from './notification-integration.service';

/**
 * REST API Controller for notifications
 * Provides endpoints for managing notifications and preferences
 */
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationIntegrationService: NotificationIntegrationService,
  ) {}

  /**
   * Get user notifications
   * Query params:
   * - limit: number of results (default: 50)
   * - offset: pagination offset (default: 0)
   * - unreadOnly: only unread notifications (default: false)
   */
  @Get()
  async getUserNotifications(
    @Query('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ): Promise<{ notifications: BaseNotification[]; total: number }> {
    const notifications = await this.notificationsService.getUserNotifications(
      userId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
      unreadOnly === 'true',
    );

    return {
      notifications,
      total: notifications.length,
    };
  }

  /**
   * Get unread notification count for user
   */
  @Get('unread-count/:userId')
  async getUnreadCount(
    @Param('userId') userId: string,
  ): Promise<{ count: number }> {
    const count = await this.notificationsService.getUnreadCount(userId);
    return { count };
  }

  /**
   * Mark notification as read
   */
  @Put('read/:notificationId')
  async markAsRead(
    @Param('notificationId') notificationId: string,
    @Body('userId') userId: string,
  ): Promise<{ success: boolean }> {
    await this.notificationsService.markNotificationAsRead(
      userId,
      notificationId,
    );
    return { success: true };
  }

  /**
   * Mark all notifications as read for user
   */
  @Put('read-all/:userId')
  async markAllAsRead(
    @Param('userId') userId: string,
  ): Promise<{ success: boolean }> {
    await this.notificationsService.markAllNotificationsAsRead(userId);
    return { success: true };
  }

  /**
   * Delete notification
   */
  @Delete(':notificationId')
  async deleteNotification(
    @Param('notificationId') notificationId: string,
    @Body('userId') userId: string,
  ): Promise<{ success: boolean }> {
    await this.notificationsService.deleteNotification(userId, notificationId);
    return { success: true };
  }

  /**
   * Get user notification preferences
   */
  @Get('preferences/:userId')
  async getPreferences(@Param('userId') userId: string): Promise<any> {
    return await this.notificationsService.getUserNotificationPreferences(
      userId,
    );
  }

  /**
   * Update user notification preferences
   */
  @Put('preferences/:userId')
  async updatePreferences(
    @Param('userId') userId: string,
    @Body() preferences: any,
  ): Promise<any> {
    return await this.notificationsService.updateNotificationPreferences(
      userId,
      preferences,
    );
  }

  /**
   * Create custom notification (for testing/admin)
   */
  @Post('create')
  async createNotification(
    @Body()
    data: {
      type: NotificationType;
      userId: string;
      title: string;
      message: string;
      data?: any;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
    },
  ): Promise<{ success: boolean; notificationId: string }> {
    await this.notificationsService.createNotification(
      data.type,
      data.userId,
      data.title,
      data.message,
      data.data,
      data.priority || 'medium',
    );

    return { success: true, notificationId: 'generated_id' };
  }

  /**
   * Send system announcement
   */
  @Post('announcement')
  async sendSystemAnnouncement(
    @Body()
    data: {
      title: string;
      message: string;
      data?: any;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
    },
  ): Promise<{ success: boolean }> {
    await this.notificationIntegrationService.sendSystemAnnouncement(
      data.title,
      data.message,
      data.data,
      data.priority || 'medium',
    );

    return { success: true };
  }

  /**
   * Get notification statistics
   */
  @Get('stats')
  async getNotificationStats(): Promise<any> {
    return await this.notificationIntegrationService.getNotificationStats();
  }

  /**
   * Get queue status
   */
  @Get('queue-status')
  async getQueueStatus(): Promise<any> {
    return this.notificationsService.getQueueStatus();
  }

  /**
   * Trigger bet outcome notification (for testing)
   */
  @Post('test/bet-outcome')
  async testBetOutcome(
    @Body()
    data: {
      userId: string;
      betId: string;
      isWin: boolean;
      amount: number;
      winningsAmount?: number;
      betType: string;
      odds: number;
    },
  ): Promise<{ success: boolean }> {
    await this.notificationIntegrationService.handleBetSettlement(
      data.userId,
      data.betId,
      data.isWin,
      data.amount,
      data.winningsAmount || 0,
      data.betType,
      data.odds,
    );

    return { success: true };
  }

  /**
   * Trigger spin reward notification (for testing)
   */
  @Post('test/spin-reward')
  async testSpinReward(
    @Body()
    data: {
      userId: string;
      spinId: string;
      rewardAmount: number;
      rewardType: string;
      multiplier?: number;
    },
  ): Promise<{ success: boolean }> {
    await this.notificationIntegrationService.handleSpinReward(
      data.userId,
      data.spinId,
      data.rewardAmount,
      data.rewardType,
      data.multiplier,
    );

    return { success: true };
  }

  /**
   * Trigger leaderboard position change notification (for testing)
   */
  @Post('test/leaderboard-change')
  async testLeaderboardChange(
    @Body()
    data: {
      userId: string;
      previousPosition: number;
      newPosition: number;
      metric: string;
      totalUsers: number;
    },
  ): Promise<{ success: boolean }> {
    await this.notificationsService.createLeaderboardPositionChangeNotification(
      data.userId,
      {
        previousPosition: data.previousPosition,
        newPosition: data.newPosition,
        metric: data.metric,
        totalUsers: data.totalUsers,
        percentile:
          ((data.totalUsers - data.newPosition + 1) / data.totalUsers) * 100,
        changeType:
          data.newPosition < data.previousPosition ? 'improved' : 'declined',
      },
    );

    return { success: true };
  }
}
