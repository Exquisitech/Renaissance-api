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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
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

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
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
  async cancelBet(
    @Param('id', new ParseUUIDPipe()) betId: string,
    @Body() dto: CancelBetDto,
    @Request() req: any,
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
  async correctBalance(
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Body() dto: CorrectBalanceDto,
    @Request() req: any,
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
  async correctMatch(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Body() dto: CorrectMatchDto,
    @Request() req: any,
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
  // New Analytics Endpoints (#147)
  // ------------------------------

  // ------------------------------
  // New Analytics Endpoints (#147)
  // ------------------------------

  @Get('analytics/users/total')
  async totalUsers() {
    return { total: await this.analyticsService.getTotalUsers() };
  }

  @Get('analytics/staked/total')
  async totalStaked() {
    return { total: await this.analyticsService.getTotalStaked() };
  }

  @Get('analytics/treasury/total')
  async treasuryBalance() {
    return { total: await this.analyticsService.getTreasuryBalance() };
  }

  @Get('analytics/spin/revenue-payouts')
  async spinRevenueVsPayouts() {
    return await this.analyticsService.getSpinRevenueVsPayouts();
  }

  @Get('analytics/bets/open')
  async openBets() {
    return { total: await this.analyticsService.getOpenBets() };
  }

  @Get('analytics/users/suspicious')
  async suspiciousUsers(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    const users = await this.analyticsService.getSuspiciousUsers();
    // Simple pagination for large result sets
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
   * Get interaction rate-limit config (cooldown between spin/stake per user)
   * GET /admin/rate-limit
   */
  @Get('rate-limit')
  @ApiOperation({ summary: 'Get rate-limit cooldown config' })
  @ApiResponse({ status: 200, description: 'Current cooldown in seconds' })
  async getRateLimitConfig(): Promise<{ cooldownSeconds: number }> {
    const cooldownSeconds = await this.rateLimitService.getCooldownSeconds();
    return { cooldownSeconds };
  }

  /**
   * Update interaction rate-limit cooldown (admin-configurable)
   * PATCH /admin/rate-limit
   */
  @Patch('rate-limit')
  @ApiOperation({ summary: 'Update rate-limit cooldown (seconds)' })
  @ApiBody({ type: UpdateRateLimitCooldownDto })
  @ApiResponse({ status: 200, description: 'Cooldown updated' })
  async updateRateLimitConfig(
    @Body() dto: UpdateRateLimitCooldownDto,
    @Request() req: any,
  ): Promise<{ cooldownSeconds: number }> {
    return this.rateLimitService.setCooldownSeconds(
      dto.cooldownSeconds,
      req.user?.id ?? req.user?.userId ?? 'admin',
    );
  }
}
