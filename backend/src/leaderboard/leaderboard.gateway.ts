import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { LeaderboardAggregationService } from './leaderboard-aggregation.service';

interface ClientInfo {
  userId?: string;
  subscriptions: Set<string>;
  lastPing: Date;
  rooms: Set<string>;
}

/**
 * Enhanced WebSocket Gateway for real-time leaderboard updates
 * Features:
 * - Room management for different leaderboard types
 * - Connection health monitoring
 * - Reconnection logic support
 * - Efficient broadcasting
 */
@WebSocketGateway({
  namespace: 'leaderboard',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})
@Injectable()
export class LeaderboardGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LeaderboardGateway.name);
  private connectedClients: Map<string, ClientInfo> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly RECONNECTION_WINDOW = 30000; // 30 seconds
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

  constructor(
    private readonly leaderboardAggregationService: LeaderboardAggregationService,
  ) {}

  onModuleInit() {
    this.startHealthMonitoring();
    this.logger.log('LeaderboardGateway initialized');
  }

  onModuleDestroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.logger.log('LeaderboardGateway destroyed');
  }

  /**
   * Handle client connection
   */
  async handleConnection(client: Socket): Promise<void> {
    const clientId = client.id;
    this.logger.log(`Client connected: ${clientId}`);

    // Initialize client info
    this.connectedClients.set(clientId, {
      subscriptions: new Set(),
      lastPing: new Date(),
      rooms: new Set(),
    });

    // Send initial leaderboard data
    await this.sendInitialData(client);

    this.logger.debug(`Total connected clients: ${this.connectedClients.size}`);
  }

  /**
   * Handle client disconnection
   */
  async handleDisconnect(client: Socket): Promise<void> {
    const clientId = client.id;
    this.logger.log(`Client disconnected: ${clientId}`);

    // Remove from all rooms
    const clientInfo = this.connectedClients.get(clientId);
    if (clientInfo) {
      clientInfo.rooms.forEach((room) => {
        client.leave(room);
      });
    }

    // Keep client info for reconnection window
    setTimeout(() => {
      this.connectedClients.delete(clientId);
    }, this.RECONNECTION_WINDOW);

    this.logger.debug(`Total connected clients: ${this.connectedClients.size}`);
  }

  /**
   * Handle subscription to leaderboard updates
   */
  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      type: string;
      userId?: string;
      filters?: any;
      rooms?: string[];
    },
  ): Promise<void> {
    const clientId = client.id;
    const clientInfo = this.connectedClients.get(clientId);

    if (!clientInfo) {
      this.logger.warn(`Client ${clientId} not found in registry`);
      return;
    }

    this.logger.log(`Client ${clientId} subscribed to: ${data.type}`);

    // Update client info
    clientInfo.subscriptions.add(data.type);
    if (data.userId) {
      clientInfo.userId = data.userId;
    }

    // Join rooms for efficient broadcasting
    if (data.rooms && Array.isArray(data.rooms)) {
      data.rooms.forEach((room) => {
        client.join(room);
        clientInfo.rooms.add(room);
        this.logger.debug(`Client ${clientId} joined room: ${room}`);
      });
    }

    // Send initial data based on subscription type
    switch (data.type) {
      case 'user-stats':
        if (data.userId) {
          await this.sendUserStats(client, data.userId);
        }
        break;
      case 'top-leaderboard':
        await this.sendTopLeaderboard(client, data.filters);
        break;
      case 'live-updates':
        // Subscribe to live updates for specific metrics
        if (data.filters?.metrics) {
          data.filters.metrics.forEach((metric: string) => {
            client.join(`live:${metric}`);
            clientInfo.rooms.add(`live:${metric}`);
          });
        }
        break;
    }

    // Acknowledge subscription
    client.emit('subscribed', {
      type: data.type,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle unsubscription
   */
  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { type: string; rooms?: string[] },
  ): Promise<void> {
    const clientId = client.id;
    const clientInfo = this.connectedClients.get(clientId);

    if (!clientInfo) return;

    this.logger.log(`Client ${clientId} unsubscribed from: ${data.type}`);
    clientInfo.subscriptions.delete(data.type);

    if (data.rooms && Array.isArray(data.rooms)) {
      data.rooms.forEach((room) => {
        client.leave(room);
        clientInfo.rooms.delete(room);
      });
    }
  }

  /**
   * Handle ping for health monitoring
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket): void {
    const clientInfo = this.connectedClients.get(client.id);
    if (clientInfo) {
      clientInfo.lastPing = new Date();
    }
    client.emit('pong', { timestamp: new Date().toISOString() });
  }

  /**
   * Broadcast update to specific room
   */
  async broadcastToRoom(
    room: string,
    type: 'bet' | 'stake' | 'settlement' | 'ranking-change',
    userId: string,
    data: any,
  ): Promise<void> {
    this.logger.debug(`Broadcasting ${type} update to room ${room} for user ${userId}`);

    const updateMessage = {
      type: 'leaderboard-update',
      data: {
        updateType: type,
        userId,
        data,
        timestamp: new Date().toISOString(),
      },
    };

    this.server.to(room).emit('update', updateMessage);

    // Also broadcast to user-specific room
    if (userId) {
      this.server.to(`user:${userId}`).emit('update', updateMessage);
    }
  }

  /**
   * Broadcast update to all connected clients
   */
  async broadcastUpdate(
    type: 'bet' | 'stake' | 'settlement',
    userId: string,
    data: any,
  ): Promise<void> {
    this.logger.debug(`Broadcasting ${type} update for user ${userId}`);

    // Update internal stats
    await this.leaderboardAggregationService.handleRealTimeUpdate(userId, type, data);

    const updateMessage = {
      type: 'leaderboard-update',
      data: {
        updateType: type,
        userId,
        data,
        timestamp: new Date().toISOString(),
      },
    };

    // Broadcast to all connected clients
    this.server.emit('update', updateMessage);
  }

  /**
   * Send ranking change notification
   */
  async notifyRankingChange(
    userId: string,
    previousPosition: number,
    newPosition: number,
    metric: string,
  ): Promise<void> {
    const message = {
      type: 'ranking-change',
      data: {
        userId,
        previousPosition,
        newPosition,
        metric,
        changeType:
          newPosition < previousPosition ? 'improved' : 'declined',
        timestamp: new Date().toISOString(),
      },
    };

    // Send to user-specific room
    this.server.to(`user:${userId}`).emit('ranking-update', message);
  }

  /**
   * Send initial data to newly connected client
   */
  private async sendInitialData(client: Socket): Promise<void> {
    try {
      const topLeaderboard =
        await this.leaderboardAggregationService.getTopLeaderboard(10);

      const initialData = {
        type: 'initial-data',
        data: {
          topLeaderboard,
          timestamp: new Date().toISOString(),
        },
      };

      client.emit('initial-data', initialData);
    } catch (error) {
      this.logger.error(
        `Failed to send initial data to client ${client.id}:`,
        error,
      );
    }
  }

  /**
   * Send specific user stats
   */
  private async sendUserStats(
    client: Socket,
    userId: string,
  ): Promise<void> {
    try {
      const userStats =
        await this.leaderboardAggregationService.getUserLeaderboardStats(userId);

      const message = {
        type: 'user-stats',
        data: userStats,
      };

      client.emit('user-stats', message);
    } catch (error) {
      this.logger.error(
        `Failed to send user stats for ${userId}:`,
        error,
      );
    }
  }

  /**
   * Send top leaderboard data
   */
  private async sendTopLeaderboard(
    client: Socket,
    filters?: { limit?: number; orderBy?: string },
  ): Promise<void> {
    try {
      const limit = filters?.limit || 100;
      const orderBy = filters?.orderBy || 'netEarnings';

      const topLeaderboard =
        await this.leaderboardAggregationService.getTopLeaderboard(
          limit,
          0,
          orderBy,
        );

      const message = {
        type: 'top-leaderboard',
        data: {
          leaderboard: topLeaderboard,
          filters: { limit, orderBy },
          timestamp: new Date().toISOString(),
        },
      };

      client.emit('top-leaderboard', message);
    } catch (error) {
      this.logger.error(`Failed to send top leaderboard:`, error);
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      const now = new Date();
      const staleClients: string[] = [];

      this.connectedClients.forEach((info, clientId) => {
        const timeSinceLastPing =
          now.getTime() - info.lastPing.getTime();
        if (timeSinceLastPing > this.HEALTH_CHECK_INTERVAL * 2) {
          staleClients.push(clientId);
        }
      });

      if (staleClients.length > 0) {
        this.logger.warn(
          `Detected ${staleClients.length} stale clients`,
        );
        // Optionally disconnect stale clients
      }

      this.logger.debug(
        `Health check: ${this.connectedClients.size} active clients`,
      );
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    totalConnections: number;
    uniqueUsers: number;
    subscriptionsByType: Record<string, number>;
    roomsActive: number;
  } {
    const uniqueUsers = new Set<string>();
    const subscriptionsByType: Record<string, number> = {};
    const allRooms = new Set<string>();

    this.connectedClients.forEach((info) => {
      if (info.userId) {
        uniqueUsers.add(info.userId);
      }

      info.subscriptions.forEach((sub) => {
        subscriptionsByType[sub] = (subscriptionsByType[sub] || 0) + 1;
      });

      info.rooms.forEach((room) => allRooms.add(room));
    });

    return {
      totalConnections: this.connectedClients.size,
      uniqueUsers: uniqueUsers.size,
      subscriptionsByType,
      roomsActive: allRooms.size,
    };
  }
}
