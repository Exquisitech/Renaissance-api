import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { UpdateMatchOddsDto } from './dto/update-match-odds.dto';
import { OddsService } from './odds.service';
import { OddsUpdateSource } from './entities/match-odds-history.entity';
import { OddsRealtimeService } from './odds-realtime.service';
import { Match } from '../matches/entities/match.entity';

@ApiTags('Odds')
@Controller('odds')
export class OddsController {
  constructor(
    private readonly oddsService: OddsService,
    private readonly oddsRealtimeService: OddsRealtimeService,
  ) {}

  @Get('ws-info')
  @ApiOperation({
    summary: 'Get live odds websocket connection details',
    description: 'Retrieves WebSocket connection information for real-time odds updates',
  })
  @ApiResponse({
    status: 200,
    description: 'WebSocket info retrieved',
    schema: {
      example: {
        websocketPath: '/odds/ws',
        event: 'odds.updated',
      },
    },
  })
  getWebSocketInfo() {
    return {
      websocketPath: this.oddsRealtimeService.getWebSocketPath(),
      event: 'odds.updated',
    };
  }

  @Get('matches/:matchId')
  @ApiOperation({
    summary: 'Get cached odds snapshot for a match',
    description:
      'Retrieves the current odds snapshot for a specific match including home, draw, and away odds',
  })
  @ApiParam({
    name: 'matchId',
    description: 'Match UUID',
    example: '789e0123-e45b-67d8-a901-234567890123',
  })
  @ApiResponse({
    status: 200,
    description: 'Odds snapshot retrieved',
    schema: {
      example: {
        matchId: '789e0123-e45b-67d8-a901-234567890123',
        homeOdds: 1.85,
        drawOdds: 3.2,
        awayOdds: 2.1,
        lastUpdated: '2024-01-15T10:30:00Z',
        updateCount: 5,
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Match not found or odds not available',
  })
  async getOddsSnapshot(@Param('matchId', ParseUUIDPipe) matchId: string) {
    return this.oddsService.getOddsSnapshot(matchId);
  }

  @Get('matches/:matchId/history')
  @ApiOperation({
    summary: 'Get odds change history for a match',
    description:
      'Retrieves historical odds changes for analysis and tracking market movements',
  })
  @ApiParam({
    name: 'matchId',
    description: 'Match UUID',
    example: '789e0123-e45b-67d8-a901-234567890123',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max number of historical entries to return',
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Odds history retrieved',
    schema: {
      example: [
        {
          id: 'hist_1',
          matchId: '789e0123-e45b-67d8-a901-234567890123',
          homeOdds: 1.90,
          drawOdds: 3.1,
          awayOdds: 2.05,
          source: 'manual',
          changedBy: 'admin_123',
          reason: 'Team injury update',
          createdAt: '2024-01-15T10:00:00Z',
        },
        {
          id: 'hist_2',
          matchId: '789e0123-e45b-67d8-a901-234567890123',
          homeOdds: 1.85,
          drawOdds: 3.2,
          awayOdds: 2.1,
          source: 'auto',
          changedBy: null,
          reason: 'betting_volume',
          createdAt: '2024-01-15T09:00:00Z',
        },
      ],
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Match not found',
  })
  async getOddsHistory(
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Query('limit') limit?: string,
  ) {
    return this.oddsService.getOddsHistory(
      matchId,
      limit ? Number(limit) : undefined,
    );
  }

  @Patch('matches/:matchId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually adjust match odds',
    description:
      'Allows admins to manually set odds for a match. Records change in history with audit trail.',
  })
  @ApiParam({
    name: 'matchId',
    description: 'Match UUID',
    example: '789e0123-e45b-67d8-a901-234567890123',
  })
  @ApiBody({ type: UpdateMatchOddsDto })
  @ApiResponse({
    status: 200,
    description: 'Odds updated successfully',
    schema: {
      example: {
        id: '789e0123-e45b-67d8-a901-234567890123',
        homeOdds: 1.90,
        drawOdds: 3.1,
        awayOdds: 2.05,
        lastUpdated: '2024-01-15T10:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid odds values',
    schema: {
      example: {
        statusCode: 400,
        message: 'Odds must be greater than 1.0',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - requires admin role',
  })
  @ApiResponse({
    status: 404,
    description: 'Match not found',
  })
  async updateOdds(
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Body() dto: UpdateMatchOddsDto,
    @Request() req: Request & { user: { id?: string; userId?: string } },
  ) {
    return this.oddsService.updateOdds(matchId, dto, {
      source: OddsUpdateSource.MANUAL,
      changedByUserId: req.user?.id ?? req.user?.userId ?? null,
      reason: dto.reason ?? 'manual_adjustment',
      metadata: { trigger: 'admin_api' },
    });
  }

  @Post('matches/:matchId/auto-adjust')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger automatic repricing for a match',
    description:
      'Manually triggers the automatic odds adjustment algorithm for a match based on current betting patterns',
  })
  @ApiParam({
    name: 'matchId',
    description: 'Match UUID',
    example: '789e0123-e45b-67d8-a901-234567890123',
  })
  @ApiResponse({
    status: 200,
    description: 'Auto-adjustment triggered and completed',
    schema: {
      example: {
        matchId: '789e0123-e45b-67d8-a901-234567890123',
        oldOdds: { home: 1.85, draw: 3.2, away: 2.1 },
        newOdds: { home: 1.80, draw: 3.3, away: 2.15 },
        adjustmentReason: 'betting_volume_imbalance',
        triggeredBy: 'admin_123',
        adjustedAt: '2024-01-15T10:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - auto-adjustment not possible (match not active or insufficient data)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - requires admin role',
  })
  @ApiResponse({
    status: 404,
    description: 'Match not found',
  })
  async autoAdjustOdds(
    @Param('matchId', ParseUUIDPipe) matchId: string,
  ) {
    return this.oddsService.autoAdjustOdds(matchId, {
      trigger: 'admin_manual_auto_adjust',
    });
  }
}
