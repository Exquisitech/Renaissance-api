import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  DefaultValuePipe,
  ParseIntPipe,
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
import { TeamsService, PaginatedTeams, TeamStandings } from './teams.service';
import { Team } from './entities/team.entity';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { SearchTeamsDto } from './dto/search-teams.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Teams')
@Controller('teams')
@UseInterceptors(HttpCacheInterceptor)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  @NoCache()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new team (Admin only)',
    description: 'Creates a new team with all details including logo URL',
  })
  @ApiBody({ type: CreateTeamDto })
  @ApiResponse({
    status: 201,
    description: 'Team successfully created',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Manchester United',
        shortName: 'Man Utd',
        code: 'MUN',
        league: 'Premier League',
        country: 'England',
        founded: 1878,
        stadium: 'Old Trafford',
        capacity: 74140,
        website: 'https://www.manutd.com',
        logoUrl: 'https://example.com/logos/man-united.png',
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
  async create(@Body() createTeamDto: CreateTeamDto): Promise<Team> {
    return this.teamsService.create(createTeamDto);
  }

  @Get()
  @CacheKey('teams')
  @ApiOperation({
    summary: 'Get all teams',
    description: 'Retrieves a paginated list of all teams with logo URLs',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'List of teams retrieved successfully',
    schema: {
      example: {
        data: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Manchester United',
            shortName: 'Man Utd',
            logoUrl: 'https://example.com/logos/man-united.png',
            league: 'Premier League',
          },
        ],
        total: 100,
        page: 1,
        limit: 10,
        totalPages: 10,
      },
    },
  })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<PaginatedTeams> {
    return this.teamsService.findAll(page, limit);
  }

  @Get('search')
  @CacheKey('teams-search')
  @ApiOperation({
    summary: 'Search teams',
    description: 'Search teams by partial name, league, or country with pagination',
  })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Partial team name search' })
  @ApiQuery({ name: 'league', required: false, type: String, description: 'Filter by league' })
  @ApiQuery({ name: 'country', required: false, type: String, description: 'Filter by country' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Teams search results retrieved successfully',
    schema: {
      example: {
        data: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Manchester United',
            shortName: 'Man Utd',
            logoUrl: 'https://example.com/logos/man-united.png',
            league: 'Premier League',
          },
        ],
        total: 5,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
    },
  })
  async search(
    @Query() searchDto: SearchTeamsDto,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<PaginatedTeams> {
    return this.teamsService.search(searchDto, page, limit);
  }

  @Get('standings/:league')
  @CacheKey('teams-standings')
  @ApiOperation({
    summary: 'Get league standings',
    description: 'Retrieves league standings sorted by points, goal difference, and goals for',
  })
  @ApiParam({
    name: 'league',
    description: 'League name',
    example: 'Premier League',
  })
  @ApiQuery({
    name: 'season',
    required: false,
    type: String,
    description: 'Filter by season (optional)',
    example: '2023-2024',
  })
  @ApiResponse({
    status: 200,
    description: 'League standings retrieved successfully',
    schema: {
      example: [
        {
          team: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Manchester United',
            logoUrl: 'https://example.com/logos/man-united.png',
          },
          played: 38,
          won: 25,
          drawn: 8,
          lost: 5,
          goalsFor: 68,
          goalsAgainst: 32,
          goalDifference: 36,
          points: 83,
        },
      ],
    },
  })
  async getLeagueStandings(
    @Param('league') league: string,
    @Query('season') season?: string,
  ): Promise<TeamStandings[]> {
    return this.teamsService.getLeagueStandings(league, season);
  }

  @Get(':id')
  @CacheKey('teams-single')
  @ApiOperation({
    summary: 'Get team by ID',
    description: 'Retrieves detailed information about a specific team including logo URL',
  })
  @ApiParam({
    name: 'id',
    description: 'Team UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Team found',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Manchester United',
        shortName: 'Man Utd',
        code: 'MUN',
        league: 'Premier League',
        country: 'England',
        founded: 1878,
        stadium: 'Old Trafford',
        capacity: 74140,
        website: 'https://www.manutd.com',
        logoUrl: 'https://example.com/logos/man-united.png',
        metadata: {
          colors: ['red', 'white'],
          nickname: 'The Red Devils',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Team not found',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Team> {
    return this.teamsService.findOne(id);
  }

  @Put(':id')
  @NoCache()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update team (Admin only)',
    description: 'Updates team information including logo URL',
  })
  @ApiParam({
    name: 'id',
    description: 'Team UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: UpdateTeamDto })
  @ApiResponse({
    status: 200,
    description: 'Team successfully updated',
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
    description: 'Team not found',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTeamDto: UpdateTeamDto,
  ): Promise<Team> {
    return this.teamsService.update(id, updateTeamDto);
  }

  @Delete(':id')
  @NoCache()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete team (Admin only)',
    description: 'Deletes a team from the system',
  })
  @ApiParam({
    name: 'id',
    description: 'Team UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Team successfully deleted',
    schema: {
      example: {
        message: 'Team successfully deleted',
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
    description: 'Team not found',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    await this.teamsService.remove(id);
    return { message: 'Team successfully deleted' };
  }
}
