import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { WalletService } from '../wallet.service';
import { User } from '../../users/entities/user.entity';
import { Transaction } from '../entities/transaction.entity';

describe('WalletService', () => {
  let service: WalletService;
  let userRepository: Repository<User>;
  let transactionRepository: Repository<Transaction>;
  let dataSource: DataSource;

  const mockUserRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockTransactionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
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
        create: jest.fn(),
        save: jest.fn(),
      },
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
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

    service = module.get<WalletService>(WalletService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    transactionRepository = module.get<Repository<Transaction>>(
      getRepositoryToken(Transaction),
    );
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('deposit', () => {
    it('should successfully deposit funds to user wallet', async () => {
      const userId = 'test-user-id';
      const amount = 100;
      const mockUser = { id: userId, walletBalance: 50 };
      const mockTransaction = { id: 'txn-123', status: 'pending' };

      const queryRunner = mockDataSource.createQueryRunner();

      queryRunner.manager.findOne.mockResolvedValue(mockUser);
      queryRunner.manager.create.mockReturnValue(mockTransaction);
      queryRunner.manager.save
        .mockResolvedValueOnce(mockTransaction)
        .mockResolvedValueOnce({
          ...mockUser,
          walletBalance: 150,
        })
        .mockResolvedValueOnce({
          ...mockTransaction,
          status: 'completed',
        });

      const result = await service.deposit(userId, amount);

      expect(result).toEqual({
        success: true,
        newBalance: 150,
        transactionId: 'txn-123',
      });
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('should rollback transaction on failure', async () => {
      const userId = 'test-user-id';
      const amount = 100;
      const queryRunner = mockDataSource.createQueryRunner();

      queryRunner.manager.findOne.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.deposit(userId, amount)).rejects.toThrow(
        'Database error',
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for negative amount', async () => {
      await expect(service.deposit('user-id', -50)).rejects.toThrow(
        'Deposit amount must be positive',
      );
    });
  });

  describe('withdraw', () => {
    it('should successfully withdraw funds from user wallet', async () => {
      const userId = 'test-user-id';
      const amount = 50;
      const mockUser = { id: userId, walletBalance: 100 };
      const mockTransaction = { id: 'txn-456', status: 'pending' };

      const queryRunner = mockDataSource.createQueryRunner();

      queryRunner.manager.findOne.mockResolvedValue(mockUser);
      queryRunner.manager.create.mockReturnValue(mockTransaction);
      queryRunner.manager.save
        .mockResolvedValueOnce(mockTransaction)
        .mockResolvedValueOnce({
          ...mockUser,
          walletBalance: 50,
        })
        .mockResolvedValueOnce({
          ...mockTransaction,
          status: 'completed',
        });

      const result = await service.withdraw(userId, amount);

      expect(result).toEqual({
        success: true,
        newBalance: 50,
        transactionId: 'txn-456',
      });
    });

    it('should throw BadRequestException for insufficient balance', async () => {
      const userId = 'test-user-id';
      const amount = 150;
      const mockUser = { id: userId, walletBalance: 100 };

      const queryRunner = mockDataSource.createQueryRunner();
      queryRunner.manager.findOne.mockResolvedValue(mockUser);

      await expect(service.withdraw(userId, amount)).rejects.toThrow(
        'Insufficient wallet balance',
      );
    });
  });

  describe('updateUserBalance', () => {
    it('should update user balance within transaction', async () => {
      const userId = 'test-user-id';
      const amount = 75;
      const mockUser = { id: userId, walletBalance: 100 };
      const mockTransaction = { id: 'txn-789', status: 'pending' };

      const queryRunner = mockDataSource.createQueryRunner();

      queryRunner.manager.findOne.mockResolvedValue(mockUser);
      queryRunner.manager.create.mockReturnValue(mockTransaction);
      queryRunner.manager.save
        .mockResolvedValueOnce(mockTransaction)
        .mockResolvedValueOnce({
          ...mockUser,
          walletBalance: 175,
        })
        .mockResolvedValueOnce({
          ...mockTransaction,
          status: 'completed',
        });

      const result = await service.updateUserBalance(
        userId,
        amount,
        'bet_winning',
      );

      expect(result).toEqual({
        success: true,
        newBalance: 175,
        transactionId: 'txn-789',
      });
    });

    it('should prevent negative balance for non-withdrawal operations', async () => {
      const userId = 'test-user-id';
      const amount = -150; // Would make balance negative
      const mockUser = { id: userId, walletBalance: 100 };

      const queryRunner = mockDataSource.createQueryRunner();
      queryRunner.manager.findOne.mockResolvedValue(mockUser);

      await expect(
        service.updateUserBalance(userId, amount, 'bet_winning'),
      ).rejects.toThrow('Insufficient wallet balance for this operation');
    });
  });
});
