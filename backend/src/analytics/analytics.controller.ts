import { Controller, Get, Post, Query, Res, UseGuards, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { Response } from 'express';
import { Parser } from 'json2csv';
import { AnalyticsService } from './providers/analytics.service';
import { AnalyticsEventService } from './providers/analytics-event.service';
import { DateRangeDto } from './dto/date-range.dto';
import { ExportQueryDto } from './dto/export-query.dto';
import { TrackEventDto, AnalyticsQueryDto, UserBehaviorQueryDto } from './dto/analytics.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Analytics')
@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT-auth')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly analyticsEventService: AnalyticsEventService,
  ) {}

  @Get('staked')
  @ApiOperation({
    summary: 'Get total staked analytics',
    description:
      'Retrieves aggregate staking statistics including total staked, by period, and distribution. Supports CSV export.',
  })
  @ApiQuery({ type: DateRangeDto })
  @ApiQuery({ type: ExportQueryDto })
  @ApiResponse({
    status: 200,
    description: 'Staked analytics retrieved successfully',
    schema: {
      example: {
        totalStaked: 2500000.5,
        averageStake: 150.5,
        byPeriod: [
          { period: '2024-01', total: 500000, count: 3320 },
          { period: '2024-02', total: 750000, count: 4150 },
        ],
        byTier: {
          bronze: 500000,
          silver: 800000,
          gold: 700000,
          platinum: 500000,
        },
      },
    },
  })
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
  @ApiOperation({
    summary: 'Get spin revenue analytics',
    description:
      'Retrieves spin-specific revenue metrics including total revenue, payouts, house edge, and outcome distribution',
  })
  @ApiQuery({ type: DateRangeDto })
  @ApiResponse({
    status: 200,
    description: 'Spin analytics retrieved successfully',
    schema: {
      example: {
        totalRevenue: 500000.0,
        totalPayouts: 475000.0,
        houseEdge: 5.0,
        netProfit: 25000.0,
        byOutcome: {
          jackpot: { count: 10, totalPayout: 50000.0 },
          high_win: { count: 250, totalPayout: 125000.0 },
          medium_win: { count: 1000, totalPayout: 150000.0 },
          low_win: { count: 2500, totalPayout: 100000.0 },
          loss: { count: 6240, totalPayout: 0.0 },
        },
        averageDailyRevenue: 8333.33,
      },
    },
  })
  async spinRevenue(@Query() dateRange: DateRangeDto) {
    return this.analyticsService.spinRevenue(dateRange);
  }

  @Get('popular-nfts')
  @ApiOperation({
    summary: 'Get most popular NFTs',
    description:
      'Retrieves the most viewed/popular NFT player cards based on engagement metrics',
  })
  @ApiResponse({
    status: 200,
    description: 'Popular NFTs retrieved successfully',
    schema: {
      example: [
        {
          nftCardId: 'card_123',
          totalViews: 15000,
          totalOffers: 45,
          averagePrice: 500.0,
          highestSale: 1200.0,
        },
      ],
    },
  })
  async mostPopular() {
    return this.analyticsService.mostPopularNFTs();
  }

  @Get('bet-settlement')
  @ApiOperation({
    summary: 'Get bet settlement statistics',
    description:
      'Retrieves statistics about bet settlements including win rates, payout ratios, and settlement times',
  })
  @ApiQuery({ type: DateRangeDto })
  @ApiResponse({
    status: 200,
    description: 'Bet settlement statistics retrieved',
    schema: {
      example: {
        totalSettlements: 15000,
        totalPayout: 1800000.0,
        totalStake: 1500000.0,
        averageSettlementTime: '2.5s',
        winRate: 52.5,
        byOutcome: {
          home_win: { count: 6000, totalPayout: 750000.0 },
          away_win: { count: 5500, totalPayout: 680000.0 },
          draw: { count: 3500, totalPayout: 370000.0 },
        },
      },
    },
  })
  async betStats(@Query() dateRange: DateRangeDto) {
    return this.analyticsService.betSettlementStats(dateRange);
  }

  @Get('user-engagement')
  @ApiOperation({
    summary: 'Get user engagement metrics',
    description:
      'Retrieves metrics about user activity including DAU, MAU, session duration, and retention rates',
  })
  @ApiQuery({ type: DateRangeDto })
  @ApiResponse({
    status: 200,
    description: 'User engagement metrics retrieved',
    schema: {
      example: {
        dau: 2500,
        mau: 15000,
        averageSessionDuration: '15m 30s',
        retention: {
          day1: 65.5,
          day7: 42.3,
          day30: 28.1,
        },
        dailyActiveTrend: [
          { date: '2024-01-15', count: 2500 },
          { date: '2024-01-16', count: 2650 },
        ],
      },
    },
  })
  async userEngagement(@Query() dateRange: DateRangeDto) {
    return this.analyticsService.userEngagementMetrics(dateRange);
  }

  @Get('revenue')
  @ApiOperation({
    summary: 'Get revenue analytics',
    description:
      'Comprehensive revenue breakdown including platform fees, house edge, and revenue by category (bets, spins, etc.)',
  })
  @ApiQuery({ type: DateRangeDto })
  @ApiResponse({
    status: 200,
    description: 'Revenue analytics retrieved',
    schema: {
      example: {
        totalRevenue: 500000.0,
        platformFees: 50000.0,
        houseEdge: 5.0,
        revenueByCategory: {
          bets: 250000.0,
          spins: 150000.0,
          nftTrades: 100000.0,
        },
        dailyBreakdown: [
          { date: '2024-01-15', revenue: 16666.67 },
        ],
      },
    },
  })
  async revenueAnalytics(@Query() dateRange: DateRangeDto) {
    return this.analyticsService.revenueAnalytics(dateRange);
  }

  @Get('performance')
  @ApiOperation({
    summary: 'Get platform performance metrics',
    description:
      'System performance metrics including response times, error rates, and feature usage statistics',
  })
  @ApiQuery({ type: DateRangeDto })
  @ApiResponse({
    status: 200,
    description: 'Performance metrics retrieved',
    schema: {
      example: {
        averageResponseTime: '125ms',
        p95ResponseTime: '250ms',
        errorRate: 0.02,
        requestsPerSecond: 150,
        featureUsage: {
          spins: { count: 15000, uniqueUsers: 2500 },
          bets: { count: 8000, uniqueUsers: 3200 },
          predictions: { count: 4500, uniqueUsers: 2100 },
        },
      },
    },
  })
  async performanceMetrics(@Query() dateRange: DateRangeDto) {
    return this.analyticsService.performanceMetrics(dateRange);
  }

  @Post('events/track')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Track custom analytics event',
    description: 'Records a custom analytics event for user behavior tracking',
  })
  @ApiBody({ type: TrackEventDto })
  @ApiResponse({
    status: 201,
    description: 'Event tracked successfully',
    schema: {
      example: {
        success: true,
        eventId: 'event_123',
        timestamp: '2024-01-15T10:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid event data',
  })
  async trackEvent(@Body() trackEventDto: TrackEventDto) {
    return this.analyticsEventService.trackEvent(trackEventDto);
  }

  @Get('events')
  @ApiOperation({
    summary: 'Get analytics events',
    description:
      'Retrieves analytics events with optional filtering by type, user, and date range',
  })
  @ApiQuery({ type: AnalyticsQueryDto })
  @ApiResponse({
    status: 200,
    description: 'Events retrieved successfully',
    schema: {
      example: {
        data: [
          {
            id: 'event_123',
            userId: '456e7890-e12b-34d5-a678-901234567890',
            eventType: 'spin_executed',
            properties: { outcome: 'high_win', stake: 10.0 },
            createdAt: '2024-01-15T10:30:00Z',
          },
        ],
        total: 5000,
        page: 1,
        limit: 100,
      },
    },
  })
  async getEvents(@Query() query: AnalyticsQueryDto) {
    return this.analyticsEventService.getEvents({
      ...query,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });
  }

  @Get('events/usage-patterns')
  @ApiOperation({
    summary: 'Get usage patterns',
    description:
      'Analyzes user behavior patterns including peak usage times, feature adoption, and session patterns',
  })
  @ApiQuery({ type: AnalyticsQueryDto })
  @ApiResponse({
    status: 200,
    description: 'Usage patterns retrieved',
    schema: {
      example: {
        peakHours: [
          { hour: 20, count: 2500 },
          { hour: 21, count: 2800 },
          { hour: 22, count: 2200 },
        ],
        featureAdoption: {
          spins: 85.5,
          betting: 72.3,
          predictions: 45.1,
        },
        averageSessionLength: '18m 30s',
      },
    },
  })
  async getUsagePatterns(@Query() query: AnalyticsQueryDto) {
    return this.analyticsEventService.getUsagePatterns({
      ...query,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });
  }

  @Get('users/:userId/behavior')
  @ApiOperation({
    summary: 'Get user behavior metrics',
    description:
      'Retrieves detailed behavior metrics for a specific user including activity patterns and preferences',
  })
  @ApiParam({
    name: 'userId',
    description: 'User UUID',
    example: '456e7890-e12b-34d5-a678-901234567890',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of days to analyze',
    example: 30,
  })
  @ApiResponse({
    status: 200,
    description: 'User behavior metrics retrieved',
    schema: {
      example: {
        userId: '456e7890-e12b-34d5-a678-901234567890',
        period: '30 days',
        totalActions: 1250,
        favoriteFeature: 'spins',
        averageSessionDuration: '15m',
        activityPattern: [
          { dayOfWeek: 1, count: 200 },
          { dayOfWeek: 2, count: 180 },
        ],
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async getUserBehavior(
    @Param('userId') userId: string,
    @Query() query: UserBehaviorQueryDto,
  ) {
    return this.analyticsEventService.getUserBehaviorMetrics(userId, query.days);
  }

  @Get('platform/metrics')
  @ApiOperation({
    summary: 'Get platform-wide metrics',
    description:
      'Aggregate platform health and usage metrics including growth, engagement, and transaction statistics',
  })
  @ApiQuery({ type: DateRangeDto })
  @ApiResponse({
    status: 200,
    description: 'Platform metrics retrieved',
    schema: {
      example: {
        totalUsers: 15000,
        activeUsers: 2500,
        newUsers30d: 500,
        totalTransactions: 250000,
        totalVolume: 5000000.0,
        platformHealth: {
          uptime: 99.9,
          averageLatency: '125ms',
          errorRate: 0.02,
        },
      },
    },
  })
  async getPlatformMetrics(@Query() dateRange: DateRangeDto) {
    const startDate = new Date(dateRange.startDate || Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = new Date(dateRange.endDate || new Date());
    return this.analyticsEventService.getPlatformMetrics(startDate, endDate);
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'Get admin dashboard metrics',
    description:
      'Retrieves key performance indicators for admin dashboard including revenue, users, bets, and platform health',
  })
  @ApiQuery({ type: DateRangeDto })
  @ApiResponse({
    status: 200,
    description: 'Dashboard metrics retrieved',
    schema: {
      example: {
        overview: {
          totalUsers: 15000,
          activeUsers: 2500,
          totalRevenue: 500000.0,
          openBets: 3420,
        },
        revenueTrend: [
          { date: '2024-01-15', amount: 16666.67 },
        ],
        recentTransactions: [
          { type: 'bet_win', amount: 250.0, timestamp: '2024-01-15T10:30:00Z' },
        ],
      },
    },
  })
  async getDashboardMetrics(@Query() dateRange: DateRangeDto) {
    return this.analyticsService.getDashboardMetrics(dateRange);
  }
}
