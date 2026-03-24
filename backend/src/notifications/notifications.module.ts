import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
// import { NotificationsGateway } from './notifications.gateway';
import { NotificationIntegrationService } from './notification-integration.service';
import { NotificationsController } from './notifications.controller';
import { User } from '../users/entities/user.entity';
import { CqrsModule } from '@nestjs/cqrs';
import { AchievementUnlockedNotificationHandler } from './handlers/achievement-unlocked.handler';

/**
 * Notifications Module
 * Handles real-time notifications via WebSocket
 * Provides event queue for scalable notification processing
 */
@Module({
  imports: [TypeOrmModule.forFeature([User]), CqrsModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    // NotificationsGateway,
    NotificationIntegrationService,
    AchievementUnlockedNotificationHandler,
  ],
  exports: [
    NotificationsService,
    // NotificationsGateway,
    NotificationIntegrationService,
  ],
})
export class NotificationsModule {}
