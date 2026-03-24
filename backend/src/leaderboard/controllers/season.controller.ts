import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { SeasonService } from '../services/season.service';
import { SeasonalLeaderboardService } from '../services/seasonal-leaderboard.service';
import { SeasonResetService } from '../services/season-reset.service';
import { CreateSeasonDto, UpdateSeasonDto } from '../dto/season.dto';
import { LeaderboardTier } from '../entities/seasonal-leaderboard.entity';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';

@ApiTags('Seasons')
@Controller('seasons')
export class SeasonController {
  constructor(
    private readonly seasonService: SeasonService,
    private readonly seasonalLeaderboardService: SeasonalLeaderboardService,
    private readonly seasonResetService: SeasonResetService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new season (Admin only)' })
  async createSeason(@Body() dto: CreateSeasonDto) {
    return this.seasonService.createSeason(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a season (Admin only)' })
  async updateSeason(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSeasonDto,
  ) {
    return this.seasonService.updateSeason(id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all seasons' })
  async getAllSeasons() {
    return this.seasonService.getAllSeasons();
  }

  @Get('active')
  @ApiOperation({ summary: 'Get the current active season' })
  async getActiveSeason() {
    return this.seasonService.getActiveSeason();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get season by ID' })
  async getSeasonById(@Param('id', ParseUUIDPipe) id: string) {
    return this.seasonService.getSeasonById(id);
  }

  @Get(':id/leaderboard')
  @ApiOperation({ summary: 'Get leaderboard for a specific season' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'tier', required: false, enum: LeaderboardTier })
  async getSeasonLeaderboard(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: number,
    @Query('tier') tier?: LeaderboardTier,
  ) {
    return this.seasonalLeaderboardService.getSeasonLeaderboard(
      id,
      limit || 100,
      tier,
    );
  }

  @Get(':id/tier-distribution')
  @ApiOperation({ summary: 'Get tier distribution for a season' })
  async getTierDistribution(@Param('id', ParseUUIDPipe) id: string) {
    return this.seasonalLeaderboardService.getTierDistribution(id);
  }

  @Post(':id/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually complete a season (Admin only)' })
  async completeSeason(@Param('id', ParseUUIDPipe) id: string) {
    const season = await this.seasonService.getSeasonById(id);
    await this.seasonResetService.resetSeason(season);
    return { message: 'Season completed successfully' };
  }

  @Post(':id/archive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Archive a season (Admin only)' })
  async archiveSeason(@Param('id', ParseUUIDPipe) id: string) {
    return this.seasonService.archiveSeason(id);
  }

  @Get('user/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user season history' })
  async getUserSeasonHistory(@CurrentUser() user: User) {
    return this.seasonResetService.getSeasonHistory(user.id);
  }

  @Get(':seasonId/user/:userId')
  @ApiOperation({ summary: 'Get user stats for a specific season' })
  async getUserSeasonStats(
    @Param('seasonId', ParseUUIDPipe) seasonId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.seasonalLeaderboardService.getUserSeasonStats(userId, seasonId);
  }
}
