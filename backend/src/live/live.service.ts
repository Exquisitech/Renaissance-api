import { Injectable, Logger } from '@nestjs/common';
import { LiveGateway } from './live.gateway';
import { UpdateMatchDto } from './dto/update-match.dto';
import { LeaderboardUpdateDto } from './dto/leaderboard-update.dto';
import { MatchStatus } from '../common/enums/match.enums';

@Injectable()
export class LiveService {
  private readonly logger = new Logger(LiveService.name);

  constructor(private readonly gateway: LiveGateway) {}

  /**
   * Push a score update to clients watching this match.
   * If the status is a terminal state (finished/cancelled/postponed),
   * also fires a status broadcast so dashboard/lobby views update.
   */
  broadcastMatchUpdate(update: UpdateMatchDto): void {
    this.logger.debug(`broadcastMatchUpdate matchId=${update.matchId}`);
    this.gateway.broadcastMatchUpdate(update);

    const terminalStatuses: MatchStatus[] = [
      MatchStatus.FINISHED,
      MatchStatus.CANCELLED,
      MatchStatus.POSTPONED,
    ];
    if (update.status && terminalStatuses.includes(update.status)) {
      this.gateway.broadcastMatchStatus(update);
    }
  }

  /**
   * Push a status-only change (e.g. kick-off, half-time, full-time).
   * Delivers to the match room AND emits a global event for lobby views.
   */
  broadcastMatchStatus(update: UpdateMatchDto): void {
    this.logger.debug(
      `broadcastMatchStatus matchId=${update.matchId} status=${update.status}`,
    );
    this.gateway.broadcastMatchStatus(update);
  }

  /**
   * Push updated leaderboard standings to subscribed clients.
   */
  broadcastLeaderboardUpdate(update: LeaderboardUpdateDto): void {
    this.logger.debug(
      `broadcastLeaderboardUpdate userId=${update.userId} rank=${update.rank}`,
    );
    this.gateway.broadcastLeaderboardUpdate(update);
  }

  /**
   * Notify a specific user that one of their bets has been settled.
   * Only delivered to sockets authenticated as that user.
   */
  broadcastBetSettled(
    userId: string,
    betData: Record<string, unknown>,
  ): void {
    this.logger.debug(`broadcastBetSettled userId=${userId}`);
    this.gateway.broadcastBetSettled(userId, betData);
  }

  /**
   * Send an arbitrary event to a specific room or to all connected clients.
   * Useful for odds updates, system announcements, etc.
   */
  broadcastEvent(
    event: string,
    data: Record<string, unknown>,
    room?: string,
  ): void {
    this.logger.debug(`broadcastEvent event=${event} room=${room ?? 'all'}`);
    this.gateway.broadcastEvent(event, data, room);
  }

  /**
   * Return a real-time snapshot of connected clients for monitoring.
   */
  getConnectionStats() {
    return this.gateway.getConnectionStats();
  }
}
