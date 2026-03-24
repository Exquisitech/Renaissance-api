import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SettlementService } from './settlement.service';
import { SorobanService } from './soroban.service';
import { Settlement, SettlementStatus } from './entities/settlement.entity';
import { rpc } from '@stellar/stellar-sdk';

describe('SettlementService', () => {
  let service: SettlementService;
  let sorobanService: SorobanService;
  let repoMock: any;

  beforeEach(async () => {
    repoMock = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest
        .fn()
        .mockImplementation((entity) =>
          Promise.resolve({ ...entity, id: 'uuid' }),
        ),
      find: jest.fn(),
    };

    const sorobanMock = {
        invokeContract: jest.fn().mockResolvedValue('mock_tx_hash'),
        getTransactionStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementService,
        {
          provide: SorobanService,
          useValue: sorobanMock,
        },
        {
          provide: getRepositoryToken(Settlement),
          useValue: repoMock,
        },
      ],
    }).compile();

    service = module.get<SettlementService>(SettlementService);
    sorobanService = module.get<SorobanService>(SorobanService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should settle a bet correctly', async () => {
    await service.settleBet('bet123', 'WIN', 100);

    expect(repoMock.findOne).toHaveBeenCalledWith({
      where: { referenceId: 'settle_bet123' },
    });
    expect(repoMock.create).toHaveBeenCalled();
    expect(sorobanService.invokeContract).toHaveBeenCalledWith('settle', [
      'bet123',
      'WIN',
      '100',
    ]);
    expect(repoMock.save).toHaveBeenCalledTimes(2); // Initial save, then update with hash
  });

  it('should handle idempotency (already confirmed)', async () => {
    repoMock.findOne.mockResolvedValue({
      status: SettlementStatus.CONFIRMED,
      referenceId: 'settle_bet123',
    });

    const result = await service.settleBet('bet123', 'WIN', 100);
    expect(result.status).toBe(SettlementStatus.CONFIRMED);
    expect(sorobanService.invokeContract).not.toHaveBeenCalled();
  });

  it('should handle idempotency (pending)', async () => {
    repoMock.findOne.mockResolvedValue({
      status: SettlementStatus.PENDING,
      referenceId: 'settle_bet123',
    });

    const result = await service.settleBet('bet123', 'WIN', 100);
    expect(result.status).toBe(SettlementStatus.PENDING);
    expect(sorobanService.invokeContract).not.toHaveBeenCalled();
  });

  it('should mark pending settlements as confirmed when on-chain tx succeeds', async () => {
      repoMock.find.mockResolvedValue([
        { id: 'settlement-1', txHash: 'hash-1', status: SettlementStatus.PENDING },
      ]);
      (sorobanService.getTransactionStatus as jest.Mock).mockResolvedValue({
        status: rpc.Api.GetTransactionStatus.SUCCESS,
      });

      await service.reconcile();

      expect(sorobanService.getTransactionStatus).toHaveBeenCalledWith('hash-1');
      expect(repoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: SettlementStatus.CONFIRMED }),
      );
  });

  it('should mark pending settlements as failed when on-chain tx fails', async () => {
      repoMock.find.mockResolvedValue([
        { id: 'settlement-1', txHash: 'hash-1', status: SettlementStatus.PENDING },
      ]);
      (sorobanService.getTransactionStatus as jest.Mock).mockResolvedValue({
        status: rpc.Api.GetTransactionStatus.FAILED,
      });

      await service.reconcile();

      expect(repoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: SettlementStatus.FAILED }),
      );
  });
});
