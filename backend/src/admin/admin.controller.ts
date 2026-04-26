import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  Get,
  Patch,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
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
import { Request } from 'express';
import { AdminService } from './admin.service';
import { AdminAnalyticsService } from './admin-analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import {
  CancelBetDto,
  CorrectBalanceDto,
  CorrectMatchDto,
} from './dto/admin.dto';
import { UpdateRateLimitCooldownDto } from './dto/rate-limit-config.dto';
import { Bet } from '../bets/entities/bet.entity';
import { User } from '../users/entities/user.entity';
import { Match } from '../matches/entities/match.entity';
import {
  AdminAuditLog,
  AdminActionType,
} from './entities/admin-audit-log.entity';
import { RateLimitInteractionService } from '../rate-limit/rate-limit-interaction.service';

@ApiTags('Administration')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT-auth')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly analyticsService: AdminAnalyticsService,
    private readonly rateLimitService: RateLimitInteractionService,
  ) {}

  /**
   * Cancel a pending bet and refund the stake
   * POST /admin/bets/:id/cancel
   */
  @Post('bets/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel a pending bet and refund stake',
    description:
      'Cancels a pending bet and refunds the stake to the users wallet. Provides an audit trail with reason.',
  })
  @ApiParam({
    name: 'id',
    description: 'Bet UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: CancelBetDto })
  @ApiResponse({
    status: 200,
    description: 'Bet cancelled successfully and stake refunded',
    schema: {
      example: {
        message: 'Bet cancelled successfully and stake refunded',
        bet: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          userId: '456e7890-e12b-34d5-a678-901234567890',
          matchId: '789e0123-e45b-67d8-a901-234567890123',
          stakeAmount: 100.5,
          status: 'cancelled',
          refundAmount: 100.5,
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - bet cannot be cancelled (already settled)',
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
    description: 'Bet not found',
  })
  async cancelBet(
    @Param('id', new ParseUUIDPipe()) betId: string,
    @Body() dto: CancelBetDto,
    @Request() req: Request & { user: User },
  ): Promise<{ message: string; bet: Bet }> {
    const bet = await this.adminService.cancelBet(betId, req.user.id, dto);
    return {
      message: 'Bet cancelled successfully and stake refunded',
      bet,
    };
  }

  /**
   * Correct a user's wallet balance
   * POST /admin/users/:id/balance
   */
  @Post('users/:id/balance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Correct a user wallet balance',
    description:
      'Manually adjusts a users wallet balance with full audit logging. Use for balance corrections and manual payouts.',
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    example: '456e7890-e12b-34d5-a678-901234567890',
  })
  @ApiBody({ type: CorrectBalanceDto })
  @ApiResponse({
    status: 200,
    description: 'Balance corrected successfully',
    schema: {
      example: {
        message: 'Balance corrected successfully',
        user: {
          id: '456e7890-e12b-34d5-a678-901234567890',
          email: 'user@example.com',
          walletBalance: 5500.5,
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid adjustment',
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
    description: 'User not found',
  })
  async correctBalance(
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Body() dto: CorrectBalanceDto,
    @Request() req: Request & { user: User },
  ): Promise<{ message: string; user: User }> {
    const user = await this.adminService.correctBalance(
      userId,
      req.user.id,
      dto,
    );
    return {
      message: 'Balance corrected successfully',
      user,
    };
  }

  /**
   * Correct match details (scores)
   * POST /admin/matches/:id/correct
   */
  @Post('matches/:id/correct')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Correct match details',
    description:
      'Allows administrators to correct match scores and outcomes. This triggers re-calculation of all related bets and settlements.',
  })
  @ApiParam({
    name: 'id',
    description: 'Match UUID',
    example: '789e0123-e45b-67d8-a901-234567890123',
  })
  @ApiBody({ type: CorrectMatchDto })
  @ApiResponse({
    status: 200,
    description: 'Match corrected successfully',
    schema: {
      example: {
        message: 'Match details corrected successfully',
        match: {
          id: '789e0123-e45b-67d8-a901-234567890123',
          homeTeam: 'Manchester United',
          awayTeam: 'Liverpool FC',
          homeScore: 2,
          awayScore: 1,
          outcome: 'home_win',
          status: 'finished',
          corrected: true,
          correctedAt: '2024-01-15T10:30:00Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - match cannot be corrected (not finished or invalid scores)',
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
  async correctMatch(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Body() dto: CorrectMatchDto,
    @Request() req: Request & { user: User },
  ): Promise<{ message: string; match: Match }> {
    const match = await this.adminService.correctMatch(
      matchId,
      req.user.id,
      dto,
    );
    return {
      message: 'Match details corrected successfully',
      match,
    };
  }

  /**
   * Get audit logs with optional filtering
   * GET /admin/audit-logs?actionType=bet_cancelled&page=1&limit=50
   */
  @Get('audit-logs')
  @ApiOperation({
    summary: 'Get admin audit logs',
    description:
      'Retrieves a paginated list of admin action audit logs with optional filtering by action type',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 50)',
    example: 50,
  })
  @ApiQuery({
    name: 'actionType',
    required: false,
    enum: AdminActionType,
    description: 'Filter by action type',
  })
  @ApiResponse({
    status: 200,
    description: 'Audit logs retrieved successfully',
    schema: {
      example: {
        data: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            adminId: 'admin_123',
            actionType: 'bet_cancelled',
            targetType: 'bet',
            targetId: '123e4567-e89b-12d3-a456-426614174000',
            reason: 'User request',
            metadata: { stakeAmount: 100.5 },
            createdAt: '2024-01-15T10:30:00Z',
          },
        ],
        total: 500,
        page: 1,
        limit: 50,
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
  async getAuditLogs(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
    @Query('actionType') actionType?: AdminActionType,
  ): Promise<{
    data: AdminAuditLog[];
    total: number;
    page: number;
    limit: number;
  }> {
    const result = await this.adminService.getAuditLogs(
      page,
      limit,
      actionType,
    );
    return {
      ...result,
      page,
      limit,
    };
  }

  /**
   * Get audit logs for a specific user
   * GET /admin/users/:id/audit-logs
   */
  @Get('users/:id/audit-logs')
  @ApiOperation({
    summary: 'Get user audit logs',
    description:
      'Retrieves all admin actions performed on a specific user (balance changes, cancellations, etc.)',
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    example: '456e7890-e12b-34d5-a678-901234567890',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'User audit logs retrieved successfully',
    schema: {
      example: {
        data: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            adminId: 'admin_123',
            actionType: 'balance_adjustment',
            reason: 'Manual bonus',
            metadata: { amount: 100.5 },
            createdAt: '2024-01-15T10:30:00Z',
          },
        ],
        total: 25,
        page: 1,
        limit: 50,
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
    description: 'User not found',
  })
  async getUserAuditLogs(
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ): Promise<{
    data: AdminAuditLog[];
    total: number;
    page: number;
    limit: number;
  }> {
    const result = await this.adminService.getUserAuditLogs(
      userId,
      page,
      limit,
    );
    return {
      ...result,
      page,
      limit,
    };
  }

  // ------------------------------
  // Analytics Endpoints
  // ------------------------------

  @Get('analytics/users/total')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get total user count',
    description: 'Retrieves the total number of registered users on the platform',
  })
  @ApiResponse({
    status: 200,
    description: 'Total users count retrieved',
    schema: {
      example: {
        total: 15000,
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
  async totalUsers() {
    return { total: await this.analyticsService.getTotalUsers() };
  }

  @Get('analytics/staked/total')
  @ApiOperation({
    summary: 'Get total staked amount',
    description: 'Retrieves the aggregate amount staked across all users',
  })
  @ApiResponse({
    status: 200,
    description: 'Total staked amount retrieved',
    schema: {
      example: {
        total: 2500000.5,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async totalStaked() {
    return { total: await this.analyticsService.getTotalStaked() };
  }

  @Get('analytics/treasury/total')
  @ApiOperation({
    summary: 'Get treasury balance',
    description: 'Retrieves current treasury hold balance',
  })
  @ApiResponse({
    status: 200,
    description: 'Treasury balance retrieved',
    schema: {
      example: {
        total: 1500000.75,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async treasuryBalance() {
    return { total: await this.analyticsService.getTreasuryBalance() };
  }

  @Get('analytics/spin/revenue-payouts')
  @ApiOperation({
    summary: 'Get spin revenue vs payouts',
    description:
      'Retrieves comparison of total revenue from spins vs total payouts (house edge analysis)',
  })
  @ApiResponse({
    status: 200,
    description: 'Spin metrics retrieved',
    schema: {
      example: {
        totalRevenue: 500000.0,
        totalPayouts: 475000.0,
        houseEdge: 5.0,
        netProfit: 25000.0,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async spinRevenueVsPayouts() {
    return await this.analyticsService.getSpinRevenueVsPayouts();
  }

  @Get('analytics/bets/open')
  @ApiOperation({
    summary: 'Get open bets count',
    description: 'Retrieves the current number of pending/unsettled bets',
  })
  @ApiResponse({
    status: 200,
    description: 'Open bets count retrieved',
    schema: {
      example: {
        total: 3420,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async openBets() {
    return { total: await this.analyticsService.getOpenBets() };
  }

  @Get('analytics/users/suspicious')
  @ApiOperation({
    summary: 'Get suspicious users',
    description:
      'Retrieves list of users flagged for suspicious activity (multiple accounts, unusual betting patterns, etc.)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Suspicious users list retrieved',
    schema: {
      example: {
        data: [
          {
            id: '456e7890-e12b-34d5-a678-901234567890',
            email: 'suspicious@example.com',
            reason: 'Multiple accounts from same IP',
            riskScore: 85,
            flaggedAt: '2024-01-15T10:30:00Z',
          },
        ],
        total: 15,
        page: 1,
        limit: 50,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async suspiciousUsers(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    const users = await this.analyticsService.getSuspiciousUsers();
    const start = (page - 1) * limit;
    const end = start + limit;
    return {
      data: users.slice(start, end),
      total: users.length,
      page,
      limit,
    };
  }

  /**
   * Get interaction rate-limit config
   * GET /admin/rate-limit
   */
  @Get('rate-limit')
  @ApiOperation({
    summary: 'Get rate-limit cooldown configuration',
    description: 'Retrieves the current rate-limiting cooldown period in seconds',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration retrieved',
    schema: {
      example: {
        cooldownSeconds: 2,
      },
    },
  })
  async getRateLimitConfig(): Promise<{ cooldownSeconds: number }> {
    const cooldownSeconds = await this.rateLimitService.getCooldownSeconds();
    return { cooldownSeconds };
  }

  /**
   * Update interaction rate-limit cooldown
   * PATCH /admin/rate-limit
   */
  @Patch('rate-limit')
  @ApiOperation({
    summary: 'Update rate-limit cooldown',
    description: 'Updates the cooldown period between user interactions (spins, stakes, etc.)',
  })
  @ApiBody({ type: UpdateRateLimitCooldownDto })
  @ApiResponse({
    status: 200,
    description: 'Cooldown updated successfully',
    schema: {
      example: {
        cooldownSeconds: 3,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid cooldown value',
  })
  async updateRateLimitConfig(
    @Body() dto: UpdateRateLimitCooldownDto,
    @Request() req: Request & { user: User },
  ): Promise<{ cooldownSeconds: number }> {
    return this.rateLimitService.setCooldownSeconds(
      dto.cooldownSeconds,
      req.user?.id ?? req.user?.userId ?? 'admin',
    );
  }
}
