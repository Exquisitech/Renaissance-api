import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { StakingService } from './staking.service';
import { User } from '../users/entities/user.entity';
import { Transaction } from '../transactions/entities/transaction.entity';

// Mock implementations for testing
const mockUserRepository = {
  findOne: jest.fn(),
  save: jest.fn(),
};

const mockTransactionRepository = {
  findOne: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue({
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    },
  }),
};

describe('StakingService', () => {
  let service: StakingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StakingService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<StakingService>(StakingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getConfig', () => {
    it('should return staking configuration', () => {
      const config = service.getConfig();

      expect(config).toEqual({
        minStakeAmount: 10,
        maxStakeAmount: 10000,
        durationDays: 30,
        apr: 12,
      });
    });
  });

  describe('stakeTokens', () => {
    it('should successfully stake tokens', async () => {
      const userId = 'test-user-id';
      const amount = 100;
      const mockUser = { id: userId, walletBalance: 500 };
      const mockTransaction = { id: 'stake-txn-123', status: 'pending' };

      const queryRunner = mockDataSource.createQueryRunner();

      // Mock successful staking operation
      queryRunner.manager.findOne.mockResolvedValue(mockUser);
      queryRunner.manager.create.mockReturnValue(mockTransaction);
      queryRunner.manager.save
        .mockResolvedValueOnce(mockTransaction) // Save transaction
        .mockResolvedValueOnce({ ...mockUser, walletBalance: 400 }) // Update user
        .mockResolvedValueOnce({ ...mockTransaction, status: 'completed' }); // Complete transaction

      const result = await service.stakeTokens(userId, amount);

      expect(result).toEqual({
        success: true,
        stakedAmount: 100,
        rewardAmount: expect.any(Number), // Calculated based on APR
        endDate: expect.any(Date),
        transactionId: 'stake-txn-123',
      });

      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('should reject stake below minimum amount', async () => {
      await expect(service.stakeTokens('user-id', 5)).rejects.toThrow(
        'Minimum stake amount is 10',
      );
    });

    it('should reject stake above maximum amount', async () => {
      await expect(service.stakeTokens('user-id', 15000)).rejects.toThrow(
        'Maximum stake amount is 10000',
      );
    });

    it('should rollback transaction on failure', async () => {
      const userId = 'test-user-id';
      const amount = 100;
      const queryRunner = mockDataSource.createQueryRunner();

      queryRunner.manager.findOne.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.stakeTokens(userId, amount)).rejects.toThrow(
        'Database error',
      );

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    });
  });

  describe('claimRewards', () => {
    it('should successfully claim staking rewards', async () => {
      const userId = 'test-user-id';
      const stakeId = 'stake-123';
      const mockStakeTransaction = {
        id: stakeId,
        userId,
        type: 'staking_penalty',
        status: 'completed',
        createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000), // 31 days ago
        metadata: {
          stakedAmount: 100,
          rewardAmount: 12,
        },
      };
      const mockUser = { id: userId, walletBalance: 50 };
      const mockRewardTransaction = { id: 'reward-txn-456', status: 'pending' };

      const queryRunner = mockDataSource.createQueryRunner();

      queryRunner.manager.findOne
        .mockResolvedValueOnce(mockStakeTransaction) // Find stake transaction
        .mockResolvedValueOnce(mockUser); // Find user

      queryRunner.manager.create.mockReturnValue(mockRewardTransaction);
      queryRunner.manager.save
        .mockResolvedValueOnce(mockRewardTransaction) // Save reward transaction
        .mockResolvedValueOnce({ ...mockUser, walletBalance: 162 }) // Update user (+100 staked + 12 reward)
        .mockResolvedValueOnce({
          ...mockRewardTransaction,
          status: 'completed',
        }) // Complete reward
        .mockResolvedValueOnce({ ...mockStakeTransaction, status: 'reversed' }); // Reverse stake

      const result = await service.claimRewards(userId, stakeId);

      expect(result).toEqual({
        success: true,
        stakedAmount: 100,
        rewardAmount: 12,
        endDate: expect.any(Date),
        transactionId: 'reward-txn-456',
      });
    });

    it('should reject claim for non-existent stake', async () => {
      const queryRunner = mockDataSource.createQueryRunner();
      queryRunner.manager.findOne.mockResolvedValue(null);

      await expect(
        service.claimRewards('user-id', 'non-existent-stake'),
      ).rejects.toThrow('Staking record not found or already claimed');
    });

    it('should reject claim for ongoing stake period', async () => {
      const mockStakeTransaction = {
        id: 'recent-stake',
        userId: 'user-id',
        type: 'staking_penalty',
        status: 'completed',
        createdAt: new Date(), // Just created
        metadata: { stakedAmount: 100, rewardAmount: 12 },
      };

      const queryRunner = mockDataSource.createQueryRunner();
      queryRunner.manager.findOne.mockResolvedValue(mockStakeTransaction);

      await expect(
        service.claimRewards('user-id', 'recent-stake'),
      ).rejects.toThrow('Staking period has not yet ended');
    });
  });

  describe('earlyUnstake', () => {
    it('should allow early unstake with penalty', async () => {
      const userId = 'test-user-id';
      const stakeId = 'ongoing-stake';
      const penaltyPercent = 25;

      const mockStakeTransaction = {
        id: stakeId,
        userId,
        type: 'staking_penalty',
        status: 'completed',
        createdAt: new Date(),
        metadata: { stakedAmount: 100 },
      };
      const mockUser = { id: userId, walletBalance: 50 };
      const mockPenaltyTransaction = {
        id: 'penalty-txn-789',
        status: 'pending',
      };

      const queryRunner = mockDataSource.createQueryRunner();

      queryRunner.manager.findOne
        .mockResolvedValueOnce(mockStakeTransaction)
        .mockResolvedValueOnce(mockUser);

      queryRunner.manager.create.mockReturnValue(mockPenaltyTransaction);
      queryRunner.manager.save
        .mockResolvedValueOnce(mockPenaltyTransaction)
        .mockResolvedValueOnce({ ...mockUser, walletBalance: 125 }) // 50 + 75 (100 - 25 penalty)
        .mockResolvedValueOnce({
          ...mockPenaltyTransaction,
          status: 'completed',
        })
        .mockResolvedValueOnce({ ...mockStakeTransaction, status: 'reversed' });

      const result = await service.earlyUnstake(
        userId,
        stakeId,
        penaltyPercent,
      );

      expect(result).toEqual({
        success: true,
        stakedAmount: 100,
        rewardAmount: -25, // Negative indicates penalty
        endDate: expect.any(Date),
        transactionId: 'penalty-txn-789',
      });
    });

    it('should validate penalty percentage range', async () => {
      await expect(
        service.earlyUnstake('user-id', 'stake-id', -10),
      ).rejects.toThrow('Penalty percentage must be between 0 and 100');

      await expect(
        service.earlyUnstake('user-id', 'stake-id', 150),
      ).rejects.toThrow('Penalty percentage must be between 0 and 100');
    });
  });
});
