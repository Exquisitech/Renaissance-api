import { Controller, Get, Post, Query, Res, UseGuards, Body, Param } from '@nestjs/common';
import { AnalyticsService } from './providers/analytics.service';
import { AnalyticsEventService } from './providers/analytics-event.service';
import { DateRangeDto } from './dto/date-range.dto';
import { ExportQueryDto } from './dto/export-query.dto';
import { TrackEventDto, AnalyticsQueryDto, UserBehaviorQueryDto } from './dto/analytics.dto';
import type { Response } from 'express';
import { Parser } from 'json2csv';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly analyticsEventService: AnalyticsEventService,
  ) {}

  @Get('staked')
  async totalStaked(
    @Query() dateRange: DateRangeDto,
    @Query() exportQuery: ExportQueryDto,
    @Res() res: Response,
  ) {
    const data = await this.analyticsService.totalStaked(dateRange);

    if (exportQuery.format === 'csv') {
      const parser = new Parser();
      const csv = parser.parse([data]);
      res.header('Content-Type', 'text/csv');
      res.attachment('total-staked.csv');
      return res.send(csv);
    }

    return res.json(data);
  }

  @Get('spin')
  async spinRevenue(@Query() dateRange: DateRangeDto) {
    return this.analyticsService.spinRevenue(dateRange);
  }

  @Get('popular-nfts')
  async mostPopular() {
    return this.analyticsService.mostPopularNFTs();
  }

  @Get('bet-settlement')
  async betStats(@Query() dateRange: DateRangeDto) {
    return this.analyticsService.betSettlementStats(dateRange);
  }

  @Get('user-engagement')
  async userEngagement(@Query() dateRange: DateRangeDto) {
    return this.analyticsService.userEngagementMetrics(dateRange);
  }

  @Get('revenue')
  async revenueAnalytics(@Query() dateRange: DateRangeDto) {
    return this.analyticsService.revenueAnalytics(dateRange);
  }

  @Get('performance')
  async performanceMetrics(@Query() dateRange: DateRangeDto) {
    return this.analyticsService.performanceMetrics(dateRange);
  }

  @Post('events/track')
  async trackEvent(@Body() trackEventDto: TrackEventDto) {
    return this.analyticsEventService.trackEvent(trackEventDto);
  }

  @Get('events')
  async getEvents(@Query() query: AnalyticsQueryDto) {
    return this.analyticsEventService.getEvents({
      ...query,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });
  }

  @Get('events/usage-patterns')
  async getUsagePatterns(@Query() query: AnalyticsQueryDto) {
    return this.analyticsEventService.getUsagePatterns({
      ...query,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });
  }

  @Get('users/:userId/behavior')
  async getUserBehavior(
    @Param('userId') userId: string,
    @Query() query: UserBehaviorQueryDto,
  ) {
    return this.analyticsEventService.getUserBehaviorMetrics(userId, query.days);
  }

  @Get('platform/metrics')
  async getPlatformMetrics(@Query() dateRange: DateRangeDto) {
    const startDate = new Date(dateRange.startDate || Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = new Date(dateRange.endDate || new Date());
    return this.analyticsEventService.getPlatformMetrics(startDate, endDate);
  }

  @Get('dashboard')
  async getDashboardMetrics(@Query() dateRange: DateRangeDto) {
    return this.analyticsService.getDashboardMetrics(dateRange);
  }
}
