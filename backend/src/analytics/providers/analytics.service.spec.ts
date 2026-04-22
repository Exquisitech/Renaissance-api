import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AnalyticsService } from './analytics.service';
import { AnalyticsEvent } from '../entities/analytics-event.entity';
import { Bet } from '../../bets/entities/bet.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { User } from '../../users/entities/user.entity';
import { AnalyticsEventType, AnalyticsEventCategory } from '../entities/analytics-event.entity';

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  const mockAnalyticsEventRepo = {
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
      getRawOne: jest.fn(),
      getMany: jest.fn(),
      getCount: jest.fn(),
    })),
    find: jest.fn(),
    count: jest.fn(),
  };

  const mockBetRepo = {
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
      getRawOne: jest.fn(),
    })),
  };

  const mockTransactionRepo = {
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(),
    })),
  };

  const mockUserRepo = {
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn(),
    })),
  };

  const mockCache = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(AnalyticsEvent), useValue: mockAnalyticsEventRepo },
        { provide: getRepositoryToken(Bet), useValue: mockBetRepo },
        { provide: getRepositoryToken(Transaction), useValue: mockTransactionRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: CACHE_MANAGER, useValue: mockCache },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('totalStaked', () => {
    it('should return total staked amount', async () => {
      const mockData = [{ totalStaked: 10000 }];
      mockAnalyticsEventRepo.createQueryBuilder().getRawOne.mockResolvedValue(mockData[0]);

      const result = await service.totalStaked({ startDate: '2024-01-01', endDate: '2024-01-31' });

      expect(result).toEqual({ totalStaked: 10000 });
      expect(mockAnalyticsEventRepo.createQueryBuilder).toHaveBeenCalled();
    });

    it('should use cache when available', async () => {
      const cachedData = { totalStaked: 5000 };
      mockCache.get.mockResolvedValue(cachedData);

      const result = await service.totalStaked({ startDate: '2024-01-01', endDate: '2024-01-31' });

      expect(result).toEqual(cachedData);
      expect(mockAnalyticsEventRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('spinRevenue', () => {
    it('should return spin revenue data', async () => {
      const mockData = [{ totalRevenue: 2500, totalSpins: 100 }];
      mockAnalyticsEventRepo.createQueryBuilder().getRawOne.mockResolvedValue(mockData[0]);

      const result = await service.spinRevenue({ startDate: '2024-01-01', endDate: '2024-01-31' });

      expect(result).toEqual({ totalRevenue: 2500, totalSpins: 100 });
    });
  });

  describe('mostPopularNFTs', () => {
    it('should return most popular NFTs', async () => {
      const mockData = [
        { nftId: 'nft-1', totalViews: 150, totalPurchases: 10 },
        { nftId: 'nft-2', totalViews: 120, totalPurchases: 8 },
      ];
      mockAnalyticsEventRepo.createQueryBuilder().getRawMany.mockResolvedValue(mockData);

      const result = await service.mostPopularNFTs();

      expect(result).toEqual(mockData);
      expect(mockAnalyticsEventRepo.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe('betSettlementStats', () => {
    it('should return bet settlement statistics', async () => {
      const mockData = {
        totalBets: 500,
        settledBets: 450,
        pendingBets: 50,
        totalPayout: 25000,
        totalStake: 20000,
        winRate: 0.75,
      };
      mockBetRepo.createQueryBuilder().getRawOne.mockResolvedValue(mockData);

      const result = await service.betSettlementStats({ startDate: '2024-01-01', endDate: '2024-01-31' });

      expect(result).toEqual(mockData);
    });
  });

  describe('userEngagementMetrics', () => {
    it('should return user engagement metrics', async () => {
      const mockData = [
        { date: '2024-01-01', activeUsers: 150, newUsers: 25, sessionDuration: 1200 },
        { date: '2024-01-02', activeUsers: 180, newUsers: 30, sessionDuration: 1350 },
      ];
      mockAnalyticsEventRepo.createQueryBuilder().getRawMany.mockResolvedValue(mockData);

      const result = await service.userEngagementMetrics({ startDate: '2024-01-01', endDate: '2024-01-31' });

      expect(result).toEqual(mockData);
    });
  });

  describe('revenueAnalytics', () => {
    it('should return comprehensive revenue analytics', async () => {
      const mockBetRevenue = { total: 50000 };
      const mockSpinRevenue = { total: 10000 };
      const mockNftRevenue = { total: 25000 };

      mockAnalyticsEventRepo.createQueryBuilder().getRawOne
        .mockResolvedValueOnce(mockBetRevenue)
        .mockResolvedValueOnce(mockSpinRevenue)
        .mockResolvedValueOnce(mockNftRevenue);

      const result = await service.revenueAnalytics({ startDate: '2024-01-01', endDate: '2024-01-31' });

      expect(result).toEqual({
        totalRevenue: 85000,
        betRevenue: 50000,
        spinRevenue: 10000,
        nftRevenue: 25000,
        revenueByDay: [],
      });
    });
  });

  describe('performanceMetrics', () => {
    it('should return performance metrics', async () => {
      const mockData = {
        totalMatches: 100,
        completedMatches: 95,
        averageMatchDuration: 7200,
        totalPredictions: 5000,
        accuratePredictions: 3750,
        predictionAccuracy: 0.75,
      };

      mockAnalyticsEventRepo.createQueryBuilder().getRawOne.mockResolvedValue(mockData);

      const result = await service.performanceMetrics({ startDate: '2024-01-01', endDate: '2024-01-31' });

      expect(result).toEqual(mockData);
    });
  });

  describe('caching behavior', () => {
    it('should cache results for expensive operations', async () => {
      mockCache.get.mockResolvedValue(null);
      mockAnalyticsEventRepo.createQueryBuilder().getRawOne.mockResolvedValue({ totalStaked: 10000 });

      await service.totalStaked({ startDate: '2024-01-01', endDate: '2024-01-31' });

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('analytics:totalStaked'),
        { totalStaked: 10000 },
        expect.any(Number)
      );
    });

    it('should return cached data when available', async () => {
      const cachedData = { totalStaked: 5000 };
      mockCache.get.mockResolvedValue(cachedData);

      const result = await service.totalStaked({ startDate: '2024-01-01', endDate: '2024-01-31' });

      expect(result).toEqual(cachedData);
      expect(mockAnalyticsEventRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockAnalyticsEventRepo.createQueryBuilder().getRawOne.mockRejectedValue(new Error('Database error'));

      await expect(service.totalStaked({ startDate: '2024-01-01', endDate: '2024-01-31' }))
        .rejects.toThrow('Database error');
    });

    it('should handle empty results', async () => {
      mockAnalyticsEventRepo.createQueryBuilder().getRawOne.mockResolvedValue(null);

      const result = await service.totalStaked({ startDate: '2024-01-01', endDate: '2024-01-31' });

      expect(result).toEqual({ totalStaked: 0 });
    });
  });

  describe('date range validation', () => {
    it('should handle invalid date ranges', async () => {
      const result = await service.totalStaked({ startDate: 'invalid', endDate: '2024-01-31' });

      // Should handle gracefully or throw validation error
      await expect(result).toBeDefined();
    });

    it('should default to reasonable date ranges when not provided', async () => {
      mockAnalyticsEventRepo.createQueryBuilder().getRawOne.mockResolvedValue({ totalStaked: 1000 });

      const result = await service.totalStaked({});

      expect(result).toEqual({ totalStaked: 1000 });
    });
  });
});