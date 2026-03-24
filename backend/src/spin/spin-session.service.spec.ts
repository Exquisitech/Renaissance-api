import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SpinSessionService } from './spin-session.service';
import {
  SpinSession,
  SpinSessionStatus,
  RewardType,
} from './entities/spin-session.entity';
import { CreateSpinSessionDto } from './dto/create-spin-session.dto';

describe('SpinSessionService', () => {
  let service: SpinSessionService;
  let repository: Repository<SpinSession>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockUserId = 'user-123';
  const mockSessionId = 'session-456';

  const createMockSession = (
    overrides?: Partial<SpinSession>,
  ): SpinSession => ({
    id: mockSessionId,
    userId: mockUserId,
    stakeAmount: 10,
    rewardType: RewardType.NONE,
    rewardValue: 0,
    status: SpinSessionStatus.PENDING,
    txReference: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    preventUpdateAfterCompletion: jest.fn(),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpinSessionService,
        {
          provide: getRepositoryToken(SpinSession),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<SpinSessionService>(SpinSessionService);
    repository = module.get<Repository<SpinSession>>(
      getRepositoryToken(SpinSession),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new spin session with default values', async () => {
      const createDto: CreateSpinSessionDto = { stakeAmount: 10 };
      const mockSession = createMockSession();

      mockRepository.create.mockReturnValue(mockSession);
      mockRepository.save.mockResolvedValue(mockSession);

      const result = await service.create(mockUserId, createDto);

      expect(mockRepository.create).toHaveBeenCalledWith({
        userId: mockUserId,
        stakeAmount: 10,
        rewardType: RewardType.NONE,
        rewardValue: 0,
        status: SpinSessionStatus.PENDING,
        txReference: null,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(mockSession);
      expect(result).toEqual(mockSession);
    });

    it('should create a spin session with provided reward type and value', async () => {
      const createDto: CreateSpinSessionDto = {
        stakeAmount: 25,
        rewardType: RewardType.TOKENS,
        rewardValue: 100,
        txReference: 'tx-abc123',
      };
      const mockSession = createMockSession({
        stakeAmount: 25,
        rewardType: RewardType.TOKENS,
        rewardValue: 100,
        txReference: 'tx-abc123',
      });

      mockRepository.create.mockReturnValue(mockSession);
      mockRepository.save.mockResolvedValue(mockSession);

      const result = await service.create(mockUserId, createDto);

      expect(mockRepository.create).toHaveBeenCalledWith({
        userId: mockUserId,
        stakeAmount: 25,
        rewardType: RewardType.TOKENS,
        rewardValue: 100,
        status: SpinSessionStatus.PENDING,
        txReference: 'tx-abc123',
      });
      expect(result.rewardType).toBe(RewardType.TOKENS);
      expect(result.rewardValue).toBe(100);
    });
  });

  describe('findById', () => {
    it('should return a session when found', async () => {
      const mockSession = createMockSession();
      mockRepository.findOne.mockResolvedValue(mockSession);

      const result = await service.findById(mockSessionId);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockSessionId },
      });
      expect(result).toEqual(mockSession);
    });

    it('should return null when session not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByIdOrFail', () => {
    it('should return session when found', async () => {
      const mockSession = createMockSession();
      mockRepository.findOne.mockResolvedValue(mockSession);

      const result = await service.findByIdOrFail(mockSessionId);

      expect(result).toEqual(mockSession);
    });

    it('should throw NotFoundException when session not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findByIdOrFail('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByUserId', () => {
    it('should return sessions for user ordered by createdAt DESC', async () => {
      const sessions = [
        createMockSession({ id: 'session-1' }),
        createMockSession({ id: 'session-2' }),
      ];
      mockRepository.find.mockResolvedValue(sessions);

      const result = await service.findByUserId(mockUserId);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        order: { createdAt: 'DESC' },
        take: 50,
      });
      expect(result).toEqual(sessions);
    });

    it('should respect custom limit parameter', async () => {
      mockRepository.find.mockResolvedValue([]);

      await service.findByUserId(mockUserId, 10);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        order: { createdAt: 'DESC' },
        take: 10,
      });
    });
  });

  describe('complete', () => {
    it('should complete a pending session with reward details', async () => {
      const mockSession = createMockSession();
      const completedSession = createMockSession({
        status: SpinSessionStatus.COMPLETED,
        rewardType: RewardType.TOKENS,
        rewardValue: 50,
        txReference: 'tx-completed',
      });

      mockRepository.findOne.mockResolvedValue(mockSession);
      mockRepository.save.mockResolvedValue(completedSession);

      const result = await service.complete(
        mockSessionId,
        RewardType.TOKENS,
        50,
        'tx-completed',
      );

      expect(result.status).toBe(SpinSessionStatus.COMPLETED);
      expect(result.rewardType).toBe(RewardType.TOKENS);
      expect(result.rewardValue).toBe(50);
    });

    it('should throw BadRequestException when session is already completed', async () => {
      const completedSession = createMockSession({
        status: SpinSessionStatus.COMPLETED,
      });
      mockRepository.findOne.mockResolvedValue(completedSession);

      await expect(
        service.complete(mockSessionId, RewardType.XP, 10),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when session is failed', async () => {
      const failedSession = createMockSession({
        status: SpinSessionStatus.FAILED,
      });
      mockRepository.findOne.mockResolvedValue(failedSession);

      await expect(
        service.complete(mockSessionId, RewardType.XP, 10),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('fail', () => {
    it('should mark a pending session as failed', async () => {
      const mockSession = createMockSession();
      const failedSession = createMockSession({
        status: SpinSessionStatus.FAILED,
        txReference: 'tx-failed',
      });

      mockRepository.findOne.mockResolvedValue(mockSession);
      mockRepository.save.mockResolvedValue(failedSession);

      const result = await service.fail(mockSessionId, 'tx-failed');

      expect(result.status).toBe(SpinSessionStatus.FAILED);
    });

    it('should throw BadRequestException when session is already completed', async () => {
      const completedSession = createMockSession({
        status: SpinSessionStatus.COMPLETED,
      });
      mockRepository.findOne.mockResolvedValue(completedSession);

      await expect(service.fail(mockSessionId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('setTxReference', () => {
    it('should update txReference for pending session', async () => {
      const mockSession = createMockSession();
      const updatedSession = createMockSession({ txReference: 'new-tx-ref' });

      mockRepository.findOne.mockResolvedValue(mockSession);
      mockRepository.save.mockResolvedValue(updatedSession);

      const result = await service.setTxReference(mockSessionId, 'new-tx-ref');

      expect(result.txReference).toBe('new-tx-ref');
    });

    it('should throw BadRequestException for completed session', async () => {
      const completedSession = createMockSession({
        status: SpinSessionStatus.COMPLETED,
      });
      mockRepository.findOne.mockResolvedValue(completedSession);

      await expect(
        service.setTxReference(mockSessionId, 'new-ref'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getStatistics', () => {
    it('should return aggregate statistics', async () => {
      const sessions = [
        createMockSession({
          stakeAmount: 10,
          rewardValue: 25,
          status: SpinSessionStatus.COMPLETED,
          rewardType: RewardType.TOKENS,
        }),
        createMockSession({
          stakeAmount: 20,
          rewardValue: 0,
          status: SpinSessionStatus.FAILED,
          rewardType: RewardType.NONE,
        }),
        createMockSession({
          stakeAmount: 15,
          rewardValue: 0,
          status: SpinSessionStatus.PENDING,
          rewardType: RewardType.NONE,
        }),
      ];
      mockRepository.find.mockResolvedValue(sessions);

      const stats = await service.getStatistics();

      expect(stats.totalSessions).toBe(3);
      expect(stats.totalStaked).toBe(45);
      expect(stats.totalRewards).toBe(25);
      expect(stats.statusCounts[SpinSessionStatus.COMPLETED]).toBe(1);
      expect(stats.statusCounts[SpinSessionStatus.FAILED]).toBe(1);
      expect(stats.statusCounts[SpinSessionStatus.PENDING]).toBe(1);
      expect(stats.rewardTypeCounts[RewardType.TOKENS]).toBe(1);
      expect(stats.rewardTypeCounts[RewardType.NONE]).toBe(2);
    });

    it('should return zero counts when no sessions exist', async () => {
      mockRepository.find.mockResolvedValue([]);

      const stats = await service.getStatistics();

      expect(stats.totalSessions).toBe(0);
      expect(stats.totalStaked).toBe(0);
      expect(stats.totalRewards).toBe(0);
    });
  });

  describe('immutability enforcement', () => {
    it('should prevent any modification to completed sessions', async () => {
      const completedSession = createMockSession({
        status: SpinSessionStatus.COMPLETED,
      });
      mockRepository.findOne.mockResolvedValue(completedSession);

      // All modification operations should fail
      await expect(
        service.complete(mockSessionId, RewardType.XP, 10),
      ).rejects.toThrow(/immutable/);

      await expect(service.fail(mockSessionId)).rejects.toThrow(/immutable/);

      await expect(
        service.setTxReference(mockSessionId, 'new-ref'),
      ).rejects.toThrow(/immutable/);
    });

    it('should prevent any modification to failed sessions', async () => {
      const failedSession = createMockSession({
        status: SpinSessionStatus.FAILED,
      });
      mockRepository.findOne.mockResolvedValue(failedSession);

      await expect(
        service.complete(mockSessionId, RewardType.XP, 10),
      ).rejects.toThrow(/immutable/);

      await expect(service.fail(mockSessionId)).rejects.toThrow(/immutable/);

      await expect(
        service.setTxReference(mockSessionId, 'new-ref'),
      ).rejects.toThrow(/immutable/);
    });
  });
});
