import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationEntity } from './entities/notification.entity';

/**
 * Notification types for different user events
 */
export enum NotificationType {
  BET_OUTCOME = 'bet_outcome',
  SPIN_REWARD = 'spin_reward',
  LEADERBOARD_POSITION_CHANGE = 'leaderboard_position_change',
  STAKE_REWARD = 'stake_reward',
  NFT_MINT = 'nft_mint',
  ACCOUNT_UPDATE = 'account_update',
  SYSTEM_ANNOUNCEMENT = 'system_announcement',
}

/**
 * Base notification interface
 */
export interface BaseNotification {
  id: string;
  type: NotificationType;
  userId: string;
  title: string;
  message: string;
  data?: any;
  timestamp: Date;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

/**
 * Bet outcome notification
 */
export interface BetOutcomeNotification extends BaseNotification {
  type: NotificationType.BET_OUTCOME;
  data: {
    betId: string;
    isWin: boolean;
    amount: number;
    winningsAmount?: number;
    betType: string;
    odds: number;
    settledAt: Date;
  };
}

/**
 * Spin reward notification
 */
export interface SpinRewardNotification extends BaseNotification {
  type: NotificationType.SPIN_REWARD;
  data: {
    spinId: string;
    rewardAmount: number;
    rewardType: string;
    multiplier?: number;
    spinResult: any;
    awardedAt: Date;
  };
}

/**
 * Leaderboard position change notification
 */
export interface LeaderboardPositionChangeNotification extends BaseNotification {
  type: NotificationType.LEADERBOARD_POSITION_CHANGE;
  data: {
    previousPosition: number;
    newPosition: number;
    metric: string;
    totalUsers: number;
    percentile: number;
    changeType: 'improved' | 'declined';
  };
}

/**
 * Event queue item for scalable notification processing
 */
export interface NotificationQueueItem {
  id: string;
  type: NotificationType;
  userId: string;
  payload: any;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  attempts: number;
  maxAttempts: number;
  scheduledFor: Date;
  createdAt: Date;
}

/**
 * Notification subscription preferences
 */
export interface NotificationPreferences {
  userId: string;
  betOutcomes: boolean;
  spinRewards: boolean;
  leaderboardChanges: boolean;
  stakeRewards: boolean;
  nftMints: boolean;
  accountUpdates: boolean;
  systemAnnouncements: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  inAppNotifications: boolean;
}

/**
 * Service for managing user notifications
 * Handles creation, delivery, and preferences for real-time notifications
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private notificationQueue: Map<string, NotificationQueueItem> = new Map();
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
  private realtimeDispatcher?: (
    userId: string,
    notification: BaseNotification,
  ) => Promise<void>;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
    private readonly notificationDeliveryService: NotificationDeliveryService,
  ) {}

  /**
   * Create and queue a bet outcome notification
   */
  async createBetOutcomeNotification(
    userId: string,
    betData: BetOutcomeNotification['data'],
  ): Promise<void> {
    this.logger.log(`Creating bet outcome notification for user ${userId}`);

    const notification: BetOutcomeNotification = {
      id: this.generateNotificationId(),
      type: NotificationType.BET_OUTCOME,
      userId,
      title: betData.isWin ? '🎉 Bet Won!' : '😔 Bet Lost',
      message: betData.isWin
        ? `Congratulations! You won ${betData.winningsAmount} on your ${betData.betType} bet.`
        : `Your ${betData.betType} bet was not successful. Better luck next time!`,
      data: betData,
      timestamp: new Date(),
      read: false,
      priority: betData.isWin ? 'high' : 'medium',
    };

    await this.queueNotification(notification);
  }

  /**
   * Create and queue a spin reward notification
   */
  async createSpinRewardNotification(
    userId: string,
    spinData: SpinRewardNotification['data'],
  ): Promise<void> {
    this.logger.log(`Creating spin reward notification for user ${userId}`);

    const notification: SpinRewardNotification = {
      id: this.generateNotificationId(),
      type: NotificationType.SPIN_REWARD,
      userId,
      title: '🎰 Spin Reward!',
      message: `You won ${spinData.rewardAmount} ${spinData.rewardType}${spinData.multiplier ? ` (${spinData.multiplier}x multiplier!)` : ''}!`,
      data: spinData,
      timestamp: new Date(),
      read: false,
      priority:
        spinData.multiplier && spinData.multiplier > 10 ? 'high' : 'medium',
    };

    await this.queueNotification(notification);
  }

