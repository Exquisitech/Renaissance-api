import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationReport } from './entities/reconciliation-report.entity';
import { User } from '../users/entities/user.entity';
import { Bet } from '../bets/entities/bet.entity';
import { Match } from '../matches/entities/match.entity';
import { Settlement } from '../blockchain/entities/settlement.entity';
import { SorobanService } from '../blockchain/soroban.service';
import { ReportType, Severity } from './entities/reconciliation-report.entity';

describe('ReconciliationService', () => {
  let service: ReconciliationService;
  let reportRepository: Repository<ReconciliationReport>;
  let userRepository: Repository<User>;
  let configService: ConfigService;

  const mockReportRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockUserRepository = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    })),
  };

  const mockBetRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    })),
  };

  const mockMatchRepository = {
    find: jest.fn(),
  };

  const mockSettlementRepository = {
    find: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockSorobanService = {
    invokeContract: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationService,
        {
          provide: getRepositoryToken(ReconciliationReport),
          useValue: mockReportRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Bet),
          useValue: mockBetRepository,
        },
        {
          provide: getRepositoryToken(Match),
          useValue: mockMatchRepository,
        },
        {
          provide: getRepositoryToken(Settlement),
          useValue: mockSettlementRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: SorobanService,
          useValue: mockSorobanService,
        },
      ],
    }).compile();

    service = module.get<ReconciliationService>(ReconciliationService);
    reportRepository = module.get<Repository<ReconciliationReport>>(
      getRepositoryToken(ReconciliationReport),
    );
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getConfig', () => {
    it('should return default configuration when no env vars set', () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue: any) => defaultValue,
      );

      const config = (service as any).getConfig();

      expect(config.toleranceThreshold).toBe(0.00000001);
      expect(config.autoCorrectRoundingDifferences).toBe(true);
      expect(config.autoCorrectionThreshold).toBe(0.000001);
      expect(config.enableLedgerConsistencyCheck).toBe(true);
      expect(config.cronSchedule).toBe('0 */6 * * *');
      expect(config.notifyOnCriticalDiscrepancies).toBe(true);
    });

    it('should return configuration from environment variables', () => {
      mockConfigService.get
        .mockImplementationOnce(() => 0.0000001) // toleranceThreshold
        .mockImplementationOnce(() => false) // autoCorrectRoundingDifferences
        .mockImplementationOnce(() => 0.00001) // autoCorrectionThreshold
        .mockImplementationOnce(() => false) // enableLedgerConsistencyCheck
        .mockImplementationOnce(() => '0 0 * * *') // cronSchedule
        .mockImplementationOnce(() => false); // notifyOnCriticalDiscrepancies

      const config = (service as any).getConfig();

      expect(config.toleranceThreshold).toBe(0.0000001);
      expect(config.autoCorrectRoundingDifferences).toBe(false);
      expect(config.autoCorrectionThreshold).toBe(0.00001);
      expect(config.enableLedgerConsistencyCheck).toBe(false);
      expect(config.cronSchedule).toBe('0 0 * * *');
      expect(config.notifyOnCriticalDiscrepancies).toBe(false);
    });
  });

  describe('compareBalances', () => {
    it('should detect balance discrepancies', async () => {
      const mockUsers = [
        { id: 'user1', email: 'user1@example.com', walletBalance: 100 },
        { id: 'user2', email: 'user2@example.com', walletBalance: 50 },
      ];

      mockUserRepository.find.mockResolvedValue(mockUsers);
      (service as any).getOnChainBalances = jest.fn().mockResolvedValue({
        user1: 99.99999999, // Within tolerance
        user2: 49.5, // Outside tolerance
      });

      const config = {
        toleranceThreshold: 0.00000001,
        autoCorrectRoundingDifferences: true,
        autoCorrectionThreshold: 0.000001,
        enableLedgerConsistencyCheck: true,
        cronSchedule: '0 */6 * * *',
        notifyOnCriticalDiscrepancies: true,
      };

      const result = await (service as any).compareBalances(config);

      expect(result.discrepancies).toHaveLength(1);
      expect(result.discrepancies[0].userId).toBe('user2');
      expect(result.discrepancies[0].difference).toBe(0.5);
      expect(result.report.totalUsersChecked).toBe(2);
      expect(result.report.usersWithDiscrepancies).toBe(1);
      expect(result.report.usersWithinTolerance).toBe(1);
    });

    it('should identify rounding differences for auto-correction', async () => {
      const mockUsers = [
        { id: 'user1', email: 'user1@example.com', walletBalance: 100 },
      ];

      mockUserRepository.find.mockResolvedValue(mockUsers);
      (service as any).getOnChainBalances = jest.fn().mockResolvedValue({
        user1: 99.999999, // Small difference within auto-correction threshold
      });

      const config = {
        toleranceThreshold: 0.00000001,
        autoCorrectRoundingDifferences: true,
        autoCorrectionThreshold: 0.000001,
        enableLedgerConsistencyCheck: true,
        cronSchedule: '0 */6 * * *',
        notifyOnCriticalDiscrepancies: true,
      };

      const result = await (service as any).compareBalances(config);

      expect(result.discrepancies).toHaveLength(1);
      expect(result.discrepancies[0].difference).toBe(0.000001);
      expect(result.discrepancies[0].isWithinTolerance).toBe(false);
    });
  });

  describe('autoCorrectRoundingDifferences', () => {
    it('should auto-correct rounding differences when enabled', async () => {
      const discrepancies = [
        {
          userId: 'user1',
          userEmail: 'user1@example.com',
          backendBalance: 100,
          onchainBalance: 99.999999,
          difference: 0.000001,
          toleranceThreshold: 0.00000001,
          isWithinTolerance: false,
          discrepancyStatus: 'detected',
          detectedAt: new Date(),
        },
      ];

      const config = {
        toleranceThreshold: 0.00000001,
        autoCorrectRoundingDifferences: true,
        autoCorrectionThreshold: 0.000001,
        enableLedgerConsistencyCheck: true,
        cronSchedule: '0 */6 * * *',
        notifyOnCriticalDiscrepancies: true,
      };

      await (service as any).autoCorrectRoundingDifferences(
        discrepancies,
        config,
      );

      expect(discrepancies[0].discrepancyStatus).toBe('resolved');
      expect((discrepancies[0] as any).resolvedAt).toBeDefined();
      expect((discrepancies[0] as any).resolutionNotes).toBe(
        'Auto-corrected rounding difference',
      );
    });

    it('should not auto-correct when disabled', async () => {
      const discrepancies = [
        {
          userId: 'user1',
          userEmail: 'user1@example.com',
          backendBalance: 100,
          onchainBalance: 99.999999,
          difference: 0.000001,
          toleranceThreshold: 0.00000001,
          isWithinTolerance: false,
          discrepancyStatus: 'detected',
          detectedAt: new Date(),
        },
      ];

      const config = {
        toleranceThreshold: 0.00000001,
        autoCorrectRoundingDifferences: false,
        autoCorrectionThreshold: 0.000001,
        enableLedgerConsistencyCheck: true,
        cronSchedule: '0 */6 * * *',
        notifyOnCriticalDiscrepancies: true,
      };

      await (service as any).autoCorrectRoundingDifferences(
        discrepancies,
        config,
      );

      expect(discrepancies[0].discrepancyStatus).toBe('detected');
      expect((discrepancies[0] as any).resolvedAt).toBeUndefined();
    });
  });

  describe('runLedgerConsistencyReconciliation', () => {
    it('should create and complete a ledger consistency report', async () => {
      const mockReport = {
        id: 'test-report-id',
        status: 'running',
        type: ReportType.LEDGER_CONSISTENCY,
        startedAt: new Date(),
      };

      mockReportRepository.create.mockReturnValue(mockReport);
      mockReportRepository.save.mockResolvedValue(mockReport);
      mockUserRepository.find.mockResolvedValue([]);
      (service as any).getOnChainBalances = jest.fn().mockResolvedValue({});
      (service as any).autoCorrectRoundingDifferences = jest.fn();

      const config = {
        toleranceThreshold: 0.00000001,
        autoCorrectRoundingDifferences: true,
        autoCorrectionThreshold: 0.000001,
        enableLedgerConsistencyCheck: true,
        cronSchedule: '0 */6 * * *',
        notifyOnCriticalDiscrepancies: true,
      };

      const result = await service.runLedgerConsistencyReconciliation(config);

      expect(result.status).toBe('completed');
      expect(result.type).toBe(ReportType.LEDGER_CONSISTENCY);
      expect(result.completedAt).toBeDefined();
      expect(mockReportRepository.save).toHaveBeenCalledTimes(2); // Once for create, once for update
    });

    it('should handle errors gracefully', async () => {
      mockReportRepository.create.mockReturnValue({ id: 'test-report' });
      mockReportRepository.save.mockResolvedValue({ id: 'test-report' });
      mockUserRepository.find.mockRejectedValue(new Error('Database error'));

      const config = {
        toleranceThreshold: 0.00000001,
        autoCorrectRoundingDifferences: true,
        autoCorrectionThreshold: 0.000001,
        enableLedgerConsistencyCheck: true,
        cronSchedule: '0 */6 * * *',
        notifyOnCriticalDiscrepancies: true,
      };

      await expect(
        service.runLedgerConsistencyReconciliation(config),
      ).rejects.toThrow('Database error');

      expect(mockReportRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          errorMessage: 'Database error',
        }),
      );
    });
  });

  describe('runReconciliation', () => {
    it('should run full reconciliation with ledger consistency', async () => {
      const mockReport = { id: 'test-report', status: 'completed' };
      (service as any).runExistingChecks = jest
        .fn()
        .mockResolvedValue(mockReport);
      service.runLedgerConsistencyReconciliation = jest.fn().mockResolvedValue({
        ledgerMismatchCount: 1,
        onchainDiscrepancyCount: 1,
        offchainDiscrepancyCount: 0,
        roundingDifferenceCount: 0,
        totalInconsistencies: 1,
        totalUsersChecked: 10,
        usersWithDiscrepancies: 1,
        usersWithinTolerance: 9,
        totalDiscrepancyAmount: 0.5,
        averageDiscrepancy: 0.5,
        maxDiscrepancy: 0.5,
        minDiscrepancy: 0.5,
        ledgerConsistencyData: {},
        balanceDiscrepancies: [],
      });

      const dto = {
        type: ReportType.MANUAL,
        includeLedgerConsistency: true,
        config: {
          toleranceThreshold: 0.00000001,
          autoCorrectRoundingDifferences: true,
          autoCorrectionThreshold: 0.000001,
          enableLedgerConsistencyCheck: true,
          cronSchedule: '0 */6 * * *',
          notifyOnCriticalDiscrepancies: true,
        },
      };

      const result = await service.runReconciliation(dto);

      expect(result.ledgerMismatchCount).toBe(1);
      expect(result.totalUsersChecked).toBe(10);
      expect(result.usersWithDiscrepancies).toBe(1);
      expect(mockReportRepository.save).toHaveBeenCalled();
    });

    it('should run reconciliation without ledger consistency when disabled', async () => {
      const mockReport = { id: 'test-report', status: 'completed' };
      (service as any).runExistingChecks = jest
        .fn()
        .mockResolvedValue(mockReport);
      service.runLedgerConsistencyReconciliation = jest.fn();

      const dto = {
        type: ReportType.MANUAL,
        includeLedgerConsistency: false,
      };

      const result = await service.runReconciliation(dto);

      expect(service.runLedgerConsistencyReconciliation).not.toHaveBeenCalled();
      expect(result.id).toBe('test-report');
    });
  });
});
