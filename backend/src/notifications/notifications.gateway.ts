import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationsService,
  NotificationType,
  BaseNotification,
} from './notifications.service';

/**
 * WebSocket Gateway for real-time notifications
 */
@WebSocketGateway({
  namespace: 'notifications',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
@Injectable()
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private connectedClients: Map<string, ConnectedClient> = new Map();

  constructor(private readonly notificationsService: NotificationsService) {}

  async handleConnection(client: Socket): Promise<void> {
    this.logger.log(`Client connected: ${client.id}`);

    try {
      const userId = this.extractUserId(client);
      if (!userId) {
        this.logger.warn(
          `Client ${client.id} connected without valid authentication`,
        );
        client.disconnect();
        return;
      }

      this.notificationsService.registerUserConnection(userId, client.id);

      this.connectedClients.set(client.id, {
        socket: client,
        userId,
        connectedAt: new Date(),
        subscriptions: new Set(),
      });

      await client.join(`user:${userId}`);

      client.emit('connected', {
        status: 'connected',
        userId,
        timestamp: new Date().toISOString(),
      });

      const unreadCount =
        await this.notificationsService.getUnreadCount(userId);
      client.emit('unread_count', { count: unreadCount });

      this.logger.log(
        `User ${userId} successfully connected with socket ${client.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling connection for client ${client.id}:`,
        error,
      );
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    this.logger.log(`Client disconnected: ${client.id}`);
    const connectedClient = this.connectedClients.get(client.id);
    if (connectedClient) {
      this.notificationsService.unregisterUserConnection(
        connectedClient.userId,
        client.id,
      );
      this.connectedClients.delete(client.id);
      await client.leave(`user:${connectedClient.userId}`);
      this.logger.log(
        `User ${connectedClient.userId} disconnected from socket ${client.id}`,
      );
    }
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { types: NotificationType[]; userId?: string },
  ) {
    const connectedClient = this.connectedClients.get(client.id);
    if (!connectedClient) {
      client.emit('error', { message: 'Client not registered' });
      return;
    }

    const { types, userId } = data;
    const targetUserId = userId || connectedClient.userId;

    if (targetUserId !== connectedClient.userId) {
      client.emit('error', {
        message: 'Cannot subscribe to other users notifications',
      });
      return;
    }

    for (const type of types) {
      await client.join(`notifications:${type}:${targetUserId}`);
      connectedClient.subscriptions.add(type);
    }

    client.emit('subscribed', {
      types,
      userId: targetUserId,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { types: NotificationType[] },
  ) {
    const connectedClient = this.connectedClients.get(client.id);
    if (!connectedClient) {
      client.emit('error', { message: 'Client not registered' });
      return;
    }

    const { types } = data;
    for (const type of types) {
      await client.leave(`notifications:${type}:${connectedClient.userId}`);
      connectedClient.subscriptions.delete(type);
    }

    client.emit('unsubscribed', {
      types,
      userId: connectedClient.userId,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('get_notifications')
  async handleGetNotifications(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { limit?: number; offset?: number; unreadOnly?: boolean },
  ) {
    const connectedClient = this.connectedClients.get(client.id);
    if (!connectedClient) {
      client.emit('error', { message: 'Client not registered' });
      return;
    }

    try {
      const notifications =
        await this.notificationsService.getUserNotifications(
          connectedClient.userId,
          data.limit || 50,
          data.offset || 0,
          data.unreadOnly || false,
        );
      client.emit('notifications', {
        notifications,
        userId: connectedClient.userId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(
        `Error fetching notifications for user ${connectedClient.userId}:`,
        error,
      );
      client.emit('error', { message: 'Failed to fetch notifications' });
    }
  }

  @SubscribeMessage('mark_read')
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { notificationId: string },
  ) {
    const connectedClient = this.connectedClients.get(client.id);
    if (!connectedClient) {
      client.emit('error', { message: 'Client not registered' });
      return;
    }

    try {
      await this.notificationsService.markNotificationAsRead(
        connectedClient.userId,
        data.notificationId,
      );
      const unreadCount = await this.notificationsService.getUnreadCount(
        connectedClient.userId,
      );
      client.emit('notification_read', {
        notificationId: data.notificationId,
        unreadCount,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Error marking notification as read:`, error);
      client.emit('error', { message: 'Failed to mark notification as read' });
    }
  }

  @SubscribeMessage('mark_all_read')
  async handleMarkAllAsRead(@ConnectedSocket() client: Socket) {
    const connectedClient = this.connectedClients.get(client.id);
    if (!connectedClient) {
      client.emit('error', { message: 'Client not registered' });
      return;
    }

    try {
      await this.notificationsService.markAllNotificationsAsRead(
        connectedClient.userId,
      );
      client.emit('all_notifications_read', {
        unreadCount: 0,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Error marking all notifications as read:`, error);
      client.emit('error', {
        message: 'Failed to mark all notifications as read',
      });
    }
  }

  @SubscribeMessage('update_preferences')
  async handleUpdatePreferences(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: Partial<any>,
  ) {
    const connectedClient = this.connectedClients.get(client.id);
    if (!connectedClient) {
      client.emit('error', { message: 'Client not registered' });
      return;
    }

    try {
      const updatedPreferences =
        await this.notificationsService.updateNotificationPreferences(
          connectedClient.userId,
          data,
        );
      client.emit('preferences_updated', {
        preferences: updatedPreferences,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Error updating notification preferences:`, error);
      client.emit('error', { message: 'Failed to update preferences' });
    }
  }

  @SubscribeMessage('get_preferences')
  async handleGetPreferences(@ConnectedSocket() client: Socket) {
    const connectedClient = this.connectedClients.get(client.id);
    if (!connectedClient) {
      client.emit('error', { message: 'Client not registered' });
      return;
    }

    try {
      const preferences =
        await this.notificationsService.getUserNotificationPreferences(
          connectedClient.userId,
        );
      client.emit('preferences', {
        preferences,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Error fetching notification preferences:`, error);
      client.emit('error', { message: 'Failed to fetch preferences' });
    }
  }

  async sendNotificationToUser(
    userId: string,
    notification: BaseNotification,
  ): Promise<void> {
    try {
      this.server.to(`user:${userId}`).emit('notification', notification);
      this.server
        .to(`notifications:${notification.type}:${userId}`)
        .emit('notification', notification);
      const unreadCount =
        await this.notificationsService.getUnreadCount(userId);
      this.server
        .to(`user:${userId}`)
        .emit('unread_count', { count: unreadCount });
      this.logger.debug(
        `Sent notification ${notification.id} to user ${userId}`,
      );
    } catch (error) {
      this.logger.error(`Error sending notification to user ${userId}:`, error);
    }
  }

  async sendBroadcastNotification(
    notification: BaseNotification,
  ): Promise<void> {
    try {
      this.server.emit('broadcast_notification', notification);
      this.logger.log(`Sent broadcast notification: ${notification.title}`);
    } catch (error) {
      this.logger.error('Error sending broadcast notification:', error);
    }
  }

  async sendSystemAnnouncement(
    title: string,
    message: string,
    data?: any,
    priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium',
  ) {
    const notification: BaseNotification = {
      id: `system_${Date.now()}`,
      type: NotificationType.SYSTEM_ANNOUNCEMENT,
      userId: 'broadcast',
      title,
      message,
      data,
      timestamp: new Date(),
      read: false,
      priority,
    };

    await this.sendBroadcastNotification(notification);
  }

  private extractUserId(client: Socket): string | null {
    const userId = (client.handshake.query.userId as string) || null;
    if (userId) return userId;
    const token = client.handshake.auth?.token as string | undefined;
    if (token) return 'user_from_token';
    return null;
  }
}

interface ConnectedClient {
  socket: Socket;
  userId: string;
  connectedAt: Date;
  subscriptions: Set<NotificationType>;
}
