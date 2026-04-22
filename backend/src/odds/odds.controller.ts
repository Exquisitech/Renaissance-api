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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { UpdateMatchOddsDto } from './dto/update-match-odds.dto';
import { OddsService } from './odds.service';
import { OddsUpdateSource } from './entities/match-odds-history.entity';
import { OddsRealtimeService } from './odds-realtime.service';

@ApiTags('Odds')
@Controller('odds')
export class OddsController {
  constructor(
    private readonly oddsService: OddsService,
    private readonly oddsRealtimeService: OddsRealtimeService,
  ) {}

  @Get('ws-info')
  @ApiOperation({ summary: 'Get live odds websocket connection details' })
  getWebSocketInfo() {
    return {
      websocketPath: this.oddsRealtimeService.getWebSocketPath(),
      event: 'odds.updated',
    };
  }

  @Get('matches/:matchId')
  @ApiOperation({ summary: 'Get cached odds snapshot for a match' })
  async getOddsSnapshot(@Param('matchId', ParseUUIDPipe) matchId: string) {
    return this.oddsService.getOddsSnapshot(matchId);
  }

  @Get('matches/:matchId/history')
  @ApiOperation({ summary: 'Get odds change history for a match' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
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
  @ApiOperation({ summary: 'Manually adjust match odds' })
  async updateOdds(
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Body() dto: UpdateMatchOddsDto,
    @Request() req: any,
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
  @ApiOperation({ summary: 'Trigger automatic repricing for a match' })
  async autoAdjustOdds(@Param('matchId', ParseUUIDPipe) matchId: string) {
    return this.oddsService.autoAdjustOdds(matchId, {
      trigger: 'admin_manual_auto_adjust',
    });
  }
}
