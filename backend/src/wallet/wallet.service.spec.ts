import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { WalletService } from './wallet.service';
import { Balance } from './entities/balance.entity';
import {
  BalanceTransaction,
  TransactionType,
  TransactionSource,
} from './entities/balance-transaction.entity';

jest.mock('uuid', () => ({
  v4: () => 'mock-uuid-v4',
}));

describe('WalletService', () => {
  let service: WalletService;

  const mockBalanceRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockTransactionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
    findOne: jest.fn(),
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
          provide: getRepositoryToken(Balance),
          useValue: mockBalanceRepository,
        },
        {
          provide: getRepositoryToken(BalanceTransaction),
          useValue: mockTransactionRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('credit', () => {
    it('should successfully credit funds to user wallet', async () => {
      const userId = 'test-user-id';
      const amount = 100;
      const source = TransactionSource.DEPOSIT;
      const referenceId = 'ref-123';
      const mockBalance = {
        id: 'bal-1',
        userId,
        availableBalance: 50,
        lockedBalance: 0,
      };
      const mockTransaction = { id: 'txn-123', status: 'completed' };

      const queryRunner = mockDataSource.createQueryRunner();

      queryRunner.manager.findOne.mockResolvedValueOnce(mockBalance); // Get balance
      queryRunner.manager.findOne.mockResolvedValueOnce(null); // Check for existing transaction

      queryRunner.manager.create.mockReturnValue(mockTransaction);
      queryRunner.manager.save
        .mockResolvedValueOnce(mockTransaction)
        .mockResolvedValueOnce({
          ...mockBalance,
          availableBalance: 150,
        });

      const result = await service.credit(userId, amount, source, referenceId);

      expect(result).toEqual({
        ...mockBalance,
        availableBalance: 150,
      });
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for negative amount', async () => {
      await expect(
        service.credit('user-id', -50, TransactionSource.DEPOSIT, 'ref'),
      ).rejects.toThrow('Amount must be positive');
    });
  });

  describe('debit', () => {
    it('should successfully debit funds from user wallet', async () => {
      const userId = 'test-user-id';
      const amount = 50;
      const source = TransactionSource.WITHDRAWAL;
      const referenceId = 'ref-456';
      const mockBalance = {
        id: 'bal-1',
        userId,
        availableBalance: 100,
        lockedBalance: 0,
      };
      const mockTransaction = { id: 'txn-456', status: 'completed' };

      const queryRunner = mockDataSource.createQueryRunner();

      queryRunner.manager.findOne.mockResolvedValueOnce(mockBalance); // Get balance
      queryRunner.manager.findOne.mockResolvedValueOnce(null); // Check for existing transaction

      queryRunner.manager.create.mockReturnValue(mockTransaction);
      queryRunner.manager.save
        .mockResolvedValueOnce(mockTransaction)
        .mockResolvedValueOnce({
          ...mockBalance,
          availableBalance: 50,
        });

      const result = await service.debit(userId, amount, source, referenceId);

      expect(result).toEqual({
        ...mockBalance,
        availableBalance: 50,
      });
    });

    it('should throw ConflictException for insufficient funds', async () => {
      const userId = 'test-user-id';
      const amount = 150;
      const source = TransactionSource.WITHDRAWAL;
      const referenceId = 'ref-789';
      const mockBalance = {
        id: 'bal-1',
        userId,
        availableBalance: 100,
        lockedBalance: 0,
      };

      const queryRunner = mockDataSource.createQueryRunner();
      queryRunner.manager.findOne.mockResolvedValueOnce(mockBalance); // Get balance
      queryRunner.manager.findOne.mockResolvedValueOnce(null); // Check for existing transaction

      await expect(
        service.debit(userId, amount, source, referenceId),
      ).rejects.toThrow('Insufficient funds');
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('updateUserBalanceWithQueryRunner', () => {
    it('should update balance using existing query runner', async () => {
      const userId = 'test-user-id';
      const amount = 100;
      const queryRunner = mockDataSource.createQueryRunner();
      const mockBalance = {
        id: 'bal-1',
        userId,
        availableBalance: 50,
        lockedBalance: 0,
      };

      queryRunner.manager.findOne.mockResolvedValue(mockBalance);
      queryRunner.manager.create.mockReturnValue({});
      queryRunner.manager.save.mockResolvedValue({});

      const result = await service.updateUserBalanceWithQueryRunner(
        queryRunner,
        userId,
        amount,
        TransactionType.CREDIT,
      );

      expect(result).toEqual({ success: true });
      expect(queryRunner.manager.save).toHaveBeenCalledTimes(2); // Transaction and Balance
    });
  });
});
