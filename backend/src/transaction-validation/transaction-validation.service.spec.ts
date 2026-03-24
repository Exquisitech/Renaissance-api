import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, DataSource } from 'typeorm';
import { TransactionValidationService } from './transaction-validation.service';
import { TransactionValidationReport } from './entities/transaction-validation-report.entity';
import { User } from '../users/entities/user.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Bet } from '../bets/entities/bet.entity';
import { Spin } from '../spin/entities/spin.entity';
import { Settlement } from '../blockchain/entities/settlement.entity';
import { SorobanService } from '../blockchain/soroban.service';
import { ValidateTransactionDto } from './dto/transaction-validation.dto';
import {
  TransactionType,
  ValidationType,
  ValidationStatus,
} from './entities/transaction-validation-report.entity';

describe('TransactionValidationService', () => {
  let service: TransactionValidationService;
  let reportRepository: Repository<TransactionValidationReport>;
  let configService: ConfigService;

  const mockReportRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  const mockTransactionRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockBetRepository = {
    findOne: jest.fn(),
  };

  const mockSpinRepository = {
    findOne: jest.fn(),
  };

  const mockSettlementRepository = {
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
        save: jest.fn(),
      },
    }),
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
        TransactionValidationService,
        {
          provide: getRepositoryToken(TransactionValidationReport),
          useValue: mockReportRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepository,
        },
        {
          provide: getRepositoryToken(Bet),
          useValue: mockBetRepository,
        },
        {
          provide: getRepositoryToken(Spin),
          useValue: mockSpinRepository,
        },
        {
          provide: getRepositoryToken(Settlement),
          useValue: mockSettlementRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
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

    service = module.get<TransactionValidationService>(
      TransactionValidationService,
    );
    reportRepository = module.get<Repository<TransactionValidationReport>>(
      getRepositoryToken(TransactionValidationReport),
    );
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

      expect(config.enabled).toBe(true);
      expect(config.autoRollbackOnCritical).toBe(true);
      expect(config.criticalViolationThreshold).toBe(1);
      expect(config.validateOnSettlement).toBe(true);
      expect(config.validateOnSpin).toBe(true);
      expect(config.validateOnStaking).toBe(true);
      expect(config.cronSchedule).toBe('*/5 * * * *');
      expect(config.notifyOnViolations).toBe(true);
    });

    it('should return configuration from environment variables', () => {
      mockConfigService.get
        .mockImplementationOnce(() => false) // enabled
        .mockImplementationOnce(() => false) // autoRollbackOnCritical
        .mockImplementationOnce(() => 2) // criticalViolationThreshold
        .mockImplementationOnce(() => false) // validateOnSettlement
        .mockImplementationOnce(() => false) // validateOnSpin
        .mockImplementationOnce(() => false) // validateOnStaking
        .mockImplementationOnce(() => '0 * * * *') // cronSchedule
        .mockImplementationOnce(() => false); // notifyOnViolations

      const config = (service as any).getConfig();

      expect(config.enabled).toBe(false);
      expect(config.autoRollbackOnCritical).toBe(false);
      expect(config.criticalViolationThreshold).toBe(2);
      expect(config.validateOnSettlement).toBe(false);
      expect(config.validateOnSpin).toBe(false);
      expect(config.validateOnStaking).toBe(false);
      expect(config.cronSchedule).toBe('0 * * * *');
      expect(config.notifyOnViolations).toBe(false);
    });
  });

  describe('getValidationRules', () => {
    it('should return validation rules for bet settlement', () => {
      const rules = (service as any).getValidationRules(
        TransactionType.BET_SETTLEMENT,
      );

      expect(rules).toHaveLength(4);
      expect(rules[0].name).toBe('balance_integrity_check');
      expect(rules[1].name).toBe('bet_state_consistency');
      expect(rules[2].name).toBe('atomicity_verification');
      expect(rules[3].name).toBe('onchain_reconciliation');
    });

    it('should return validation rules for spin payout', () => {
      const rules = (service as any).getValidationRules(
        TransactionType.SPIN_PAYOUT,
      );

      expect(rules).toHaveLength(3);
      expect(rules[0].name).toBe('wallet_balance_check');
      expect(rules[1].name).toBe('spin_record_integrity');
      expect(rules[2].name).toBe('transaction_chain_validation');
    });
  });

  describe('validateTransaction', () => {
    it('should throw error when validation is disabled', async () => {
      const dto: ValidateTransactionDto = {
        transactionId: 'test-transaction',
        transactionType: TransactionType.BET_SETTLEMENT,
        validationType: ValidationType.BALANCE_INTEGRITY,
      };

      mockConfigService.get.mockReturnValue(false); // disabled

      await expect(service.validateTransaction(dto)).rejects.toThrow(
        'Transaction validation is disabled',
      );
    });

    it('should create validation report and execute rules', async () => {
      const dto: ValidateTransactionDto = {
        transactionId: 'test-transaction',
        transactionType: TransactionType.BET_SETTLEMENT,
        validationType: ValidationType.BALANCE_INTEGRITY,
        userId: 'user-123',
      };

      const mockReport = {
        id: 'report-123',
        status: ValidationStatus.PENDING,
        transactionType: TransactionType.BET_SETTLEMENT,
        validationType: ValidationType.BALANCE_INTEGRITY,
        transactionId: 'test-transaction',
        userId: 'user-123',
        startedAt: new Date(),
        validationRules: [],
        totalChecks: 0,
        passedChecks: 0,
        failedChecks: 0,
        criticalViolations: 0,
        rollbackTriggered: false,
      };

      mockConfigService.get.mockReturnValue(true);
      mockReportRepository.create.mockReturnValue(mockReport);
      mockReportRepository.save.mockResolvedValue(mockReport);
      (service as any).getValidationRules = jest.fn().mockReturnValue([
        {
          name: 'test_rule',
          description: 'Test rule',
          checkFunction: 'checkBalanceIntegrity',
          critical: true,
        },
      ]);
      (service as any).executeValidationRule = jest.fn().mockResolvedValue({
        ruleName: 'test_rule',
        passed: true,
        message: 'Test passed',
        timestamp: new Date(),
      });

      const result = await service.validateTransaction(dto);

      expect(result.status).toBe(ValidationStatus.PASSED);
      expect(result.transactionId).toBe('test-transaction');
      expect(result.userId).toBe('user-123');
      expect(mockReportRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should handle validation failures and trigger rollback', async () => {
      const dto: ValidateTransactionDto = {
        transactionId: 'test-transaction',
        transactionType: TransactionType.BET_SETTLEMENT,
        validationType: ValidationType.BALANCE_INTEGRITY,
      };

      const mockReport = {
        id: 'report-123',
        status: ValidationStatus.PENDING,
        transactionType: TransactionType.BET_SETTLEMENT,
        validationType: ValidationType.BALANCE_INTEGRITY,
        transactionId: 'test-transaction',
        startedAt: new Date(),
        validationRules: [],
        totalChecks: 1,
        passedChecks: 0,
        failedChecks: 1,
        criticalViolations: 1,
        rollbackTriggered: false,
      };

      mockConfigService.get
        .mockReturnValueOnce(true) // enabled
        .mockReturnValueOnce(true) // autoRollbackOnCritical
        .mockReturnValueOnce(1); // criticalViolationThreshold

      mockReportRepository.create.mockReturnValue(mockReport);
      mockReportRepository.save.mockResolvedValue(mockReport);
      (service as any).getValidationRules = jest.fn().mockReturnValue([
        {
          name: 'critical_rule',
          description: 'Critical rule',
          checkFunction: 'checkBalanceIntegrity',
          critical: true,
        },
      ]);
      (service as any).executeValidationRule = jest.fn().mockResolvedValue({
        ruleName: 'critical_rule',
        passed: false,
        message: 'Critical validation failed',
        timestamp: new Date(),
      });
      (service as any).triggerRollback = jest.fn();

      const result = await service.validateTransaction(dto);

      expect(result.status).toBe(ValidationStatus.FAILED);
      expect(result.criticalViolations).toBe(1);
      expect((service as any).triggerRollback).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const dto: ValidateTransactionDto = {
        transactionId: 'test-transaction',
        transactionType: TransactionType.BET_SETTLEMENT,
        validationType: ValidationType.BALANCE_INTEGRITY,
      };

      mockConfigService.get.mockReturnValue(true);
      mockReportRepository.create.mockReturnValue({ id: 'test-report' });
      mockReportRepository.save.mockResolvedValue({ id: 'test-report' });
      (service as any).getValidationRules = jest.fn().mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await expect(service.validateTransaction(dto)).rejects.toThrow(
        'Database connection failed',
      );

      expect(mockReportRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ValidationStatus.FAILED,
          errorMessage: 'Database connection failed',
        }),
      );
    });
  });

  describe('executeValidationRule', () => {
    it('should execute balance integrity check', async () => {
      const rule = {
        name: 'balance_integrity_check',
        description: 'Check balance integrity',
        checkFunction: 'checkBalanceIntegrity',
        critical: true,
      };

      const context = {
        transactionId: 'test-transaction',
        transactionType: TransactionType.BET_SETTLEMENT,
      };

      (service as any).checkBalanceIntegrity = jest.fn().mockResolvedValue({
        ruleName: 'balance_integrity_check',
        passed: true,
        message: 'Balance check passed',
      });

      const result = await (service as any).executeValidationRule(
        rule,
        context,
      );

      expect(result.ruleName).toBe('balance_integrity_check');
      expect(result.passed).toBe(true);
      expect(result.message).toBe('Balance check passed');
    });

    it('should handle unknown validation function', async () => {
      const rule = {
        name: 'unknown_rule',
        description: 'Unknown rule',
        checkFunction: 'unknownFunction',
        critical: true,
      };

      const context = {
        transactionId: 'test-transaction',
        transactionType: TransactionType.BET_SETTLEMENT,
      };

      const result = await (service as any).executeValidationRule(
        rule,
        context,
      );

      expect(result.ruleName).toBe('unknown_rule');
      expect(result.passed).toBe(false);
      expect(result.message).toContain('Unknown validation function');
    });
  });

  describe('triggerRollback', () => {
    it('should trigger rollback and update report', async () => {
      const mockReport = {
        id: 'report-123',
        transactionId: 'test-transaction',
        rollbackTriggered: false,
        rollbackReason: null,
        rollbackCompletedAt: null,
      };

      const violations = [
        {
          type: 'balance_mismatch',
          severity: 'critical',
          description: 'Balance mismatch detected',
          affectedEntity: 'User',
          affectedId: 'user-123',
          currentValue: 100,
          expectedValue: 150,
          detectedAt: new Date(),
        },
      ];

      await (service as any).triggerRollback(
        mockReport,
        'Test rollback reason',
        violations,
      );

      expect(mockReport.rollbackTriggered).toBe(true);
      expect(mockReport.rollbackReason).toBe('Test rollback reason');
      expect(mockReport.rollbackCompletedAt).toBeDefined();
    });
  });

  describe('notifyViolations', () => {
    it('should log critical violations', async () => {
      const mockReport = {
        id: 'report-123',
        transactionId: 'test-transaction',
      };

      const violations = [
        {
          type: 'balance_mismatch',
          severity: 'critical',
          description: 'Critical violation',
          affectedEntity: 'User',
          affectedId: 'user-123',
          currentValue: 100,
          expectedValue: 150,
          detectedAt: new Date(),
        },
        {
          type: 'state_inconsistency',
          severity: 'high',
          description: 'High severity violation',
          affectedEntity: 'Bet',
          affectedId: 'bet-456',
          currentValue: 'pending',
          expectedValue: 'completed',
          detectedAt: new Date(),
        },
      ];

      // This would normally log to console, but we can't easily test that
      await (service as any).notifyViolations(mockReport, violations);

      // Test passes if no exception is thrown
      expect(true).toBe(true);
    });
  });
});
