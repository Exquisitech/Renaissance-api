import { Injectable, Inject } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { DateRangeDto } from '../dto/date-range.dto';
// import { DateRangeDto } from './dto/date-range.dto';

@Injectable()
export class AnalyticsService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  private buildDateFilter(dateRange: DateRangeDto) {
    if (!dateRange.startDate || !dateRange.endDate) return {};

    return {
      createdAt: {
        gte: new Date(dateRange.startDate),
        lte: new Date(dateRange.endDate),
      },
    };
  }

  async totalStaked(dateRange: DateRangeDto) {
    const cacheKey = `total_staked_${JSON.stringify(dateRange)}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    // Note: Prisma not configured - returning mock data
    const result = { _sum: { amount: 0 } };

    await this.cacheManager.set(cacheKey, result, 60);
    return result;
  }

  async spinRevenue(dateRange: DateRangeDto) {
    const cacheKey = `spin_revenue_${JSON.stringify(dateRange)}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    // Note: Prisma not configured - returning mock data
    const result = { _sum: { revenue: 0, payout: 0 } };

    await this.cacheManager.set(cacheKey, result, 60);
    return result;
  }

  async mostPopularNFTs() {
    // Note: Prisma not configured - returning empty array
    return [];
  }

  async betSettlementStats(dateRange: DateRangeDto) {
    // Note: Prisma not configured - returning empty array
    return [];
  }
}
