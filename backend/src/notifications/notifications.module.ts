import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationIntegrationService } from './notification-integration.service';
import { NotificationsController } from './notifications.controller';
import { EmailController } from './email.controller';
import { User } from '../users/entities/user.entity';
import { CqrsModule } from '@nestjs/cqrs';
import { AchievementUnlockedNotificationHandler } from './handlers/achievement-unlocked.handler';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { NotificationDeliveryService } from './notification-delivery.service';
import { ConfigModule } from '@nestjs/config';
import { NotificationEntity } from './entities/notification.entity';

/**
 * Notifications Module
 * Handles real-time notifications via WebSocket
 * Provides event queue for scalable notification processing
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User, NotificationEntity]),
    CqrsModule,
    LeaderboardModule,
    ConfigModule,
  ],
  controllers: [NotificationsController, EmailController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    NotificationIntegrationService,
    NotificationDeliveryService,
    AchievementUnlockedNotificationHandler,
  ],
  exports: [
    NotificationsService,
    NotificationsGateway,
    NotificationIntegrationService,
  ],
})
export class NotificationsModule {}