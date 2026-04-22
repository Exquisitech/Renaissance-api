import { IsOptional, IsEnum, IsUUID, IsNumber, Min, Max } from 'class-validator';
import { AnalyticsEventType, AnalyticsEventCategory } from '../entities/analytics-event.entity';

export class TrackEventDto {
  @IsUUID()
  userId: string;

  @IsEnum(AnalyticsEventType)
  eventType: AnalyticsEventType;

  @IsEnum(AnalyticsEventCategory)
  category: AnalyticsEventCategory;

  @IsOptional()
  metadata?: Record<string, any>;

  @IsOptional()
  ipAddress?: string;

  @IsOptional()
  userAgent?: string;

  @IsOptional()
  sessionId?: string;

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  currency?: string;
}

export class AnalyticsQueryDto {
  @IsOptional()
  startDate?: string;

  @IsOptional()
  endDate?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsEnum(AnalyticsEventType)
  eventType?: AnalyticsEventType;

  @IsOptional()
  @IsEnum(AnalyticsEventCategory)
  category?: AnalyticsEventCategory;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;
}

export class UserBehaviorQueryDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  days?: number;
}

export class PerformanceMetricsDto {
  @IsOptional()
  startDate?: string;

  @IsOptional()
  endDate?: string;
}