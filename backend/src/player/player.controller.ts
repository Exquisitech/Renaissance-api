import { Controller, Post, Get, Patch, Body, Param, Query, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { Request } from 'express';
import { PlayerService } from './player.service';
import { Player } from './entities/player.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: UserRole;
  };
}

@ApiTags('Players')
@Controller('players')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new player',
    description: 'Creates a new player record with basic information',
  })
  @ApiBody({ type: Player })
  @ApiResponse({
    status: 201,
    description: 'Player successfully created',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Lionel Messi',
        email: 'messi@example.com',
        stellarAddress: 'GA2U...',
        metadata: { position: 'Forward', nationality: 'Argentina' },
        totalSpins: 0,
        totalWagered: 0,
        totalWon: 0,
        walletBalance: 0,
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-15T10:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
    schema: {
      example: {
        statusCode: 400,
        message: ['email must be a valid email', 'name is required'],
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - player with this email already exists',
  })
  create(@Req() req: AuthenticatedRequest, @Body() dto: Partial<Player>): Promise<Player> {
    return this.playerService.create(dto);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search players by name',
    description: 'Searches for players by partial name match',
  })
  @ApiQuery({
    name: 'name',
    required: true,
    type: String,
    description: 'Player name to search for',
    example: 'Messi',
  })
  @ApiResponse({
    status: 200,
    description: 'Search results retrieved successfully',
    schema: {
      example: [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Lionel Messi',
          email: 'messi@example.com',
          totalSpins: 150,
          walletBalance: 5000.0,
        },
      ],
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - name parameter is required',
  })
  search(@Query('name') name: string): Promise<Player[]> {
    return this.playerService.search(name);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get player by ID',
    description: 'Retrieves detailed information about a specific player',
  })
  @ApiParam({
    name: 'id',
    description: 'Player UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Player found',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Lionel Messi',
        email: 'messi@example.com',
        stellarAddress: 'GA2U...',
        metadata: { position: 'Forward', nationality: 'Argentina' },
        totalSpins: 150,
        totalWagered: 2500.0,
        totalWon: 3000.0,
        walletBalance: 5000.0,
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-15T10:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Player not found',
    schema: {
      example: {
        statusCode: 404,
        message: 'Player not found',
        error: 'Not Found',
      },
    },
  })
  findOne(@Param('id') id: string): Promise<Player> {
    return this.playerService.findById(id);
  }

  @Get(':id/stats')
  @ApiOperation({
    summary: 'Get player statistics',
    description: 'Retrieves detailed statistics for a specific player',
  })
  @ApiParam({
    name: 'id',
    description: 'Player UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Player statistics retrieved successfully',
    schema: {
      example: {
        totalSpins: 150,
        totalWagered: 2500.0,
        totalWon: 3000.0,
        winRate: 60.5,
        walletBalance: 5000.0,
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Player not found',
  })
  stats(@Param('id') id: string): Promise<any> {
    return this.playerService.getStats(id);
  }

  @Patch(':id/metadata')
  @ApiOperation({
    summary: 'Update player metadata',
    description: 'Updates metadata for a specific player',
  })
  @ApiParam({
    name: 'id',
    description: 'Player UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: true,
      example: { position: 'Forward', nationality: 'Argentina' },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Player metadata updated successfully',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Lionel Messi',
        metadata: { position: 'Forward', nationality: 'Argentina' },
        updatedAt: '2024-01-15T10:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid metadata',
  })
  @ApiResponse({
    status: 404,
    description: 'Player not found',
  })
  updateMetadata(@Param('id') id: string, @Body() metadata: Record<string, any>): Promise<Player> {
    return this.playerService.updateMetadata(id, metadata);
  }
}