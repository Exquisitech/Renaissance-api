import { Test, TestingModule } from '@nestjs/testing';
import { GamificationService } from './gamification.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventBus } from '@nestjs/cqrs';
import {
  Achievement,
  TriggerEvent,
  RuleType,
} from './entities/achievement.entity';
import { UserAchievement } from './entities/user-achievement.entity';
import { DataSource } from 'typeorm';
import { AchievementUnlockedEvent } from './events/achievement-unlocked.event';

// Mocks
const mockEventBus = { publish: jest.fn() };
const mockAchievementRepository = {
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};
const mockUserAchievementRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
};

// Mock QueryRunner
const mockQueryRunner = {
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  manager: {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  },
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};

describe('GamificationService', () => {
  let service: GamificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamificationService,
        {
          provide: getRepositoryToken(Achievement),
          useValue: mockAchievementRepository,
        },
        {
          provide: getRepositoryToken(UserAchievement),
          useValue: mockUserAchievementRepository,
        },
        { provide: EventBus, useValue: mockEventBus },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<GamificationService>(GamificationService);
    jest.clearAllMocks();
  });

  describe('processEvent', () => {
    it('should evaluate and progress a COUNT rule achievement correctly', async () => {
      // Setup mock data
      const userId = 'user-1';
      const mockAchievement = new Achievement();
      mockAchievement.id = 'achv-1';
      mockAchievement.name = 'First Bet';
      mockAchievement.triggerEvent = TriggerEvent.BET_SETTLED;
      mockAchievement.ruleType = RuleType.COUNT;
      mockAchievement.targetValue = 1; // Unlocks on first bet
      mockAchievement.isActive = true;

      // Mock DB: returning our achievement for betting
      mockAchievementRepository.find.mockResolvedValue([mockAchievement]);

      // Mock QueryRunner manager -> creating UserAchievement if not exists
      mockQueryRunner.manager.findOne.mockResolvedValue(null);

      const mockUserAchv = new UserAchievement();
      mockUserAchv.userId = userId;
      mockUserAchv.achievementId = mockAchievement.id;
      mockUserAchv.currentProgress = 0;
      mockUserAchv.isCompleted = false;

      mockQueryRunner.manager.create.mockReturnValue(mockUserAchv);
      mockQueryRunner.manager.save.mockImplementation((entity) =>
        Promise.resolve(entity),
      );

      // Execute Test
      await service.processEvent(userId, TriggerEvent.BET_SETTLED, {
        isWin: true,
      });

      // Assertions
      expect(mockQueryRunner.manager.findOne).toHaveBeenCalledWith(
        UserAchievement,
        {
          where: { userId, achievementId: mockAchievement.id },
          lock: { mode: 'pessimistic_write' },
        },
      );

      // Since targetValue is 1, and it's a COUNT (adds 1), currentProgress goes to 1 -> Completed
      expect(mockQueryRunner.manager.save).toHaveBeenCalled();

      // Verify progress was set to completed
      expect(mockUserAchv.isCompleted).toBe(true);
      expect(mockUserAchv.currentProgress).toBe(1);

      // Verify CQRS EventBus published unlocking
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.any(AchievementUnlockedEvent),
      );
    });

    it('should evaluate SUM_AMOUNT achievement rule correctly and NOT award if target is unmet', async () => {
      const userId = 'user-2';
      const mockAchievement = new Achievement();
      mockAchievement.id = 'achv-sum';
      mockAchievement.name = 'High Roller';
      mockAchievement.triggerEvent = TriggerEvent.BET_SETTLED;
      mockAchievement.ruleType = RuleType.SUM_AMOUNT;
      mockAchievement.targetValue = 1000;
      mockAchievement.isActive = true;

      mockAchievementRepository.find.mockResolvedValue([mockAchievement]);

      const mockUserAchv = new UserAchievement();
      mockUserAchv.userId = userId;
      mockUserAchv.achievementId = mockAchievement.id;
      mockUserAchv.currentProgress = 0; // Starts at 0
      mockUserAchv.isCompleted = false;
      mockQueryRunner.manager.findOne.mockResolvedValue(null);
      mockQueryRunner.manager.create.mockReturnValue(mockUserAchv);

      // Event Payload providing 500 amount
      await service.processEvent(userId, TriggerEvent.BET_SETTLED, {
        stakeAmount: 500,
      });

      expect(mockUserAchv.currentProgress).toBe(500);
      expect(mockUserAchv.isCompleted).toBe(false); // 500 < 1000

      // Should NOT emit unlocked event
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it('should bypass already completed achievements', async () => {
      const userId = 'user-3';
      const mockAchievement = new Achievement();
      mockAchievement.triggerEvent = TriggerEvent.BET_SETTLED;
      mockAchievementRepository.find.mockResolvedValue([mockAchievement]);

      const existingCompleted = new UserAchievement();
      existingCompleted.isCompleted = true; // Already awarded previously
      mockQueryRunner.manager.findOne.mockResolvedValue(existingCompleted);

      await service.processEvent(userId, TriggerEvent.BET_SETTLED, {
        isWin: true,
      });

      // transaction should be immediately rolled back
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.manager.save).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });
});
