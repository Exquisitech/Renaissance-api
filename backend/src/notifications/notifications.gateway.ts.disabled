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
import { NotificationsService, NotificationType, BaseNotification } from './notifications.service';

/**
 * WebSocket Gateway for real-time notifications
 * Handles bidirectional communication with frontend clients
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
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private connectedClients: Map<string, ConnectedClient> = new Map();

  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Handle new client connection
   */
  async handleConnection(client: Socket): Promise<void> {
    this.logger.log(`Client connected: ${client.id}`);

    try {
      // Extract user ID from authentication token or query params
      const userId = this.extractUserId(client);
      
      if (!userId) {
        this.logger.warn(`Client ${client.id} connected without valid authentication`);
        client.disconnect();
        return;
      }

      // Register client connection
      this.notificationsService.registerUserConnection(userId, client.id);
      
      // Store client info
      this.connectedClients.set(client.id, {
        socket: client,
        userId,
        connectedAt: new Date(),
        subscriptions: new Set(),
      });

      // Join user-specific room
      await client.join(`user:${userId}`);
      
      // Send initial connection confirmation
      client.emit('connected', {
        status: 'connected',
        userId,
        timestamp: new Date().toISOString(),
      });

      // Send unread notifications count
      const unreadCount = await this.notificationsService.getUnreadCount(userId);
      client.emit('unread_count', { count: unreadCount });

      this.logger.log(`User ${userId} successfully connected with socket ${client.id}`);
    } catch (error) {
      this.logger.error(`Error handling connection for client ${client.id}:`, error);
      client.disconnect();
    }
  }

  /**
   * Handle client disconnection
   */
  async handleDisconnect(client: Socket): Promise<void> {
    this.logger.log(`Client disconnected: ${client.id}`);

    const connectedClient = this.connectedClients.get(client.id);
    if (connectedClient) {
      // Unregister from notifications service
      this.notificationsService.unregisterUserConnection(connectedClient.userId, client.id);
      
      // Remove from connected clients
      this.connectedClients.delete(client.id);
      
      // Leave user-specific room
      await client.leave(`user:${connectedClient.userId}`);
      
      this.logger.log(`User ${connectedClient.userId} disconnected from socket ${client.id}`);
    }
  }

  /**
   * Handle subscription to specific notification types
   */
  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { types: NotificationType[]; userId?: string },
  ): Promise<void> {
    const connectedClient = this.connectedClients.get(client.id);
    if (!connectedClient) {
      client.emit('error', { message: 'Client not registered' });
      return;
    }

    const { types, userId } = data;
    const targetUserId = userId || connectedClient.userId;

    // Validate user can subscribe to requested user's notifications
    if (targetUserId !== connectedClient.userId) {
      client.emit('error', { message: 'Cannot subscribe to other users notifications' });
      return;
    }

    // Join notification type rooms for real-time updates
    for (const type of types) {
      await client.join(`notifications:${type}:${targetUserId}`);
      connectedClient.subscriptions.add(type);
    }

    client.emit('subscribed', {
      types,
      userId: targetUserId,
      timestamp: new Date().toISOString(),
    });

    this.logger.debug(`Client ${client.id} subscribed to notifications: ${types.join(', ')}`);
  }

  /**
   * Handle unsubscription from notification types
   */
  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { types: NotificationType[] },
  ): Promise<void> {
    const connectedClient = this.connectedClients.get(client.id);
    if (!connectedClient) {
      client.emit('error', { message: 'Client not registered' });
      return;
    }

    const { types } = data;

    // Leave notification type rooms
    for (const type of types) {
      await client.leave(`notifications:${type}:${connectedClient.userId}`);
      connectedClient.subscriptions.delete(type);
    }

    client.emit('unsubscribed', {
      types,
      userId: connectedClient.userId,
      timestamp: new Date().toISOString(),
    });

    this.logger.debug(`Client ${client.id} unsubscribed from notifications: ${types.join(', ')}`);
  }

  /**
   * Handle request for notification history
   */
  @SubscribeMessage('get_notifications')
  async handleGetNotifications(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { limit?: number; offset?: number; unreadOnly?: boolean },
  ): Promise<void> {
    const connectedClient = this.connectedClients.get(client.id);
    if (!connectedClient) {
      client.emit('error', { message: 'Client not registered' });
      return;
    }

    try {
      const notifications = await this.notificationsService.getUserNotifications(
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
      this.logger.error(`Error fetching notifications for user ${connectedClient.userId}:`, error);
      client.emit('error', { message: 'Failed to fetch notifications' });
    }
  }

  /**
   * Handle marking notification as read
   */
  @SubscribeMessage('mark_read')
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { notificationId: string },
  ): Promise<void> {
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

      // Update unread count
      const unreadCount = await this.notificationsService.getUnreadCount(connectedClient.userId);
      
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

  /**
   * Handle marking all notifications as read
   */
  @SubscribeMessage('mark_all_read')
  async handleMarkAllAsRead(@ConnectedSocket() client: Socket): Promise<void> {
    const connectedClient = this.connectedClients.get(client.id);
    if (!connectedClient) {
      client.emit('error', { message: 'Client not registered' });
      return;
    }

    try {
      await this.notificationsService.markAllNotificationsAsRead(connectedClient.userId);

      client.emit('all_notifications_read', {
        unreadCount: 0,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Error marking all notifications as read:`, error);
      client.emit('error', { message: 'Failed to mark all notifications as read' });
    }
  }

  /**
   * Handle notification preferences update
   */
  @SubscribeMessage('update_preferences')
  async handleUpdatePreferences(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: Partial<any>,
  ): Promise<void> {
    const connectedClient = this.connectedClients.get(client.id);
    if (!connectedClient) {
      client.emit('error', { message: 'Client not registered' });
      return;
    }

    try {
      const updatedPreferences = await this.notificationsService.updateNotificationPreferences(
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

  /**
   * Handle getting notification preferences
   */
  @SubscribeMessage('get_preferences')
  async handleGetPreferences(@ConnectedSocket() client: Socket): Promise<void> {
    const connectedClient = this.connectedClients.get(client.id);
    if (!connectedClient) {
      client.emit('error', { message: 'Client not registered' });
      return;
    }

    try {
      const preferences = await this.notificationsService.getUserNotificationPreferences(
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

  /**
   * Send notification to specific user
   * Called by NotificationsService
   */
  async sendNotificationToUser(userId: string, notification: BaseNotification): Promise<void> {
    try {
      // Send to user-specific room
      this.server.to(`user:${userId}`).emit('notification', notification);

      // Send to notification type room if user is subscribed
      this.server.to(`notifications:${notification.type}:${userId}`).emit('notification', notification);

      // Update unread count for all user's connected clients
      const unreadCount = await this.notificationsService.getUnreadCount(userId);
      this.server.to(`user:${userId}`).emit('unread_count', { count: unreadCount });

      this.logger.debug(`Sent notification ${notification.id} to user ${userId}`);
    } catch (error) {
      this.logger.error(`Error sending notification to user ${userId}:`, error);
    }
  }

  /**
   * Send broadcast notification to all connected clients
   */
  async sendBroadcastNotification(notification: BaseNotification): Promise<void> {
    try {
      this.server.emit('broadcast_notification', notification);
      this.logger.log(`Sent broadcast notification: ${notification.title}`);
    } catch (error) {
      this.logger.error('Error sending broadcast notification:', error);
    }
  }

  /**
   * Send system announcement
   */
  async sendSystemAnnouncement(
    title: string,
    message: string,
    data?: any,
    priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium',
  ): Promise<void> {
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

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    totalConnections: number;
    uniqueUsers: number;
    subscriptionsByType: Record<string, number>;
  } {
    const subscriptionsByType: Record<string, number> = {};
    const uniqueUsers = new Set<string>();

    for (const client of this.connectedClients.values()) {
      uniqueUsers.add(client.userId);
      
      for (const subscription of client.subscriptions) {
        subscriptionsByType[subscription] = (subscriptionsByType[subscription] || 0) + 1;
      }
    }

    return {
      totalConnections: this.connectedClients.size,
      uniqueUsers: uniqueUsers.size,
      subscriptionsByType,
    };
  }

  /**
   * Disconnect user from all connections
   */
  async disconnectUser(userId: string, reason?: string): Promise<void> {
    const userClients = Array.from(this.connectedClients.entries())
      .filter(([_, client]) => client.userId === userId);

    for (const [socketId, client] of userClients) {
      client.socket.emit('force_disconnect', { 
        reason: reason || 'Session terminated',
        timestamp: new Date().toISOString(),
      });
      client.socket.disconnect(true);
    }

    this.logger.log(`Disconnected user ${userId} from ${userClients.length} connections`);
  }

  /**
   * Extract user ID from client
   * This would typically validate JWT token or session
   */
  private extractUserId(client: Socket): string | null {
    // Try to get from query parameters (for development)
    const userId = client.handshake.query.userId as string;
    if (userId) {
      return userId;
    }

    // Try to get from authentication token (production)
    const token = client.handshake.auth.token;
    if (token) {
      // This would validate JWT and extract user ID
      // For now, return a placeholder
      return 'user_from_token';
    }

    return null;
  }
}

/**
 * Interface for connected client information
 */
interface ConnectedClient {
  socket: Socket;
  userId: string;
  connectedAt: Date;
  subscriptions: Set<NotificationType>;
}
