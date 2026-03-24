import { Injectable, Logger } from '@nestjs/common';
import { OnGateway, WebSocketGateway, ConnectedSocket, MessageBody, SubscribeMessage } from '@nestjs/websockets';
import { LeaderboardAggregationService } from './leaderboard-aggregation.service';

/**
 * WebSocket Gateway for real-time leaderboard updates
 * Handles live updates to user statistics and rankings
 */
@WebSocketGateway({
  namespace: 'leaderboard',
  cors: {
    origin: '*',
  },
})
@Injectable()
export class LeaderboardGateway {
  private readonly logger = new Logger(LeaderboardGateway.name);
  private connectedClients: Map<string, ConnectedSocket> = new Map();

  constructor(
    private readonly leaderboardAggregationService: LeaderboardAggregationService,
  ) {}

  /**
   * Handle client connection
   */
  async handleConnection(client: ConnectedSocket): Promise<void> {
    this.logger.log(`Client connected: ${client.id}`);
    this.connectedClients.set(client.id, client);

    // Send initial leaderboard data
    await this.sendInitialData(client);
  }

  /**
   * Handle client disconnection
   */
  async handleDisconnect(client: ConnectedSocket): Promise<void> {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  /**
   * Handle subscription to leaderboard updates
   */
  @SubscribeMessage('subscribe')
  async handleSubscribe(
    client: ConnectedSocket,
    @MessageBody() data: { type: string; userId?: string; filters?: any },
  ): Promise<void> {
    this.logger.log(`Client ${client.id} subscribed to: ${data.type}`);

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
        // Subscribe to live updates for all users
        break;
    }
  }

  /**
   * Handle real-time event updates
   * Called by event listeners when on-chain or off-chain events occur
   */
  async broadcastUpdate(
    type: 'bet' | 'stake' | 'settlement',
    userId: string,
    data: any,
  ): Promise<void> {
    this.logger.debug(`Broadcasting ${type} update for user ${userId}`);

    // Update internal stats
    await this.leaderboardAggregationService.handleRealTimeUpdate(userId, type, data);

    // Broadcast to relevant clients
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
    for (const [clientId, client] of this.connectedClients) {
      client.send(JSON.stringify(updateMessage));
    }
  }

  /**
   * Send initial data to newly connected client
   */
  private async sendInitialData(client: ConnectedSocket): Promise<void> {
    try {
      const topLeaderboard = await this.leaderboardAggregationService.getTopLeaderboard(10);
      
      const initialData = {
        type: 'initial-data',
        data: {
          topLeaderboard,
          timestamp: new Date().toISOString(),
        },
      };

      client.send(JSON.stringify(initialData));
    } catch (error) {
      this.logger.error(`Failed to send initial data to client ${client.id}:`, error);
    }
  }

  /**
   * Send specific user stats
   */
  private async sendUserStats(client: ConnectedSocket, userId: string): Promise<void> {
    try {
      const userStats = await this.leaderboardAggregationService.getUserLeaderboardStats(userId);
      
      const message = {
        type: 'user-stats',
        data: userStats,
      };

      client.send(JSON.stringify(message));
    } catch (error) {
      this.logger.error(`Failed to send user stats for ${userId}:`, error);
    }
  }

  /**
   * Send top leaderboard data
   */
  private async sendTopLeaderboard(
    client: ConnectedSocket,
    filters?: { limit?: number; orderBy?: string },
  ): Promise<void> {
    try {
      const limit = filters?.limit || 100;
      const orderBy = filters?.orderBy as any || 'netEarnings';
      
      const topLeaderboard = await this.leaderboardAggregationService.getTopLeaderboard(
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

      client.send(JSON.stringify(message));
    } catch (error) {
      this.logger.error(`Failed to send top leaderboard:`, error);
    }
  }

  /**
   * Get connected clients count
   */
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }
}
