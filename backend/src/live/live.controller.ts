import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LiveService } from './live.service';
import { UpdateMatchDto } from './dto/update-match.dto';
import { LeaderboardUpdateDto } from './dto/leaderboard-update.dto';
import { BroadcastEventDto } from './dto/broadcast-event.dto';

@ApiTags('Live')
@ApiBearerAuth('JWT-auth')
@Controller('live')
export class LiveController {
  constructor(private readonly liveService: LiveService) {}

  /**
   * Push a live score update to all clients subscribed to the match.
   * Call this whenever the home/away score changes.
   */
  @Post('match-update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Broadcast a live score update for a match' })
  @ApiResponse({ status: 200, description: 'Update broadcast' })
  broadcastMatchUpdate(@Body() payload: UpdateMatchDto): { ok: boolean } {
    this.liveService.broadcastMatchUpdate(payload);
    return { ok: true };
  }

  /**
   * Push a match status change (e.g. live → finished) to the match room
   * and a lightweight global event for lobby/dashboard clients.
   */
  @Post('match-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Broadcast a match status change' })
  @ApiResponse({ status: 200, description: 'Status change broadcast' })
  broadcastMatchStatus(@Body() payload: UpdateMatchDto): { ok: boolean } {
    this.liveService.broadcastMatchStatus(payload);
    return { ok: true };
  }

  /**
   * Push an updated leaderboard entry to all subscribed clients.
   * Trigger after a bet or stake is settled.
   */
  @Post('leaderboard-update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Broadcast a leaderboard update for a user' })
  @ApiResponse({ status: 200, description: 'Leaderboard update broadcast' })
  broadcastLeaderboardUpdate(
    @Body() payload: LeaderboardUpdateDto,
  ): { ok: boolean } {
    this.liveService.broadcastLeaderboardUpdate(payload);
    return { ok: true };
  }

  /**
   * Send an arbitrary named event to a room (or to all clients if no room given).
   * Useful for odds updates, admin announcements, etc.
   */
  @Post('broadcast')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Broadcast an arbitrary event to a room or all clients' })
  @ApiResponse({ status: 200, description: 'Event broadcast' })
  broadcastEvent(@Body() payload: BroadcastEventDto): { ok: boolean } {
    this.liveService.broadcastEvent(payload.event, payload.data, payload.room);
    return { ok: true };
  }

  /**
   * Return a snapshot of the current WebSocket connection pool.
   * Includes total connections, unique users, and per-match subscriber counts.
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get WebSocket connection pool stats' })
  @ApiResponse({
    status: 200,
    description: 'Connection stats',
    schema: {
      example: {
        total: 42,
        uniqueUsers: 38,
        byMatch: { 'uuid-match-1': 15, 'uuid-match-2': 7 },
      },
    },
  })
  getStats() {
    return this.liveService.getConnectionStats();
  }
}
