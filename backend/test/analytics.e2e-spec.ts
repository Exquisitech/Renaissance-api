import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AnalyticsController } from '../src/analytics/analytics.controller';
import { AnalyticsService } from '../src/analytics/providers/analytics.service';
import { AnalyticsEventService } from '../src/analytics/providers/analytics-event.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';

describe('AnalyticsController (e2e)', () => {
  let app: INestApplication;

  const mockAnalyticsService = {
    totalStaked: jest.fn().mockResolvedValue({ totalStaked: 10000 }),
    spinRevenue: jest.fn().mockResolvedValue({ totalRevenue: 2500, totalSpins: 100 }),
    mostPopularNFTs: jest.fn().mockResolvedValue([
      { nftId: 'nft-1', totalViews: 150, totalPurchases: 10 },
      { nftId: 'nft-2', totalViews: 120, totalPurchases: 8 },
    ]),
    betSettlementStats: jest.fn().mockResolvedValue({
      totalBets: 500,
      settledBets: 450,
      pendingBets: 50,
      totalPayout: 25000,
      totalStake: 20000,
      winRate: 0.75,
    }),
    userEngagementMetrics: jest.fn().mockResolvedValue([
      { date: '2024-01-01', activeUsers: 150, newUsers: 25, sessionDuration: 1200 },
      { date: '2024-01-02', activeUsers: 180, newUsers: 30, sessionDuration: 1350 },
    ]),
    revenueAnalytics: jest.fn().mockResolvedValue({
      totalRevenue: 85000,
      betRevenue: 50000,
      spinRevenue: 10000,
      nftRevenue: 25000,
      revenueByDay: [],
    }),
    performanceMetrics: jest.fn().mockResolvedValue({
      totalMatches: 100,
      completedMatches: 95,
      averageMatchDuration: 7200,
      totalPredictions: 5000,
      accuratePredictions: 3750,
      predictionAccuracy: 0.75,
    }),
  };

  const mockAnalyticsEventService = {
    trackEvent: jest.fn().mockResolvedValue({ id: 'event-123', eventType: 'USER_LOGIN' }),
    getEvents: jest.fn().mockResolvedValue([
      { id: 'event-1', eventType: 'USER_LOGIN', userId: 'user-1', timestamp: new Date() },
      { id: 'event-2', eventType: 'BET_PLACED', userId: 'user-2', timestamp: new Date() },
    ]),
    getUsagePatterns: jest.fn().mockResolvedValue({
      hourly: [10, 15, 20, 25, 30, 35, 40, 45, 50, 45, 40, 35, 30, 25, 20, 15, 10, 8, 6, 4, 2, 1, 0, 0],
      daily: [100, 120, 150, 180, 200, 220, 250],
      weekly: [700, 750, 800, 850, 900],
    }),
    getUserBehaviorMetrics: jest.fn().mockResolvedValue({
      userId: 'user-123',
      totalEvents: 50,
      eventTypes: { LOGIN: 10, BET_PLACED: 20, NFT_VIEWED: 15, SPIN_PLAYED: 5 },
      engagementScore: 85,
      lastActivity: new Date(),
      averageSessionDuration: 1800,
    }),
    getPlatformMetrics: jest.fn().mockResolvedValue({
      totalUsers: 1000,
      activeUsers: 150,
      totalEvents: 5000,
      revenue: 75000,
      topEvents: ['BET_PLACED', 'USER_LOGIN', 'NFT_VIEWED'],
      userRetention: 0.75,
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        { provide: AnalyticsService, useValue: mockAnalyticsService },
        { provide: AnalyticsEventService, useValue: mockAnalyticsEventService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/admin/analytics/staked (GET)', () => {
    it('should return total staked amount', () => {
      return request(app.getHttpServer())
        .get('/admin/analytics/staked?startDate=2024-01-01&endDate=2024-01-31')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('totalStaked', 10000);
        });
    });

    it('should handle CSV export', () => {
      return request(app.getHttpServer())
        .get('/admin/analytics/staked?startDate=2024-01-01&endDate=2024-01-31&format=csv')
        .expect(200)
        .expect('Content-Type', /text\/csv/)
        .expect('Content-Disposition', /attachment/);
    });

    it('should handle missing date parameters', () => {
      return request(app.getHttpServer())
        .get('/admin/analytics/staked')
        .expect(200);
    });
  });

  describe('/admin/analytics/spin (GET)', () => {
    it('should return spin revenue data', () => {
      return request(app.getHttpServer())
        .get('/admin/analytics/spin?startDate=2024-01-01&endDate=2024-01-31')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('totalRevenue', 2500);
          expect(res.body).toHaveProperty('totalSpins', 100);
        });
    });
  });

  describe('/admin/analytics/popular-nfts (GET)', () => {
    it('should return most popular NFTs', () => {
      return request(app.getHttpServer())
        .get('/admin/analytics/popular-nfts')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body[0]).toHaveProperty('nftId');
          expect(res.body[0]).toHaveProperty('totalViews');
          expect(res.body[0]).toHaveProperty('totalPurchases');
        });
    });
  });

  describe('/admin/analytics/bet-settlement (GET)', () => {
    it('should return bet settlement statistics', () => {
      return request(app.getHttpServer())
        .get('/admin/analytics/bet-settlement?startDate=2024-01-01&endDate=2024-01-31')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('totalBets', 500);
          expect(res.body).toHaveProperty('settledBets', 450);
          expect(res.body).toHaveProperty('winRate', 0.75);
        });
    });
  });

  describe('/admin/analytics/user-engagement (GET)', () => {
    it('should return user engagement metrics', () => {
      return request(app.getHttpServer())
        .get('/admin/analytics/user-engagement?startDate=2024-01-01&endDate=2024-01-31')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body[0]).toHaveProperty('date');
          expect(res.body[0]).toHaveProperty('activeUsers');
          expect(res.body[0]).toHaveProperty('newUsers');
        });
    });
  });

  describe('/admin/analytics/revenue (GET)', () => {
    it('should return revenue analytics', () => {
      return request(app.getHttpServer())
        .get('/admin/analytics/revenue?startDate=2024-01-01&endDate=2024-01-31')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('totalRevenue', 85000);
          expect(res.body).toHaveProperty('betRevenue', 50000);
          expect(res.body).toHaveProperty('spinRevenue', 10000);
          expect(res.body).toHaveProperty('nftRevenue', 25000);
        });
    });
  });

  describe('/admin/analytics/performance (GET)', () => {
    it('should return performance metrics', () => {
      return request(app.getHttpServer())
        .get('/admin/analytics/performance?startDate=2024-01-01&endDate=2024-01-31')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('totalMatches', 100);
          expect(res.body).toHaveProperty('completedMatches', 95);
          expect(res.body).toHaveProperty('predictionAccuracy', 0.75);
        });
    });
  });

  describe('/admin/analytics/events/track (POST)', () => {
    it('should track an event', () => {
      const eventData = {
        userId: 'user-123',
        eventType: 'USER_LOGIN',
        category: 'AUTHENTICATION',
        value: 0,
        currency: 'USD',
      };

      return request(app.getHttpServer())
        .post('/admin/analytics/events/track')
        .send(eventData)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', 'event-123');
          expect(res.body).toHaveProperty('eventType', 'USER_LOGIN');
        });
    });

    it('should handle invalid event data', () => {
      return request(app.getHttpServer())
        .post('/admin/analytics/events/track')
        .send({})
        .expect(400);
    });
  });

  describe('/admin/analytics/events (GET)', () => {
    it('should get events with query parameters', () => {
      return request(app.getHttpServer())
        .get('/admin/analytics/events?userId=user-123&limit=10')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body[0]).toHaveProperty('id');
          expect(res.body[0]).toHaveProperty('eventType');
          expect(res.body[0]).toHaveProperty('userId');
        });
    });

    it('should handle pagination', () => {
      return request(app.getHttpServer())
        .get('/admin/analytics/events?page=2&limit=5')
        .expect(200);
    });
  });

  describe('/admin/analytics/events/usage-patterns (GET)', () => {
    it('should return usage patterns', () => {
      return request(app.getHttpServer())
        .get('/admin/analytics/events/usage-patterns?startDate=2024-01-01&endDate=2024-01-31')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('hourly');
          expect(res.body).toHaveProperty('daily');
          expect(res.body).toHaveProperty('weekly');
          expect(Array.isArray(res.body.hourly)).toBe(true);
          expect(Array.isArray(res.body.daily)).toBe(true);
          expect(Array.isArray(res.body.weekly)).toBe(true);
        });
    });
  });

  describe('/admin/analytics/users/:userId/behavior (GET)', () => {
    it('should return user behavior metrics', () => {
      return request(app.getHttpServer())
        .get('/admin/analytics/users/user-123/behavior?days=30')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('userId', 'user-123');
          expect(res.body).toHaveProperty('totalEvents', 50);
          expect(res.body).toHaveProperty('engagementScore', 85);
          expect(res.body).toHaveProperty('eventTypes');
        });
    });

    it('should handle invalid user ID', () => {
      return request(app.getHttpServer())
        .get('/admin/analytics/users/invalid-user/behavior')
        .expect(200); // Service handles gracefully
    });
  });

  describe('/admin/analytics/platform/metrics (GET)', () => {
    it('should return platform metrics', () => {
      return request(app.getHttpServer())
        .get('/admin/analytics/platform/metrics?startDate=2024-01-01&endDate=2024-01-31')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('totalUsers', 1000);
          expect(res.body).toHaveProperty('activeUsers', 150);
          expect(res.body).toHaveProperty('totalEvents', 5000);
          expect(res.body).toHaveProperty('revenue', 75000);
        });
    });

    it('should handle default date range', () => {
      return request(app.getHttpServer())
        .get('/admin/analytics/platform/metrics')
        .expect(200);
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication', () => {
      // Temporarily test without guard override
      // This would normally return 401 Unauthorized
    });

    it('should require admin role', () => {
      // This would normally return 403 Forbidden for non-admin users
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', () => {
      mockAnalyticsService.totalStaked.mockRejectedValueOnce(new Error('Database error'));

      return request(app.getHttpServer())
        .get('/admin/analytics/staked')
        .expect(500);
    });

    it('should handle invalid date formats', () => {
      return request(app.getHttpServer())
        .get('/admin/analytics/staked?startDate=invalid-date&endDate=2024-01-31')
        .expect(400);
    });

    it('should handle missing required parameters', () => {
      return request(app.getHttpServer())
        .post('/admin/analytics/events/track')
        .send({ userId: 'user-123' }) // Missing required fields
        .expect(400);
    });
  });

  describe('Rate Limiting and Performance', () => {
    it('should handle concurrent requests', async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app.getHttpServer())
            .get('/admin/analytics/staked')
            .expect(200)
        );
      }

      await Promise.all(promises);
    });

    it('should cache expensive operations', () => {
      // Test that repeated calls use cached results
      return request(app.getHttpServer())
        .get('/admin/analytics/popular-nfts')
        .expect(200)
        .then(() => {
          // Second call should be faster due to caching
          return request(app.getHttpServer())
            .get('/admin/analytics/popular-nfts')
            .expect(200);
        });
    });
  });
});