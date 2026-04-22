import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { EventBus } from '@nestjs/cqrs';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { BetsService } from './bets.service';
import { Bet, BetStatus } from './entities/bet.entity';
import { Match, MatchOutcome } from '../matches/entities/match.entity';
import { User } from '../users/entities/user.entity';
import { WalletService } from '../wallet/wallet.service';
import { FreeBetVoucherService } from '../free-bet-vouchers/free-bet-voucher.service';
import { TransactionSource } from '../transactions/entities/transaction.entity';
import { BetSettledEvent } from '../analytics/events/bet-settled.event';
import { v4 as uuidv4 } from 'uuid';

describe('BetsService', () => {
  let service: BetsService;
  let betRepository: Repository<Bet>;
  let matchRepository: Repository<Match>;
  let userRepository: Repository<User>;
  let dataSource: DataSource;
  let walletService: WalletService;
  let freeBetVoucherService: FreeBetVoucherService;
  let eventBus: EventBus;

  const mockBetRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockMatchRepository = {
    findOne: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(),
  };

  const mockWalletService = {
    debit: jest.fn(),
    credit: jest.fn(),
    updateUserBalanceWithQueryRunner: jest.fn(),
  };

  const mockFreeBetVoucherService = {
    useVoucher: jest.fn(),
    restoreVoucherWithManager: jest.fn(),
  };

  const mockEventBus = {
    publish: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BetsService,
        {
          provide: getRepositoryToken(Bet),
          useValue: mockBetRepository,
        },
        {
          provide: getRepositoryToken(Match),
          useValue: mockMatchRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: WalletService,
          useValue: mockWalletService,
        },
        {
          provide: FreeBetVoucherService,
          useValue: mockFreeBetVoucherService,
        },
        {
          provide: EventBus,
          useValue: mockEventBus,
        },
      ],
    }).compile();

    service = module.get<BetsService>(BetsService);
    betRepository = module.get<Repository<Bet>>(getRepositoryToken(Bet));
    matchRepository = module.get<Repository<Match>>(getRepositoryToken(Match));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    dataSource = module.get<DataSource>(DataSource);
    walletService = module.get<WalletService>(WalletService);
    freeBetVoucherService = module.get<FreeBetVoucherService>(FreeBetVoucherService);
    eventBus = module.get<EventBus>(EventBus);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('placeBet', () => {
    const userId = 'user-123';
    const createBetDto = {
      matchId: 'match-123',
      stakeAmount: 100,
      predictedOutcome: MatchOutcome.HOME_WIN,
      voucherId: undefined,
    };

    const mockMatch = {
      id: 'match-123',
      homeTeam: 'Team A',
      awayTeam: 'Team B',
      startTime: new Date(Date.now() + 3600000), // 1 hour from now
      status: 'scheduled',
      odds: { homeWin: 2.5, draw: 3.0, awayWin: 3.5 },
    };

    const mockUser = {
      id: userId,
      email: 'user@example.com',
      balance: 500,
    };

    const mockBet = {
      id: 'bet-123',
      userId,
      matchId: 'match-123',
      stakeAmount: 100,
      predictedOutcome: MatchOutcome.HOME_WIN,
      odds: 2.5,
      potentialPayout: 250,
      status: BetStatus.PENDING,
    };

    beforeEach(() => {
      mockMatchRepository.findOne.mockResolvedValue(mockMatch);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockBetRepository.create.mockReturnValue(mockBet);
      mockBetRepository.save.mockResolvedValue(mockBet);
      mockWalletService.debit.mockResolvedValue({ success: true });
    });

    it('should place a bet successfully', async () => {
      const result = await service.placeBet(userId, createBetDto);

      expect(mockMatchRepository.findOne).toHaveBeenCalledWith({
        where: { id: createBetDto.matchId },
      });
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(mockWalletService.debit).toHaveBeenCalledWith(
        userId,
        100,
        TransactionSource.BET,
        expect.any(String),
        expect.objectContaining({
          reason: 'BET_PLACEMENT',
          matchId: 'match-123',
          stakeAmount: 100,
        }),
      );
      expect(mockBetRepository.create).toHaveBeenCalledWith({
        userId,
        matchId: 'match-123',
        stakeAmount: 100,
        predictedOutcome: MatchOutcome.HOME_WIN,
        odds: 2.5,
        potentialPayout: 250,
        status: BetStatus.PENDING,
      });
      expect(result).toEqual(mockBet);
    });

    it('should throw NotFoundException if match not found', async () => {
      mockMatchRepository.findOne.mockResolvedValue(null);

      await expect(service.placeBet(userId, createBetDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if match has already started', async () => {
      const pastMatch = { ...mockMatch, startTime: new Date(Date.now() - 3600000) };
      mockMatchRepository.findOne.mockResolvedValue(pastMatch);

      await expect(service.placeBet(userId, createBetDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if insufficient balance', async () => {
      mockWalletService.debit.mockResolvedValue({
        success: false,
        error: 'Insufficient balance',
      });

      await expect(service.placeBet(userId, createBetDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle free bet voucher', async () => {
      const voucherDto = { ...createBetDto, voucherId: 'voucher-123' };
      mockFreeBetVoucherService.useVoucher.mockResolvedValue({
        success: true,
        voucher: { id: 'voucher-123', value: 100 },
      });

      await service.placeBet(userId, voucherDto);

      expect(mockFreeBetVoucherService.useVoucher).toHaveBeenCalledWith(
        'voucher-123',
        userId,
      );
      expect(mockWalletService.debit).not.toHaveBeenCalled();
    });
  });

  describe('getUserBets', () => {
    const userId = 'user-123';
    const page = 1;
    const limit = 10;

    const mockBets = [
      {
        id: 'bet-1',
        userId,
        matchId: 'match-1',
        stakeAmount: 100,
        status: BetStatus.PENDING,
      },
      {
        id: 'bet-2',
        userId,
        matchId: 'match-2',
        stakeAmount: 50,
        status: BetStatus.WON,
      },
    ];

    const mockQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([mockBets, 2]),
    };

    beforeEach(() => {
      mockBetRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    });

    it('should return paginated user bets', async () => {
      const result = await service.getUserBets(userId, page, limit);

      expect(mockBetRepository.createQueryBuilder).toHaveBeenCalledWith('bet');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('bet.userId = :userId', {
        userId,
      });
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(limit);
      expect(result).toEqual({
        data: mockBets,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });
  });

  describe('getMatchBets', () => {
    const matchId = 'match-123';
    const page = 1;
    const limit = 10;

    const mockBets = [
      {
        id: 'bet-1',
        matchId,
        userId: 'user-1',
        stakeAmount: 100,
        status: BetStatus.PENDING,
      },
    ];

    const mockQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([mockBets, 1]),
    };

    beforeEach(() => {
      mockBetRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    });

    it('should return paginated match bets', async () => {
      const result = await service.getMatchBets(matchId, page, limit);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('bet.matchId = :matchId', {
        matchId,
      });
      expect(result).toEqual({
        data: mockBets,
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });
  });

  describe('getBetById', () => {
    const betId = 'bet-123';
    const userId = 'user-123';

    const mockBet = {
      id: betId,
      userId,
      matchId: 'match-123',
      stakeAmount: 100,
      status: BetStatus.PENDING,
    };

    it('should return bet if found and owned by user', async () => {
      mockBetRepository.findOne.mockResolvedValue(mockBet);

      const result = await service.getBetById(betId, userId);

      expect(mockBetRepository.findOne).toHaveBeenCalledWith({
        where: { id: betId },
        relations: ['match', 'user'],
      });
      expect(result).toEqual(mockBet);
    });

    it('should throw NotFoundException if bet not found', async () => {
      mockBetRepository.findOne.mockResolvedValue(null);

      await expect(service.getBetById(betId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if bet owned by different user', async () => {
      const otherUserBet = { ...mockBet, userId: 'other-user' };
      mockBetRepository.findOne.mockResolvedValue(otherUserBet);

      await expect(service.getBetById(betId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateBetStatus', () => {
    const betId = 'bet-123';
    const updateDto = { status: BetStatus.CANCELLED };

    const mockBet = {
      id: betId,
      status: BetStatus.PENDING,
      stakeAmount: 100,
      userId: 'user-123',
    };

    const updatedBet = { ...mockBet, status: BetStatus.CANCELLED };

    beforeEach(() => {
      mockBetRepository.findOne.mockResolvedValue(mockBet);
      mockBetRepository.save.mockResolvedValue(updatedBet);
    });

    it('should update bet status successfully', async () => {
      const result = await service.updateBetStatus(betId, updateDto);

      expect(mockBetRepository.save).toHaveBeenCalledWith({
        ...mockBet,
        status: BetStatus.CANCELLED,
        settledAt: expect.any(Date),
      });
      expect(result).toEqual(updatedBet);
    });

    it('should throw NotFoundException if bet not found', async () => {
      mockBetRepository.findOne.mockResolvedValue(null);

      await expect(service.updateBetStatus(betId, updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException for invalid status transition', async () => {
      const settledBet = { ...mockBet, status: BetStatus.WON };
      mockBetRepository.findOne.mockResolvedValue(settledBet);

      await expect(service.updateBetStatus(betId, updateDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('settleMatchBets', () => {
    const matchId = 'match-123';

    const mockMatch = {
      id: matchId,
      outcome: MatchOutcome.HOME_WIN,
    };

    const mockBets = [
      {
        id: 'bet-1',
        userId: 'user-1',
        predictedOutcome: MatchOutcome.HOME_WIN,
        stakeAmount: 100,
        potentialPayout: 250,
        status: BetStatus.PENDING,
      },
      {
        id: 'bet-2',
        userId: 'user-2',
        predictedOutcome: MatchOutcome.AWAY_WIN,
        stakeAmount: 50,
        potentialPayout: 150,
        status: BetStatus.PENDING,
      },
    ];

    const mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        find: jest.fn().mockResolvedValue(mockBets),
        save: jest.fn(),
      },
    };

    beforeEach(() => {
      mockMatchRepository.findOne.mockResolvedValue(mockMatch);
      mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
      mockWalletService.updateUserBalanceWithQueryRunner.mockResolvedValue({
        success: true,
      });
    });

    it('should settle match bets successfully', async () => {
      const result = await service.settleMatchBets(matchId);

      expect(mockMatchRepository.findOne).toHaveBeenCalledWith({
        where: { id: matchId },
      });
      expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(2);
      expect(mockWalletService.updateUserBalanceWithQueryRunner).toHaveBeenCalledWith(
        mockQueryRunner,
        'user-1',
        250,
        'BET_SETTLEMENT',
        'bet-1',
        expect.any(Object),
        true,
      );
      expect(result).toEqual({
        settled: 2,
        won: 1,
        lost: 1,
        totalPayout: 250,
      });
    });

    it('should throw NotFoundException if match not found', async () => {
      mockMatchRepository.findOne.mockResolvedValue(null);

      await expect(service.settleMatchBets(matchId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if match has no outcome', async () => {
      const matchWithoutOutcome = { ...mockMatch, outcome: null };
      mockMatchRepository.findOne.mockResolvedValue(matchWithoutOutcome);

      await expect(service.settleMatchBets(matchId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancelBet', () => {
    const betId = 'bet-123';
    const userId = 'user-123';

    const mockBet = {
      id: betId,
      userId,
      status: BetStatus.PENDING,
      stakeAmount: 100,
      matchId: 'match-123',
    };

    const mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: jest.fn().mockResolvedValue(mockBet),
        save: jest.fn().mockResolvedValue({ ...mockBet, status: BetStatus.CANCELLED }),
      },
    };

    beforeEach(() => {
      mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
      mockWalletService.credit.mockResolvedValue({ success: true });
    });

    it('should cancel bet successfully', async () => {
      const result = await service.cancelBet(betId, userId, false);

      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith({
        ...mockBet,
        status: BetStatus.CANCELLED,
        settledAt: expect.any(Date),
      });
      expect(mockWalletService.credit).toHaveBeenCalledWith(
        userId,
        100,
        TransactionSource.BET,
        expect.any(String),
        expect.objectContaining({
          reason: 'BET_CANCELLATION',
          betId,
          stakeAmount: 100,
          cancellationReason: 'user_cancelled',
        }),
      );
      expect(result.status).toBe(BetStatus.CANCELLED);
    });

    it('should throw NotFoundException if bet not found', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(null);

      await expect(service.cancelBet(betId, userId, false)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if bet already settled', async () => {
      const settledBet = { ...mockBet, status: BetStatus.WON };
      mockQueryRunner.manager.findOne.mockResolvedValue(settledBet);

      await expect(service.cancelBet(betId, userId, false)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('getUserBettingStats', () => {
    const userId = 'user-123';

    const mockStats = {
      totalBets: '10',
      pendingBets: '2',
      wonBets: '5',
      lostBets: '2',
      cancelledBets: '1',
      totalStaked: '1000.00',
      totalWon: '1200.00',
    };

    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue(mockStats),
    };

    beforeEach(() => {
      mockBetRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    });

    it('should return user betting statistics', async () => {
      const result = await service.getUserBettingStats(userId);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('bet.userId = :userId', {
        userId,
      });
      expect(result).toEqual({
        totalBets: 10,
        pendingBets: 2,
        wonBets: 5,
        lostBets: 2,
        cancelledBets: 1,
        totalStaked: 1000,
        totalWon: 1200,
        winRate: 71.43, // (5 / (5 + 2)) * 100
      });
    });

    it('should handle zero settled bets for win rate', async () => {
      const zeroSettledStats = {
        ...mockStats,
        wonBets: '0',
        lostBets: '0',
      };
      mockQueryBuilder.getRawOne.mockResolvedValue(zeroSettledStats);

      const result = await service.getUserBettingStats(userId);

      expect(result.winRate).toBe(0);
    });
  });
});</content>
<parameter name="filePath">c:\Users\u-adamu\Desktop\wave 2\Renaissance-api\backend\src\bets\bets.service.spec.ts