import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnalyticsEventService } from '../providers/analytics-event.service';
import { AnalyticsEvent } from '../entities/analytics-event.entity';
import { User } from '../../users/entities/user.entity';
import { AnalyticsEventType, AnalyticsEventCategory } from '../entities/analytics-event.entity';

describe('AnalyticsEventService', () => {
  let service: AnalyticsEventService;

  const mockEventRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  const mockUserRepo = {
    count: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsEventService,
        { provide: getRepositoryToken(AnalyticsEvent), useValue: mockEventRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
      ],
    }).compile();

    service = module.get<AnalyticsEventService>(AnalyticsEventService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should track an event', async () => {
    const eventData = {
      userId: 'user-123',
      eventType: AnalyticsEventType.USER_LOGIN,
      category: AnalyticsEventCategory.AUTHENTICATION,
      value: 0,
      currency: 'USD',
    };

    const mockEvent = { id: 'event-123', ...eventData };
    mockEventRepo.create.mockReturnValue(mockEvent);
    mockEventRepo.save.mockResolvedValue(mockEvent);

    const result = await service.trackEvent(eventData);
    expect(result).toEqual(mockEvent);
    expect(mockEventRepo.create).toHaveBeenCalledWith(eventData);
    expect(mockEventRepo.save).toHaveBeenCalledWith(mockEvent);
  });

  it('should get platform metrics', async () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');

    const mockEvents = [
      {
        userId: 'user1',
        eventType: AnalyticsEventType.USER_LOGIN,
        category: AnalyticsEventCategory.AUTHENTICATION,
        value: 10,
        createdAt: new Date('2024-01-15'),
      },
      {
        userId: 'user2',
        eventType: AnalyticsEventType.BET_PLACED,
        category: AnalyticsEventCategory.GAMBLING,
        value: 50,
        createdAt: new Date('2024-01-20'),
      },
    ];

    mockEventRepo.find.mockResolvedValue(mockEvents);
    mockUserRepo.count.mockResolvedValue(100);

    const metrics = await service.getPlatformMetrics(startDate, endDate);

    expect(metrics.totalUsers).toBe(100);
    expect(metrics.activeUsers).toBe(2);
    expect(metrics.totalEvents).toBe(2);
    expect(metrics.revenue).toBe(60);
    expect(mockEventRepo.find).toHaveBeenCalled();
  });
});