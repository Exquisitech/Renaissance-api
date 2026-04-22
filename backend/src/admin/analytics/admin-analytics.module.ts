import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsService } from './admin-analytics.service';
import {
  AdminAnalyticsMetric,
  AdminRevenueAnalytics,
  AdminUserActivity,
  AdminGeographicalStats,
  AdminTrendAnalysis,
  AdminBetVolume,
  AdminRealTimeMetrics,
} from './entities/admin-analytics.entity';
import { User } from '../users/entities/user.entity';
import { Bet } from '../bets/entities/bet.entity';
import { Transaction } from '../transactions/entities/transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdminAnalyticsMetric,
      AdminRevenueAnalytics,
      AdminUserActivity,
      AdminGeographicalStats,
      AdminTrendAnalysis,
      AdminBetVolume,
      AdminRealTimeMetrics,
      User,
      Bet,
      Transaction,
    ]),
  ],
  controllers: [AdminAnalyticsController],
  providers: [AdminAnalyticsService],
  exports: [AdminAnalyticsService],
})
export class AdminAnalyticsModule {}