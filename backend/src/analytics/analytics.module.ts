import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { AnalyticsService } from './providers/analytics.service';
import { AnalyticsController } from './analytics.controller';

@Module({
  imports: [
    CacheModule.register({
      ttl: 60, // 60 seconds cache
      max: 100,
    }),
  ],
  providers: [AnalyticsService],
  controllers: [AnalyticsController],
})
export class AnalyticsModule {}