  /**
   * Create and queue a leaderboard position change notification
   */
  async createLeaderboardPositionChangeNotification(
    userId: string,
    positionData: LeaderboardPositionChangeNotification['data'],
  ): Promise<void> {
    this.logger.log(
      `Creating leaderboard position change notification for user ${userId}`,
    );

    const changeText =
      positionData.changeType === 'improved' ? 'climbed' : 'dropped';
    const emoji = positionData.changeType === 'improved' ? '📈' : '📉';

    const notification: LeaderboardPositionChangeNotification = {
      id: this.generateNotificationId(),
      type: NotificationType.LEADERBOARD_POSITION_CHANGE,
      userId,
      title: `${emoji} Leaderboard Update!`,
      message: `You ${changeText} from position ${positionData.previousPosition} to ${positionData.newPosition} (${positionData.metric})!`,
      data: positionData,
      timestamp: new Date(),
      read: false,
      priority:
        positionData.changeType === 'improved' && positionData.newPosition <= 10
          ? 'high'
          : 'low',
    };

    await this.queueNotification(notification);
  }

  /**
   * Create a generic notification
   */
  async createNotification(
    type: NotificationType,
    userId: string,
    title: string,
    message: string,
    data?: any,
    priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium',
  ): Promise<void> {
    const notification: BaseNotification = {
      id: this.generateNotificationId(),
      type,
      userId,
      title,
      message,
      data,
      timestamp: new Date(),
      read: false,
      priority,
    };

    await this.queueNotification(notification);
  }

  /**
   * Queue notification for processing
   * Implements event queue for scalability
   */
  private async queueNotification(
    notification: BaseNotification,
  ): Promise<void> {
    // Check user preferences before queuing
    const preferences = await this.getUserNotificationPreferences(
      notification.userId,
    );

    if (!this.shouldSendNotification(notification.type, preferences)) {
      this.logger.debug(
        `Notification ${notification.type} disabled for user ${notification.userId}`,
      );
      return;
    }

    const queueItem: NotificationQueueItem = {
      id: this.generateQueueId(),
      type: notification.type,
      userId: notification.userId,
      payload: notification,
      priority: notification.priority,
      attempts: 0,
      maxAttempts: 3,
      scheduledFor: new Date(),
      createdAt: new Date(),
    };

    this.notificationQueue.set(queueItem.id, queueItem);

    // Process immediately for high/urgent priority
    if (queueItem.priority === 'high' || queueItem.priority === 'urgent') {
      await this.processNotification(queueItem.id);
    } else {
      // Schedule for batch processing
      this.scheduleNotification(queueItem.id);
    }

    this.logger.debug(
      `Queued notification ${queueItem.id} for user ${notification.userId}`,
    );
  }

  /**
   * Process notification from queue
   */
  async processNotification(queueItemId: string): Promise<boolean> {
    const queueItem = this.notificationQueue.get(queueItemId);
    if (!queueItem) {
      this.logger.warn(`Queue item ${queueItemId} not found`);
      return false;
    }

    try {
      const notification = queueItem.payload as BaseNotification;

      // Send to connected WebSocket clients
      await this.sendToConnectedUsers(notification.userId, notification);

      // Store in database for persistence
      await this.storeNotification(notification);

      // Send email/push if enabled
      await this.sendExternalNotifications(notification);

      // Remove from queue
      this.notificationQueue.delete(queueItemId);

      this.logger.log(`Successfully processed notification ${queueItemId}`);
      return true;
    } catch (error) {
      queueItem.attempts++;

      if (queueItem.attempts >= queueItem.maxAttempts) {
        this.notificationQueue.delete(queueItemId);
        this.logger.error(
          `Failed to process notification ${queueItemId} after ${queueItem.maxAttempts} attempts`,
        );
      } else {
        // Retry with exponential backoff
        const retryDelay = Math.pow(2, queueItem.attempts) * 1000; // 2s, 4s, 8s
        queueItem.scheduledFor = new Date(Date.now() + retryDelay);
        this.scheduleNotification(queueItemId);
        this.logger.warn(
          `Retrying notification ${queueItemId} in ${retryDelay}ms`,
        );
      }

      return false;
    }
  }

