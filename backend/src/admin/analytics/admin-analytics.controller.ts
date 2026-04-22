import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AdminAnalyticsService } from './admin-analytics.service';
import { RequireAdminRole } from '../../auth/decorators/admin-roles.decorator';
import { AdminRole } from '../../auth/enums/admin-role.enum';
import { AdminRoleGuard } from '../../auth/guards/admin-role.guard';
import { TimeGranularity } from './entities/admin-analytics.entity';

@Controller('admin/analytics/dashboard')
@UseGuards(AdminRoleGuard)
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AdminAnalyticsService) {}

  @Get('summary')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST)
  async getDashboardSummary() {
    return this.analyticsService.getDashboardSummary();
  }

  @Get('revenue')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST)
  async getRevenue(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('granularity') granularity: TimeGranularity = TimeGranularity.DAILY,
  ) {
    return this.analyticsService.getRevenueAnalytics({ startDate, endDate, granularity });
  }

  @Get('user-activity')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST)
  async getUserActivity(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analyticsService.getUserActivity({ startDate, endDate });
  }

  @Get('bet-volume')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST)
  async getBetVolume(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('granularity') granularity: TimeGranularity = TimeGranularity.DAILY,
  ) {
    return this.analyticsService.getBetVolume({ startDate, endDate, granularity });
  }

  @Get('geographical')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST)
  async getGeographical(
    @Query('limit') limit: number = 20,
    @Query('sortBy') sortBy: 'userCount' | 'revenue' | 'volume' = 'userCount',
  ) {
    return this.analyticsService.getGeographicalStats({ limit, sortBy });
  }

  @Get('trends')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST)
  async getTrends(
    @Query('metricName') metricName: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analyticsService.getTrendAnalysis({ metricName, startDate, endDate });
  }

  @Get('realtime')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST, AdminRole.SUPPORT)
  async getRealTimeMetrics() {
    return this.analyticsService.getRealTimeMetrics();
  }

  @Get('report')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST)
  async generateReport(
    @Query('type') type: 'revenue' | 'user_activity' | 'bet_volume' | 'geographical',
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('format') format: 'json' | 'csv' = 'json',
    @Res() res?: Response,
  ) {
    const data = await this.analyticsService.generateReport({
      type,
      startDate,
      endDate,
      format,
    });

    if (format === 'csv') {
      res?.setHeader('Content-Type', 'text/csv');
      res?.setHeader('Content-Disposition', `attachment; filename=${type}-report.csv`);
      return res?.send(data);
    }

    return res?.json(data);
  }

  @Get('charts/revenue')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST)
  async getRevenueChart(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('granularity') granularity: TimeGranularity = TimeGranularity.DAILY,
  ) {
    const data = await this.analyticsService.getRevenueAnalytics({ startDate, endDate, granularity });

    // Transform for chart display
    return {
      labels: data.map((d) => d.date),
      datasets: [
        {
          label: 'Total Staked',
          data: data.map((d) => d.totalStaked),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
        },
        {
          label: 'Net Revenue',
          data: data.map((d) => d.netRevenue),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
        },
        {
          label: 'Payout',
          data: data.map((d) => d.totalPayout),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
        },
      ],
    };
  }

  @Get('charts/user-activity')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST)
  async getUserActivityChart(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const data = await this.analyticsService.getUserActivity({ startDate, endDate });

    return {
      labels: data.map((d) => d.date),
      datasets: [
        {
          label: 'Active Users',
          data: data.map((d) => d.activeUsers),
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
        },
        {
          label: 'Active Rate %',
          data: data.map((d) => d.activeRate),
          borderColor: '#ec4899',
          backgroundColor: 'rgba(236, 72, 153, 0.1)',
        },
      ],
    };
  }

  @Get('charts/bet-volume')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST)
  async getBetVolumeChart(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('granularity') granularity: TimeGranularity = TimeGranularity.DAILY,
  ) {
    const data = await this.analyticsService.getBetVolume({ startDate, endDate, granularity });

    return {
      labels: data.map((d) => d.date),
      datasets: [
        {
          label: 'Total Volume',
          data: data.map((d) => d.totalVolume),
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.1)',
        },
        {
          label: 'Spin Game Volume',
          data: data.map((d) => d.spinGameVolume),
          borderColor: '#f97316',
          backgroundColor: 'rgba(249, 115, 22, 0.1)',
        },
        {
          label: 'Sports Bet Volume',
          data: data.map((d) => d.sportsBetVolume),
          borderColor: '#84cc16',
          backgroundColor: 'rgba(132, 204, 22, 0.1)',
        },
      ],
    };
  }

  @Get('charts/geographical')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST)
  async getGeographicalChart(
    @Query('limit') limit: number = 10,
  ) {
    const data = await this.analyticsService.getGeographicalStats({ limit, sortBy: 'revenue' });

    return {
      labels: data.map((d) => d.countryName),
      datasets: [
        {
          label: 'User Count',
          data: data.map((d) => d.userCount),
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
        },
        {
          label: 'Revenue',
          data: data.map((d) => d.totalRevenue),
          backgroundColor: 'rgba(16, 185, 129, 0.5)',
        },
      ],
    };
  }
}