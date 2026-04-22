import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { UpdateMatchDto } from './dto/update-match.dto';
import { SubscribeMatchDto } from './dto/subscribe-match.dto';
import { LeaderboardUpdateDto } from './dto/leaderboard-update.dto';

interface ConnectedClient {
  socket: Socket;
  userId: string | undefined;
  connectedAt: Date;
  lastPingAt: Date;
  subscribedMatches: Set<string>;
}

/**
 * LiveGateway — Socket.IO gateway for real-time match and leaderboard updates.
 *
 * Rooms:
 *   match:{matchId}   – per-match score/status/odds updates
 *   leaderboard       – global leaderboard change events
 *
 * Client messages:
 *   subscribe:match        { matchId }  → joins match room
 *   unsubscribe:match      { matchId }  → leaves match room
 *   subscribe:leaderboard              → joins leaderboard room
 *   unsubscribe:leaderboard            → leaves leaderboard room
 *   ping                               → server replies with pong (heartbeat)
 *
 * Server events:
 *   connected             – on successful handshake
 *   match:update          – score change broadcast to match room
 *   match:status          – status change broadcast to match room + global
 *   match:status:global   – status change sent to all clients
 *   leaderboard:update    – leaderboard snapshot sent to leaderboard room
 *   bet:settled           – personal event delivered to the owning user's sockets
 *   broadcast             – arbitrary named event to all / a room
 *   pong                  – heartbeat response
 *   error                 – error message
 */
