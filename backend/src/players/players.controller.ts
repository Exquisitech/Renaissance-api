import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { HttpCacheInterceptor } from '../common/cache/interceptors/http-cache.interceptor';
import { CacheKey } from '../common/cache/decorators/cache-key.decorator';
import { NoCache } from '../common/cache/decorators/no-cache.decorator';
import { PlayersService, PaginatedPlayers, PlayerWithStats } from './players.service';
import { Player } from './entities/player.entity';
import { SearchPlayerDto } from './dto/search-player.dto';
import { PlayerStatisticsDto } from './dto/player-statistics.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Players')
@Controller('players')
@UseInterceptors(HttpCacheInterceptor)
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get('search')
  @CacheKey('players-search')
  @ApiOperation({
    summary: 'Search players by name',
    description: 'Search for players using RapidAPI football database with debounced requests',
  })
  @ApiQuery({ name: 'query', required: true, type: String, description: 'Player name to search' })
  @ApiQuery({ name: 'league', required: false, type: Number, description: 'Filter by league ID' })
  @ApiQuery({ name: 'season', required: false, type: Number, description: 'Filter by season year' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of results to return' })
  @ApiResponse({
    status: 200,
    description: 'Players search results retrieved successfully',
    schema: {
      example: [
        {
          id: 276,
          name: 'Lionel Messi',
          firstname: 'Lionel',
          lastname: 'Messi',
          age: 36,
          birth: {
            date: '1987-06-24',
            place: 'Rosario',
            country: 'Argentina',
          },
          nationality: 'Argentina',
          height: '170 cm',
          weight: '72 kg',
          injured: false,
          photo: 'https://media.api-sports.io/football/players/276.png',
        },
      ],
    },
  })
  async searchPlayers(@Query() searchDto: SearchPlayerDto) {
    return this.playersService.searchPlayers(searchDto);
  }

  @Get(':playerId/statistics')
  @CacheKey('players-statistics')
  @ApiOperation({
    summary: 'Get player statistics',
    description: 'Retrieve detailed statistics for a specific player',
  })
  @ApiParam({
    name: 'playerId',
    description: 'Player ID from external API',
    example: 276,
  })
  @ApiQuery({ name: 'league', required: false, type: Number, description: 'Filter by league ID' })
  @ApiQuery({ name: 'season', required: false, type: Number, description: 'Filter by season year' })
  @ApiResponse({
    status: 200,
    description: 'Player statistics retrieved successfully',
    schema: {
      example: [
        {
          team: {
            id: 541,
            name: 'Inter Miami',
            logo: 'https://media.api-sports.io/football/teams/541.png',
          },
          league: {
            id: 253,
            name: 'MLS',
            country: 'USA',
            logo: 'https://media.api-sports.io/football/leagues/253.png',
            flag: 'https://media.api-sports.io/flags/us.svg',
            season: 2023,
          },
          games: {
            appearences: 14,
            lineups: 14,
            minutes: 1179,
            number: 10,
            position: 'A',
            rating: '7.876923',
            captain: false,
          },
          goals: {
            total: 11,
            assists: 5,
          },
          shots: {
            total: 52,
            on: 28,
          },
          passes: {
            total: 826,
            key: 36,
            accuracy: '82',
          },
        },
      ],
    },
  })
  async getPlayerStatistics(
    @Param('playerId', ParseIntPipe) playerId: number,
    @Query() statsDto: PlayerStatisticsDto,
  ) {
    return this.playersService.getPlayerStatistics({ playerId, ...statsDto });
  }

  @Get(':playerId/team')
  @CacheKey('players-team')
  @ApiOperation({
    summary: 'Get player team and position',
    description: 'Retrieve current team information and position for a player',
  })
  @ApiParam({
    name: 'playerId',
    description: 'Player ID from external API',
    example: 276,
  })
  @ApiResponse({
    status: 200,
    description: 'Player team information retrieved successfully',
    schema: {
      example: [
        {
          team: {
            id: 541,
            name: 'Inter Miami',
            logo: 'https://media.api-sports.io/football/teams/541.png',
          },
          league: 'MLS',
          season: 2023,
          position: 'Attacker',
          number: 10,
        },
      ],
    },
  })
  async getPlayerTeamInfo(@Param('playerId', ParseIntPipe) playerId: number) {
    return this.playersService.getPlayerTeamInfo(playerId);
  }

  @Get(':playerId/age-nationality')
  @CacheKey('players-age-nationality')
  @ApiOperation({
    summary: 'Get player age and nationality',
    description: 'Retrieve age, nationality, and birth information for a player',
  })
  @ApiParam({
    name: 'playerId',
    description: 'Player ID from external API',
    example: 276,
  })
  @ApiResponse({
    status: 200,
    description: 'Player age and nationality retrieved successfully',
    schema: {
      example: {
        age: 36,
        nationality: 'Argentina',
        birthDate: '1987-06-24',
        birthPlace: 'Rosario',
      },
    },
  })
  async getPlayerAgeAndNationality(@Param('playerId', ParseIntPipe) playerId: number) {
    return this.playersService.getPlayerAgeAndNationality(playerId);
  }

  @Get(':playerId/image')
  @CacheKey('players-image')
  @ApiOperation({
    summary: 'Get player image',
    description: 'Retrieve player photo URL with fallback for unavailable images',
  })
  @ApiParam({
    name: 'playerId',
    description: 'Player ID from external API',
    example: 276,
  })
  @ApiResponse({
    status: 200,
    description: 'Player image URL retrieved successfully',
    schema: {
      example: 'https://media.api-sports.io/football/players/276.png',
    },
  })
  async getPlayerImage(@Param('playerId', ParseIntPipe) playerId: number) {
    return { imageUrl: await this.playersService.getPlayerImage(playerId) };
  }

  @Get('popular/:query')
  @CacheKey('players-popular')
  @ApiOperation({
    summary: 'Get popular player searches',
    description: 'Retrieve cached popular player search results',
  })
  @ApiParam({
    name: 'query',
    description: 'Search query',
    example: 'messi',
  })
  @ApiResponse({
    status: 200,
    description: 'Popular player search results retrieved successfully',
  })
  async getPopularPlayers(@Param('query') query: string) {
    return this.playersService.getPopularPlayers(query);
  }

  @Get()
  @CacheKey('players')
  @ApiOperation({
    summary: 'Get all players',
    description: 'Retrieve paginated list of all players in database',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'List of players retrieved successfully',
  })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<PaginatedPlayers> {
    return this.playersService.findAll(page, limit);
  }

  @Get(':id')
  @CacheKey('players-single')
  @ApiOperation({
    summary: 'Get player by ID',
    description: 'Retrieve detailed information about a specific player from database',
  })
  @ApiParam({
    name: 'id',
    description: 'Player UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Player found',
  })
  @ApiResponse({
    status: 404,
    description: 'Player not found',
  })
  async findOne(@Param('id') id: string): Promise<Player> {
    return this.playersService.findOne(id);
  }

  @Post(':playerId/sync')
  @NoCache()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Sync player from external API (Admin only)',
    description: 'Sync player data from RapidAPI football database to local database',
  })
  @ApiParam({
    name: 'playerId',
    description: 'Player ID from external API',
    example: 276,
  })
  @ApiResponse({
    status: 200,
    description: 'Player synced successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - requires admin role',
  })
  async syncPlayer(@Param('playerId', ParseIntPipe) playerId: number) {
    return this.playersService.syncPlayerFromApi(playerId);
  }
}