  /**
   * Send notification to connected WebSocket users
   */
  private async sendToConnectedUsers(
    userId: string,
    notification: BaseNotification,
  ): Promise<void> {
    const userSockets = this.connectedUsers.get(userId);
    if (!userSockets || userSockets.size === 0) {
      this.logger.debug(`No connected sockets for user ${userId}`);
      return;
    }

    if (this.realtimeDispatcher) {
      await this.realtimeDispatcher(userId, notification);
      return;
    }

    this.logger.debug(`No realtime dispatcher configured for user ${userId}`);
  }

  /**
   * Store notification in database
   */
  private async storeNotification(
    notification: BaseNotification,
  ): Promise<void> {
    const entity = this.notificationRepository.create({
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      read: notification.read,
      priority: notification.priority,
      timestamp: notification.timestamp,
    });
    await this.notificationRepository.save(entity);
  }

  /**
   * Send external notifications (email, push)
   */
  private async sendExternalNotifications(
    notification: BaseNotification,
  ): Promise<void> {
    if (notification.userId === 'broadcast') {
      return;
    }

    const preferences = await this.getUserNotificationPreferences(notification.userId);
    const user = await this.userRepository.findOne({ where: { id: notification.userId } });

    if (!user) {
      this.logger.warn(`Skipping external delivery for unknown user ${notification.userId}`);
      return;
    }

    await this.notificationDeliveryService.deliver(notification, preferences, user);
  }

  /**
   * Schedule notification for later processing
   */
  private scheduleNotification(queueItemId: string): void {
    const queueItem = this.notificationQueue.get(queueItemId);
    if (!queueItem) return;

    const delay = queueItem.scheduledFor.getTime() - Date.now();
    if (delay <= 0) {
      // Process immediately
      this.processNotification(queueItemId);
    } else {
      // Schedule for later
      setTimeout(() => {
        this.processNotification(queueItemId);
      }, delay);
    }
  }

  /**
   * Get user notification preferences
   */
  async getUserNotificationPreferences(
    userId: string,
  ): Promise<NotificationPreferences> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const saved = user?.metadata?.notificationPreferences ?? {};

