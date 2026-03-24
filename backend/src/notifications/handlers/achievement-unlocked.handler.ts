import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { AchievementUnlockedEvent } from '../../gamification/events/achievement-unlocked.event';
import { NotificationsService } from '../notifications.service';

@EventsHandler(AchievementUnlockedEvent)
export class AchievementUnlockedNotificationHandler implements IEventHandler<AchievementUnlockedEvent> {
  private readonly logger = new Logger(
    AchievementUnlockedNotificationHandler.name,
  );

  constructor(private readonly notificationsService: NotificationsService) {}

  async handle(event: AchievementUnlockedEvent) {
    this.logger.log(
      `Received AchievementUnlockedEvent for user ${event.userId}: ${event.achievementName}`,
    );

    try {
      await this.notificationsService.createNotification(
        'system_announcement' as any, // or create a specific 'achievement_unlocked' type if extended
        event.userId,
        // Title
        '🏆 Achievement Unlocked!',
        // Message
        `Congratulations! You unlocked the achievement: ${event.achievementName} and earned ${event.rewardPoints} points.`,
        // Metadata
        {
          achievementId: event.achievementId,
          achievementName: event.achievementName,
          rewardPoints: event.rewardPoints,
          unlockedAt: event.timestamp,
        },
        'high',
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle AchievementUnlockedEvent for user ${event.userId}`,
        error,
      );
    }
  }
}