@WebSocketGateway({
  namespace: 'live',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  // Built-in Socket.IO heartbeat — keeps connections alive and detects stale ones
  pingTimeout: 60000,
  pingInterval: 25000,
})
export class LiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LiveGateway.name);

  /**
   * Primary connection pool: socketId → connection metadata.
   * Provides O(1) lookup for per-socket operations.
   */
  private readonly pool = new Map<string, ConnectedClient>();

  /**
   * Reverse index: userId → Set<socketId>.
   * Enables efficient per-user delivery without scanning the whole pool.
   */
  private readonly userSockets = new Map<string, Set<string>>();

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  handleConnection(client: Socket): void {
    const userId = client.handshake.query.userId as string | undefined;

    this.pool.set(client.id, {
      socket: client,
      userId,
      connectedAt: new Date(),
      lastPingAt: new Date(),
      subscribedMatches: new Set(),
    });

    if (userId) {
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);
    }

    this.logger.log(
      `Client connected: ${client.id} userId=${userId ?? 'anon'} (pool=${this.pool.size})`,
    );

    client.emit('connected', {
      socketId: client.id,
      timestamp: new Date().toISOString(),
    });
  }

  handleDisconnect(client: Socket): void {
    const conn = this.pool.get(client.id);
    if (conn?.userId) {
      const sockets = this.userSockets.get(conn.userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(conn.userId);
        }
      }
    }
    this.pool.delete(client.id);
    this.logger.log(
      `Client disconnected: ${client.id} (pool=${this.pool.size})`,
    );
  }

  // ─── Client messages ─────────────────────────────────────────────────────────

  @SubscribeMessage('subscribe:match')
  handleSubscribeMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SubscribeMatchDto,
  ): void {
    const conn = this.pool.get(client.id);
    if (!conn) {
      client.emit('error', { message: 'Client not registered' });
      return;
    }
    const room = `match:${data.matchId}`;
    void client.join(room);
    conn.subscribedMatches.add(data.matchId);
    client.emit('subscribed:match', {
      matchId: data.matchId,
      timestamp: new Date().toISOString(),
    });
    this.logger.debug(`${client.id} subscribed to ${room}`);
  }

  @SubscribeMessage('unsubscribe:match')
  handleUnsubscribeMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SubscribeMatchDto,
  ): void {
    const conn = this.pool.get(client.id);
    if (!conn) return;
    const room = `match:${data.matchId}`;
    void client.leave(room);
    conn.subscribedMatches.delete(data.matchId);
    client.emit('unsubscribed:match', {
      matchId: data.matchId,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('subscribe:leaderboard')
  handleSubscribeLeaderboard(@ConnectedSocket() client: Socket): void {
    void client.join('leaderboard');
    client.emit('subscribed:leaderboard', {
      timestamp: new Date().toISOString(),
    });
    this.logger.debug(`${client.id} subscribed to leaderboard`);
  }

  @SubscribeMessage('unsubscribe:leaderboard')
  handleUnsubscribeLeaderboard(@ConnectedSocket() client: Socket): void {
    void client.leave('leaderboard');
    client.emit('unsubscribed:leaderboard', {
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Explicit application-level heartbeat.
   * Socket.IO's built-in ping/pong handles transport keepalive, but clients
   * can also send a 'ping' message to verify round-trip connectivity and
   * update lastPingAt for monitoring purposes.
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket): void {
    const conn = this.pool.get(client.id);
    if (conn) {
      conn.lastPingAt = new Date();
    }
    client.emit('pong', { timestamp: Date.now() });
  }

  // ─── Broadcast methods (called by LiveService) ───────────────────────────────

  /**
   * Broadcast a score update to all clients subscribed to the given match.
   */
  broadcastMatchUpdate(update: UpdateMatchDto): void {
    const payload = { ...update, timestamp: update.timestamp ?? Date.now() };
    this.server.to(`match:${update.matchId}`).emit('match:update', payload);
    this.logger.debug(`match:update → match:${update.matchId}`);
  }

  /**
   * Broadcast a status change to the match room AND emit a lightweight
   * global event so clients not subscribed to the room still learn that
   * a match changed state (useful for lobby/dashboard views).
   */
  broadcastMatchStatus(update: UpdateMatchDto): void {
    const ts = update.timestamp ?? Date.now();
    const payload = { ...update, timestamp: ts };
    this.server.to(`match:${update.matchId}`).emit('match:status', payload);
    this.server.emit('match:status:global', {
      matchId: update.matchId,
      status: update.status,
      homeScore: update.homeScore,
      awayScore: update.awayScore,
      timestamp: ts,
    });
    this.logger.debug(`match:status → match:${update.matchId} status=${update.status}`);
  }

  /**
   * Broadcast a leaderboard snapshot to all clients in the leaderboard room.
   */
  broadcastLeaderboardUpdate(update: LeaderboardUpdateDto): void {
    this.server.to('leaderboard').emit('leaderboard:update', {
      ...update,
      timestamp: new Date().toISOString(),
    });
    this.logger.debug(`leaderboard:update → user ${update.userId} rank ${update.rank}`);
  }

  /**
   * Deliver a bet-settled event to all sockets owned by a specific user.
   * Uses the reverse-index for O(1) user lookup instead of scanning the pool.
   */
  broadcastBetSettled(
    userId: string,
    betData: Record<string, unknown>,
  ): void {
    const socketIds = this.userSockets.get(userId);
    if (!socketIds || socketIds.size === 0) return;

    const payload = { ...betData, timestamp: new Date().toISOString() };
    for (const socketId of socketIds) {
      const conn = this.pool.get(socketId);
      if (conn) {
        conn.socket.emit('bet:settled', payload);
      }
    }
    this.logger.debug(`bet:settled → userId=${userId} (${socketIds.size} socket(s))`);
  }

  /**
   * General-purpose event broadcast. Sends to a specific room when provided,
   * otherwise sends to all connected clients.
   */
  broadcastEvent(
    event: string,
    data: Record<string, unknown>,
    room?: string,
  ): void {
    const payload = { ...data, timestamp: new Date().toISOString() };
    if (room) {
      this.server.to(room).emit(event, payload);
      this.logger.debug(`${event} → room "${room}"`);
    } else {
      this.server.emit(event, payload);
      this.logger.debug(`${event} → all`);
    }
  }

  // ─── Monitoring ──────────────────────────────────────────────────────────────

  /**
   * Returns a snapshot of the current connection pool state.
   * Useful for health checks and admin dashboards.
   */
  getConnectionStats(): {
    total: number;
    uniqueUsers: number;
    byMatch: Record<string, number>;
  } {
    const byMatch: Record<string, number> = {};
    for (const conn of this.pool.values()) {
      for (const matchId of conn.subscribedMatches) {
        byMatch[matchId] = (byMatch[matchId] ?? 0) + 1;
      }
    }
    return {
      total: this.pool.size,
      uniqueUsers: this.userSockets.size,
      byMatch,
    };
  }
}
