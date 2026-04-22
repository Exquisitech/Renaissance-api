import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { AnalyticsEventService, TrackEventDto } from '../analytics/providers/analytics-event.service';
import { AnalyticsEventType, AnalyticsEventCategory } from '../analytics/entities/analytics-event.entity';

@Injectable()
export class AnalyticsTrackingService {
  private readonly logger = new Logger(AnalyticsTrackingService.name);

  constructor(
    @Inject(forwardRef(() => AnalyticsEventService))
    private analyticsEventService: AnalyticsEventService,
  ) {}

  // Authentication events
  async trackUserLogin(userId: string, ipAddress?: string, userAgent?: string) {
    await this.trackEvent({
      userId,
      eventType: AnalyticsEventType.USER_LOGIN,
      category: AnalyticsEventCategory.AUTHENTICATION,
      ipAddress,
      userAgent,
    });
  }

  async trackUserRegister(userId: string, ipAddress?: string, userAgent?: string) {
    await this.trackEvent({
      userId,
      eventType: AnalyticsEventType.USER_REGISTER,
      category: AnalyticsEventCategory.AUTHENTICATION,
      ipAddress,
      userAgent,
    });
  }

  // Gambling events
  async trackBetPlaced(userId: string, betId: string, amount: number) {
    await this.trackEvent({
      userId,
      eventType: AnalyticsEventType.BET_PLACED,
      category: AnalyticsEventCategory.GAMBLING,
      value: amount,
      metadata: { betId },
    });
  }

  async trackBetSettled(userId: string, betId: string, outcome: string, winAmount: number) {
    await this.trackEvent({
      userId,
      eventType: AnalyticsEventType.BET_SETTLED,
      category: AnalyticsEventCategory.GAMBLING,
      value: winAmount,
      metadata: { betId, outcome },
    });
  }

  async trackSpinPlayed(userId: string, spinId: string, betAmount: number, winAmount: number) {
    await this.trackEvent({
      userId,
      eventType: AnalyticsEventType.SPIN_PLAYED,
      category: AnalyticsEventCategory.GAMBLING,
      value: betAmount,
      metadata: { spinId, winAmount },
    });
  }

  // NFT events
  async trackNFTPurchased(userId: string, nftId: string, price: number) {
    await this.trackEvent({
      userId,
      eventType: AnalyticsEventType.NFT_PURCHASED,
      category: AnalyticsEventCategory.NFT,
      value: price,
      metadata: { nftId },
    });
  }

  // Prediction events
  async trackPredictionMade(userId: string, predictionId: string, matchId: string) {
    await this.trackEvent({
      userId,
      eventType: AnalyticsEventType.PREDICTION_MADE,
      category: AnalyticsEventCategory.PREDICTIONS,
      metadata: { predictionId, matchId },
    });
  }

  // Social events
  async trackPostCreated(userId: string, postId: string) {
    await this.trackEvent({
      userId,
      eventType: AnalyticsEventType.POST_CREATED,
      category: AnalyticsEventCategory.SOCIAL,
      metadata: { postId },
    });
  }

  async trackCommentAdded(userId: string, commentId: string, postId: string) {
    await this.trackEvent({
      userId,
      eventType: AnalyticsEventType.COMMENT_ADDED,
      category: AnalyticsEventCategory.SOCIAL,
      metadata: { commentId, postId },
    });
  }

  // Gamification events
  async trackAchievementUnlocked(userId: string, achievementId: string) {
    await this.trackEvent({
      userId,
      eventType: AnalyticsEventType.ACHIEVEMENT_UNLOCKED,
      category: AnalyticsEventCategory.ENGAGEMENT,
      metadata: { achievementId },
    });
  }

  // Wallet events
  async trackWalletTransaction(userId: string, transactionId: string, amount: number, type: string) {
    await this.trackEvent({
      userId,
      eventType: AnalyticsEventType.WALLET_TRANSACTION,
      category: AnalyticsEventCategory.WALLET,
      value: amount,
      metadata: { transactionId, type },
    });
  }

  // Engagement events
  async trackPageView(userId: string, page: string, sessionId?: string) {
    await this.trackEvent({
      userId,
      eventType: AnalyticsEventType.PAGE_VIEW,
      category: AnalyticsEventCategory.ENGAGEMENT,
      sessionId,
      metadata: { page },
    });
  }

  async trackFeatureUsage(userId: string, feature: string, metadata?: Record<string, any>) {
    await this.trackEvent({
      userId,
      eventType: AnalyticsEventType.FEATURE_USAGE,
      category: AnalyticsEventCategory.ENGAGEMENT,
      metadata: { feature, ...metadata },
    });
  }

  private async trackEvent(eventData: TrackEventDto) {
    try {
      await this.analyticsEventService.trackEvent(eventData);
    } catch (error) {
      // Don't fail the main operation if analytics tracking fails
      this.logger.error(`Failed to track analytics event: ${error.message}`, error.stack);
    }
  }
}