    return {
      userId,
      betOutcomes: saved.betOutcomes ?? true,
      spinRewards: saved.spinRewards ?? true,
      leaderboardChanges: saved.leaderboardChanges ?? true,
      stakeRewards: saved.stakeRewards ?? true,
      nftMints: saved.nftMints ?? true,
      accountUpdates: saved.accountUpdates ?? true,
      systemAnnouncements: saved.systemAnnouncements ?? true,
      emailNotifications: saved.emailNotifications ?? true,
      pushNotifications: saved.pushNotifications ?? true,
      inAppNotifications: saved.inAppNotifications ?? true,
    };
  }

  /**
   * Update user notification preferences
   */
  async updateNotificationPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    const currentPreferences =
      await this.getUserNotificationPreferences(userId);
    const updatedPreferences = {
      ...currentPreferences,
      ...preferences,
      userId,
    };

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user) {
      user.metadata = {
        ...(user.metadata ?? {}),
        notificationPreferences: updatedPreferences,
      };
      await this.userRepository.save(user);
    }

    this.logger.log(`Updated notification preferences for user ${userId}`);

    return updatedPreferences;
  }

  /**
   * Check if notification should be sent based on preferences
   */
  private shouldSendNotification(
    type: NotificationType,
    preferences: NotificationPreferences,
  ): boolean {
    switch (type) {
      case NotificationType.BET_OUTCOME:
        return preferences.betOutcomes && preferences.inAppNotifications;
      case NotificationType.SPIN_REWARD:
        return preferences.spinRewards && preferences.inAppNotifications;
      case NotificationType.LEADERBOARD_POSITION_CHANGE:
        return preferences.leaderboardChanges && preferences.inAppNotifications;
      case NotificationType.STAKE_REWARD:
        return preferences.stakeRewards && preferences.inAppNotifications;
      case NotificationType.NFT_MINT:
        return preferences.nftMints && preferences.inAppNotifications;
      case NotificationType.ACCOUNT_UPDATE:
        return preferences.accountUpdates && preferences.inAppNotifications;
      case NotificationType.SYSTEM_ANNOUNCEMENT:
        return (
          preferences.systemAnnouncements && preferences.inAppNotifications
        );
      default:
        return true;
    }
  }

  /**
   * Register user connection
   */
  registerUserConnection(userId: string, socketId: string): void {
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId)!.add(socketId);
    this.logger.debug(`User ${userId} connected with socket ${socketId}`);
  }

  /**
   * Unregister user connection
   */
  unregisterUserConnection(userId: string, socketId: string): void {
    const userSockets = this.connectedUsers.get(userId);
    if (userSockets) {
      userSockets.delete(socketId);
      if (userSockets.size === 0) {
        this.connectedUsers.delete(userId);
      }
    }
    this.logger.debug(`User ${userId} disconnected from socket ${socketId}`);
  }

  registerRealtimeDispatcher(
    dispatcher: (userId: string, notification: BaseNotification) => Promise<void>,
  ): void {
    this.realtimeDispatcher = dispatcher;
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Get notification queue status
   */
  getQueueStatus(): {
    total: number;
    byPriority: Record<string, number>;
    byType: Record<string, number>;
  } {
    const byPriority: Record<string, number> = {};
    const byType: Record<string, number> = {};

    for (const item of this.notificationQueue.values()) {
      byPriority[item.priority] = (byPriority[item.priority] || 0) + 1;
      byType[item.type] = (byType[item.type] || 0) + 1;
    }

    return {
      total: this.notificationQueue.size,
      byPriority,
      byType,
    };
  }

  /**
   * Process batch notifications
   * Called by cron job for efficiency
   */
  async processBatchNotifications(): Promise<void> {
    const now = new Date();
    const readyItems: string[] = [];

    for (const [id, item] of this.notificationQueue.entries()) {
      if (item.scheduledFor <= now) {
        readyItems.push(id);
      }
    }

    this.logger.log(`Processing ${readyItems.length} batch notifications`);

    const results = await Promise.allSettled(
      readyItems.map((id) => this.processNotification(id)),
    );

    const successful = results.filter(
      (r) => r.status === 'fulfilled' && r.value,
    ).length;
    const failed = results.length - successful;

    this.logger.log(
      `Batch processing complete: ${successful} successful, ${failed} failed`,
    );
  }

  /**
   * Generate unique notification ID
   */
  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique queue ID
   */
  private generateQueueId(): string {
    return `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get user notifications history
   */
  async getUserNotifications(
    userId: string,
    limit: number = 50,
    offset: number = 0,
    unreadOnly: boolean = false,
  ): Promise<BaseNotification[]> {
    const qb = this.notificationRepository
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId })
      .orderBy('n.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    if (unreadOnly) {
      qb.andWhere('n.read = :read', { read: false });
    }

    const rows = await qb.getMany();
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      userId: row.userId,
      title: row.title,
      message: row.message,
      data: row.data,
      timestamp: row.timestamp,
      read: row.read,
      priority: row.priority,
    }));
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(
    userId: string,
    notificationId: string,
  ): Promise<void> {
    await this.notificationRepository.update(
      { id: notificationId, userId },
      { read: true },
    );
    this.logger.log(
      `Marked notification ${notificationId} as read for user ${userId}`,
    );
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update({ userId, read: false }, { read: true });
    this.logger.log(`Marked all notifications as read for user ${userId}`);
  }

  /**
   * Delete notification
   */
  async deleteNotification(
    userId: string,
    notificationId: string,
  ): Promise<void> {
    await this.notificationRepository.delete({ id: notificationId, userId });
    this.logger.log(
      `Deleted notification ${notificationId} for user ${userId}`,
    );
  }

  /**
   * Get unread count for user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: { userId, read: false },
    });
  }
}
