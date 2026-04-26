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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiResponse,
  ApiBody,
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
import { Season } from '../entities/season.entity';
import { SeasonalLeaderboard } from '../entities/seasonal-leaderboard.entity';

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
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new season (Admin only)',
    description:
      'Creates a new competitive season with tier thresholds and date ranges. Only administrators can create seasons.',
  })
  @ApiBody({ type: CreateSeasonDto })
  @ApiResponse({
    status: 201,
    description: 'Season successfully created',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Season 5',
        seasonNumber: 5,
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-03-31T23:59:59Z',
        status: 'active',
        description: 'Winter competitive season',
        bronzeThreshold: 0,
        silverThreshold: 1000,
        goldThreshold: 5000,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed or season already exists',
    schema: {
      example: {
        statusCode: 400,
        message: 'Season with this name already exists',
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
  async createSeason(@Body() dto: CreateSeasonDto) {
    return this.seasonService.createSeason(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update a season (Admin only)',
    description:
      'Updates season details including name, dates, and tier thresholds. Cannot modify completed seasons.',
  })
  @ApiParam({
    name: 'id',
    description: 'Season UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: UpdateSeasonDto })
  @ApiResponse({
    status: 200,
    description: 'Season successfully updated',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Season 5',
        seasonNumber: 5,
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-04-30T23:59:59Z',
        status: 'active',
        bronzeThreshold: 0,
        silverThreshold: 1000,
        goldThreshold: 5000,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
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
    description: 'Season not found',
  })
  async updateSeason(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSeasonDto,
  ) {
    return this.seasonService.updateSeason(id, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all seasons',
    description: 'Retrieves a list of all seasons ordered by creation date',
  })
  @ApiResponse({
    status: 200,
    description: 'Seasons retrieved successfully',
    schema: {
      example: [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Season 5',
          seasonNumber: 5,
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-03-31T23:59:59Z',
          status: 'active',
          bronzeThreshold: 0,
          silverThreshold: 1000,
          goldThreshold: 5000,
        },
        {
          id: '234e5678-e90b-12d3-a456-426614174001',
          name: 'Season 4',
          seasonNumber: 4,
          startDate: '2023-10-01T00:00:00Z',
          endDate: '2023-12-31T23:59:59Z',
          status: 'completed',
          bronzeThreshold: 0,
          silverThreshold: 1000,
          goldThreshold: 5000,
        },
      ],
    },
  })
  async getAllSeasons() {
    return this.seasonService.getAllSeasons();
  }

  @Get('active')
  @ApiOperation({
    summary: 'Get the current active season',
    description: 'Retrieves the currently active season (only one can be active at a time)',
  })
  @ApiResponse({
    status: 200,
    description: 'Active season retrieved successfully',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Season 5',
        seasonNumber: 5,
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-03-31T23:59:59Z',
        status: 'active',
        bronzeThreshold: 0,
        silverThreshold: 1000,
        goldThreshold: 5000,
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'No active season found',
  })
  async getActiveSeason() {
    return this.seasonService.getActiveSeason();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get season by ID',
    description: 'Retrieves detailed information about a specific season',
  })
  @ApiParam({
    name: 'id',
    description: 'Season UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Season found',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Season 5',
        seasonNumber: 5,
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-03-31T23:59:59Z',
        status: 'active',
        description: 'Winter competitive season',
        bronzeThreshold: 0,
        silverThreshold: 1000,
        goldThreshold: 5000,
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Season not found',
  })
  async getSeasonById(@Param('id', ParseUUIDPipe) id: string) {
    return this.seasonService.getSeasonById(id);
  }

  @Get(':id/leaderboard')
  @ApiOperation({
    summary: 'Get leaderboard for a specific season',
    description:
      'Retrieves the leaderboard rankings for a season with optional tier filtering',
  })
  @ApiParam({
    name: 'id',
    description: 'Season UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of entries to return',
    example: 100,
  })
  @ApiQuery({
    name: 'tier',
    required: false,
    enum: LeaderboardTier,
    description: 'Filter by tier (bronze, silver, gold)',
  })
  @ApiResponse({
    status: 200,
    description: 'Leaderboard retrieved successfully',
    schema: {
      example: {
        data: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            userId: '456e7890-e12b-34d5-a678-901234567890',
            username: 'john_doe',
            totalPoints: 15000,
            tier: 'gold',
            rank: 1,
            seasonId: '123e4567-e89b-12d3-a456-426614174000',
          },
        ],
        total: 500,
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Season not found',
  })
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
  @ApiOperation({
    summary: 'Get tier distribution for a season',
    description:
      'Retrieves the count of players in each tier for a specific season',
  })
  @ApiParam({
    name: 'id',
    description: 'Season UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Tier distribution retrieved successfully',
    schema: {
      example: {
        bronze: 250,
        silver: 150,
        gold: 80,
        platinum: 20,
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Season not found',
  })
  async getTierDistribution(@Param('id', ParseUUIDPipe) id: string) {
    return this.seasonalLeaderboardService.getTierDistribution(id);
  }

  @Post(':id/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually complete a season (Admin only)',
    description:
      'Manually marks a season as completed and triggers the reset process. This is usually automatic based on end date.',
  })
  @ApiParam({
    name: 'id',
    description: 'Season UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Season completed successfully',
    schema: {
      example: {
        message: 'Season completed successfully',
        seasonId: '123e4567-e89b-12d3-a456-426614174000',
        completedAt: '2024-03-31T23:59:59Z',
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
    description: 'Season not found',
  })
  async completeSeason(@Param('id', ParseUUIDPipe) id: string) {
    const season = await this.seasonService.getSeasonById(id);
    await this.seasonResetService.resetSeason(season);
    return { message: 'Season completed successfully' };
  }

  @Post(':id/archive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Archive a season (Admin only)',
    description:
      'Archives a completed season, making it read-only. Archived seasons are preserved for historical records.',
  })
  @ApiParam({
    name: 'id',
    description: 'Season UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Season archived successfully',
    schema: {
      example: {
        message: 'Season archived successfully',
        seasonId: '123e4567-e89b-12d3-a456-426614174000',
        archivedAt: '2024-04-01T00:00:00Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - season must be completed before archiving',
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
    description: 'Season not found',
  })
  async archiveSeason(@Param('id', ParseUUIDPipe) id: string) {
    return this.seasonService.archiveSeason(id);
  }

  @Get('user/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get user season history',
    description: 'Retrieves all seasons the user has participated in with their stats',
  })
  @ApiResponse({
    status: 200,
    description: 'User season history retrieved successfully',
    schema: {
      example: [
        {
          season: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Season 5',
            status: 'active',
          },
          stats: {
            totalPoints: 15000,
            tier: 'gold',
            rank: 1,
            matchesPlayed: 150,
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  async getUserSeasonHistory(@CurrentUser() user: User) {
    return this.seasonResetService.getSeasonHistory(user.id);
  }

  @Get(':seasonId/user/:userId')
  @ApiOperation({
    summary: 'Get user stats for a specific season',
    description: 'Retrieves a specific users performance statistics for a given season',
  })
  @ApiParam({
    name: 'seasonId',
    description: 'Season UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'userId',
    description: 'User UUID',
    example: '456e7890-e12b-34d5-a678-901234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'User season stats retrieved successfully',
    schema: {
      example: {
        userId: '456e7890-e12b-34d5-a678-901234567890',
        seasonId: '123e4567-e89b-12d3-a456-426614174000',
        totalPoints: 15000,
        tier: 'gold',
        rank: 5,
        matchesPlayed: 150,
        winRate: 65.5,
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Season or user not found',
  })
  async getUserSeasonStats(
    @Param('seasonId', ParseUUIDPipe) seasonId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.seasonalLeaderboardService.getUserSeasonStats(userId, seasonId);
  }
}
