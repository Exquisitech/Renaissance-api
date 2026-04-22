import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, SelectQueryBuilder } from 'typeorm';
import { AnalyticsEvent, AnalyticsEventType, AnalyticsEventCategory } from '../entities/analytics-event.entity';
import { User } from '../../users/entities/user.entity';

export interface TrackEventDto {
  userId: string;
  eventType: AnalyticsEventType;
  category: AnalyticsEventCategory;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  value?: number;
  currency?: string;
}

export interface AnalyticsQueryDto {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  eventType?: AnalyticsEventType;
  category?: AnalyticsEventCategory;
  limit?: number;
  offset?: number;
}

export interface UserBehaviorMetrics {
  userId: string;
  totalEvents: number;
  eventTypes: Record<string, number>;
  categories: Record<string, number>;
  avgSessionDuration: number;
  lastActivity: Date;
  engagementScore: number;
}

export interface PlatformMetrics {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByCategory: Record<string, number>;
  revenue: number;
  avgRevenuePerUser: number;
  topEvents: Array<{ eventType: string; count: number }>;
}

@Injectable()
export class AnalyticsEventService {
  private readonly logger = new Logger(AnalyticsEventService.name);

  constructor(
    @InjectRepository(AnalyticsEvent)
    private analyticsEventRepository: Repository<AnalyticsEvent>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async trackEvent(eventData: TrackEventDto): Promise<AnalyticsEvent> {
    try {
      const event = this.analyticsEventRepository.create({
        ...eventData,
        value: eventData.value || 0,
        currency: eventData.currency || 'USD',
      });

      return await this.analyticsEventRepository.save(event);
    } catch (error) {
      this.logger.error(`Failed to track event: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getEvents(query: AnalyticsQueryDto): Promise<AnalyticsEvent[]> {
    const qb = this.analyticsEventRepository.createQueryBuilder('event')
      .leftJoinAndSelect('event.user', 'user')
      .orderBy('event.createdAt', 'DESC');

    if (query.startDate && query.endDate) {
      qb.andWhere('event.createdAt BETWEEN :start AND :end', {
        start: query.startDate,
        end: query.endDate,
      });
    }

    if (query.userId) {
      qb.andWhere('event.userId = :userId', { userId: query.userId });
    }

    if (query.eventType) {
      qb.andWhere('event.eventType = :eventType', { eventType: query.eventType });
    }

    if (query.category) {
      qb.andWhere('event.category = :category', { category: query.category });
    }

    if (query.limit) {
      qb.limit(query.limit);
    }

    if (query.offset) {
      qb.offset(query.offset);
    }

    return qb.getMany();
  }

  async getUserBehaviorMetrics(userId: string, days: number = 30): Promise<UserBehaviorMetrics> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const events = await this.analyticsEventRepository.find({
      where: {
        userId,
        createdAt: Between(startDate, new Date()),
      },
    });

    const eventTypes = events.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const categories = events.reduce((acc, event) => {
      acc[event.category] = (acc[event.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate engagement score based on event diversity and frequency
    const uniqueEventTypes = Object.keys(eventTypes).length;
    const totalEvents = events.length;
    const engagementScore = Math.min((uniqueEventTypes * 10) + (totalEvents / days), 100);

    return {
      userId,
      totalEvents,
      eventTypes,
      categories,
      avgSessionDuration: 0, // Would need session tracking
      lastActivity: events.length > 0 ? events[0].createdAt : new Date(),
      engagementScore,
    };
  }

  async getPlatformMetrics(startDate: Date, endDate: Date): Promise<PlatformMetrics> {
    const events = await this.analyticsEventRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
      },
      relations: ['user'],
    });

    const uniqueUsers = new Set(events.map(e => e.userId));
    const totalUsers = await this.userRepository.count();

    const newUsers = await this.userRepository.count({
      where: {
        createdAt: Between(startDate, endDate),
      },
    });

    const eventsByType = events.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const eventsByCategory = events.reduce((acc, event) => {
      acc[event.category] = (acc[event.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const revenue = events.reduce((sum, event) => sum + event.value, 0);
    const avgRevenuePerUser = uniqueUsers.size > 0 ? revenue / uniqueUsers.size : 0;

    const topEvents = Object.entries(eventsByType)
      .map(([eventType, count]) => ({ eventType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalUsers,
      activeUsers: uniqueUsers.size,
      newUsers,
      totalEvents: events.length,
      eventsByType,
      eventsByCategory,
      revenue,
      avgRevenuePerUser,
      topEvents,
    };
  }

  async getUsagePatterns(query: AnalyticsQueryDto): Promise<any> {
    const events = await this.getEvents(query);

    // Group by hour of day
    const hourlyPatterns = events.reduce((acc, event) => {
      const hour = event.createdAt.getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    // Group by day of week
    const weeklyPatterns = events.reduce((acc, event) => {
      const day = event.createdAt.getDay();
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    // Most common event sequences (simplified)
    const eventSequences = events.slice(0, 100).map(e => e.eventType);

    return {
      hourlyPatterns,
      weeklyPatterns,
      eventSequences,
      totalEvents: events.length,
    };
  }
}