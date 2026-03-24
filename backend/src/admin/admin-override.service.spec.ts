import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AdminOverrideService } from './admin-override.service';
import {
  AdminOverrideLog,
  AdminOverrideAction,
  OverrideStatus,
} from './entities/admin-override-log.entity';
import { User } from '../users/entities/user.entity';
import { Bet } from '../bets/entities/bet.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { FreeBetVoucher } from '../free-bet-vouchers/entities/free-bet-voucher.entity';
import { Spin } from '../spin/entities/spin.entity';
import {
  BalanceAdjustmentDto,
  BetOutcomeCorrectionDto,
  FreeBetVoucherIssuanceDto,
  SpinRewardReversalDto,
} from './dto/admin-override.dto';

describe('AdminOverrideService', () => {
  let service: AdminOverrideService;
  let userRepository: Repository<User>;
  let overrideLogRepository: Repository<AdminOverrideLog>;
  let dataSource: DataSource;

  const mockUserRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockOverrideLogRepository = {
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
        save: jest.fn(),
      },
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminOverrideService,
        {
          provide: getRepositoryToken(AdminOverrideLog),
          useValue: mockOverrideLogRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Bet),
          useValue: { findOne: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(FreeBetVoucher),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(Spin),
          useValue: { findOne: jest.fn(), save: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<AdminOverrideService>(AdminOverrideService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    overrideLogRepository = module.get<Repository<AdminOverrideLog>>(
      getRepositoryToken(AdminOverrideLog),
    );
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('adjustUserBalance', () => {
    it('should successfully adjust user balance', async () => {
      const userId = 'user-123';
      const adminId = 'admin-456';
      const dto: BalanceAdjustmentDto = {
        reason: 'Test adjustment',
        amount: 100,
        operation: 'add',
        description: 'Test description',
      };

      const mockUser = { id: userId, walletBalance: 500 };
      const mockOverrideLog = { id: 'override-123' };

      const queryRunner = dataSource.createQueryRunner();
      (queryRunner.manager.findOne as jest.Mock).mockResolvedValue(mockUser);
      (overrideLogRepository.create as jest.Mock).mockReturnValue(
        mockOverrideLog,
      );
      (queryRunner.manager.save as jest.Mock).mockResolvedValue(
        mockOverrideLog,
      );

      const result = await service.adjustUserBalance(userId, adminId, dto);

      expect(result).toEqual(mockOverrideLog);
      expect(queryRunner.manager.save).toHaveBeenCalledWith(User, {
        ...mockUser,
        walletBalance: 600,
      });
      expect(overrideLogRepository.create).toHaveBeenCalledWith({
        adminId,
        actionType: AdminOverrideAction.BALANCE_ADJUSTMENT,
        status: OverrideStatus.EXECUTED,
        affectedUserId: userId,
        affectedEntityId: userId,
        affectedEntityType: 'user',
        reason: dto.reason,
        previousValues: { walletBalance: 500 },
        newValues: { walletBalance: 600 },
        metadata: {
          adjustmentAmount: 100,
          operation: 'add',
          description: dto.description,
        },
        executedAt: expect.any(Date),
        executedBy: adminId,
        requiresOnChainApproval: false,
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      const userId = 'nonexistent-user';
      const adminId = 'admin-456';
      const dto: BalanceAdjustmentDto = {
        reason: 'Test adjustment',
        amount: 100,
        operation: 'add',
      };

      const queryRunner = dataSource.createQueryRunner();
      (queryRunner.manager.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.adjustUserBalance(userId, adminId, dto),
      ).rejects.toThrow('User with ID nonexistent-user not found');
    });

    it('should throw BadRequestException when adjustment results in negative balance', async () => {
      const userId = 'user-123';
      const adminId = 'admin-456';
      const dto: BalanceAdjustmentDto = {
        reason: 'Test adjustment',
        amount: 600,
        operation: 'subtract',
      };

      const mockUser = { id: userId, walletBalance: 500 };
      const queryRunner = dataSource.createQueryRunner();
      (queryRunner.manager.findOne as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        service.adjustUserBalance(userId, adminId, dto),
      ).rejects.toThrow('Balance adjustment would result in negative balance');
    });
  });

  describe('correctBetOutcome', () => {
    it('should successfully correct bet outcome to won', async () => {
      const adminId = 'admin-456';
      const dto: BetOutcomeCorrectionDto = {
        betId: 'bet-123',
        newOutcome: 'won',
        payoutAmount: 200,
        reason: 'Test correction',
        outcomeReason: 'Manual correction',
      };

      const mockBet = {
        id: 'bet-123',
        userId: 'user-123',
        status: 'pending',
        potentialPayout: 150,
        user: { id: 'user-123', walletBalance: 500 },
      };
      const mockOverrideLog = { id: 'override-123' };

      const queryRunner = dataSource.createQueryRunner();
      (queryRunner.manager.findOne as jest.Mock).mockImplementation(
        (entity, options) => {
          if (entity === Bet) return Promise.resolve(mockBet);
          if (entity === User) return Promise.resolve(mockBet.user);
          return Promise.resolve(null);
        },
      );
      (overrideLogRepository.create as jest.Mock).mockReturnValue(
        mockOverrideLog,
      );
      (queryRunner.manager.save as jest.Mock).mockResolvedValue(
        mockOverrideLog,
      );

      const result = await service.correctBetOutcome(adminId, dto);

      expect(result).toEqual(mockOverrideLog);
      expect(queryRunner.manager.save).toHaveBeenCalledWith(Bet, {
        ...mockBet,
        status: 'won',
        settledAt: expect.any(Date),
      });
    });

    it('should create pending override for settled bets requiring on-chain approval', async () => {
      const adminId = 'admin-456';
      const dto: BetOutcomeCorrectionDto = {
        betId: 'bet-123',
        newOutcome: 'won',
        reason: 'Test correction',
        requiresOnChainApproval: true,
      };

      const mockBet = {
        id: 'bet-123',
        userId: 'user-123',
        status: 'won', // Already settled
        potentialPayout: 150,
        user: { id: 'user-123' },
      };
      const mockOverrideLog = { id: 'override-123' };

      const queryRunner = dataSource.createQueryRunner();
      (queryRunner.manager.findOne as jest.Mock).mockResolvedValue(mockBet);
      (overrideLogRepository.create as jest.Mock).mockReturnValue(
        mockOverrideLog,
      );

      const result = await service.correctBetOutcome(adminId, dto);

      expect(result).toEqual(mockOverrideLog);
      expect(overrideLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: OverrideStatus.PENDING,
          requiresOnChainApproval: true,
        }),
      );
    });
  });

  describe('issueFreeBetVoucher', () => {
    it('should successfully issue free bet voucher', async () => {
      const userId = 'user-123';
      const adminId = 'admin-456';
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const dto: FreeBetVoucherIssuanceDto = {
        reason: 'Test voucher',
        amount: 50,
        expiresAt: futureDate,
        description: 'Test description',
      };

      const mockUser = { id: userId };
      const mockVoucher = { id: 'voucher-123' };
      const mockOverrideLog = { id: 'override-123' };

      const queryRunner = dataSource.createQueryRunner();
      (queryRunner.manager.findOne as jest.Mock).mockResolvedValue(mockUser);
      (queryRunner.manager.save as jest.Mock).mockImplementation(
        (entity, data) => {
          if (entity === FreeBetVoucher) return Promise.resolve(mockVoucher);
          if (entity === AdminOverrideLog)
            return Promise.resolve(mockOverrideLog);
          return Promise.resolve(data);
        },
      );

      const result = await service.issueFreeBetVoucher(userId, adminId, dto);

      expect(result).toEqual(mockOverrideLog);
      expect(queryRunner.manager.save).toHaveBeenCalledWith(FreeBetVoucher, {
        userId,
        amount: dto.amount,
        expiresAt: dto.expiresAt,
        used: false,
        metadata: expect.objectContaining({
          issuedByAdmin: adminId,
          reason: dto.reason,
        }),
      });
    });

    it('should throw BadRequestException for expired dates', async () => {
      const userId = 'user-123';
      const adminId = 'admin-456';
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const dto: FreeBetVoucherIssuanceDto = {
        reason: 'Test voucher',
        amount: 50,
        expiresAt: pastDate,
      };

      const queryRunner = dataSource.createQueryRunner();
      (queryRunner.manager.findOne as jest.Mock).mockResolvedValue({
        id: userId,
      });

      await expect(
        service.issueFreeBetVoucher(userId, adminId, dto),
      ).rejects.toThrow('Expiration date must be in the future');
    });
  });

  describe('reverseSpinReward', () => {
    it('should successfully reverse spin reward', async () => {
      const adminId = 'admin-456';
      const dto: SpinRewardReversalDto = {
        spinId: 'spin-123',
        reason: 'Test reversal',
        reversalReason: 'Manual reversal',
      };

      const mockSpin = {
        id: 'spin-123',
        userId: 'user-123',
        status: 'pending',
        payoutAmount: 100,
        user: { id: 'user-123', walletBalance: 600 },
      };
      const mockOverrideLog = { id: 'override-123' };

      const queryRunner = dataSource.createQueryRunner();
      (queryRunner.manager.findOne as jest.Mock).mockImplementation(
        (entity, options) => {
          if (entity === Spin) return Promise.resolve(mockSpin);
          if (entity === User) return Promise.resolve(mockSpin.user);
          return Promise.resolve(null);
        },
      );
      (overrideLogRepository.create as jest.Mock).mockReturnValue(
        mockOverrideLog,
      );

      const result = await service.reverseSpinReward(adminId, dto);

      expect(result).toEqual(mockOverrideLog);
      expect(queryRunner.manager.save).toHaveBeenCalledWith(Spin, {
        ...mockSpin,
        status: 'failed',
        payoutAmount: 0,
        metadata: expect.objectContaining({
          reversed: true,
          reversalReason: dto.reversalReason,
        }),
      });
    });

    it('should throw BadRequestException for already settled spins', async () => {
      const adminId = 'admin-456';
      const dto: SpinRewardReversalDto = {
        spinId: 'spin-123',
        reason: 'Test reversal',
      };

      const mockSpin = {
        id: 'spin-123',
        userId: 'user-123',
        status: 'completed', // Already settled
      };

      const queryRunner = dataSource.createQueryRunner();
      (queryRunner.manager.findOne as jest.Mock).mockResolvedValue(mockSpin);

      await expect(service.reverseSpinReward(adminId, dto)).rejects.toThrow(
        'Cannot reverse spin reward after on-chain settlement',
      );
    });
  });

  describe('getOverrideLogs', () => {
    it('should return filtered override logs', async () => {
      const query = {
        actionType: AdminOverrideAction.BALANCE_ADJUSTMENT,
        page: 1,
        limit: 10,
      };

      const mockLogs = [
        { id: 'log-1', actionType: AdminOverrideAction.BALANCE_ADJUSTMENT },
        { id: 'log-2', actionType: AdminOverrideAction.BALANCE_ADJUSTMENT },
      ];
      const mockTotal = 2;

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(mockTotal),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockLogs),
      };

      (overrideLogRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.getOverrideLogs(query);

      expect(result.data).toEqual(mockLogs);
      expect(result.total).toEqual(mockTotal);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'override.actionType = :actionType',
        { actionType: AdminOverrideAction.BALANCE_ADJUSTMENT },
      );
    });
  });

  describe('validateAdminPermissions', () => {
    it('should throw ForbiddenException when admin not found', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue(null);

      // Using reflection to test private method
      const validateMethod = service['validateAdminPermissions'];

      await expect(validateMethod('nonexistent-admin')).rejects.toThrow(
        'Admin user not found',
      );
    });

    it('should not throw when admin exists', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue({
        id: 'admin-123',
      });

      const validateMethod = service['validateAdminPermissions'];

      await expect(validateMethod('admin-123')).resolves.not.toThrow();
    });
  });
});
