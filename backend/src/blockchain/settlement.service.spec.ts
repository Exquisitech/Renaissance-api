import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SettlementService } from './settlement.service';
import { SorobanService } from './soroban.service';
import { Settlement, SettlementStatus } from './entities/settlement.entity';

describe('SettlementService', () => {
  let service: SettlementService;
  let sorobanService: SorobanService;
  let repoMock: any;

  beforeEach(async () => {
    repoMock = {
        findOne: jest.fn(),
        create: jest.fn().mockImplementation((dto) => dto),
        save: jest.fn().mockImplementation((entity) => Promise.resolve({ ...entity, id: 'uuid' })),
        find: jest.fn(),
    };

    const sorobanMock = {
        invokeContract: jest.fn().mockResolvedValue('mock_tx_hash'),
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
      
      expect(repoMock.findOne).toHaveBeenCalledWith({ where: { referenceId: 'settle_bet123' } });
      expect(repoMock.create).toHaveBeenCalled();
      expect(sorobanService.invokeContract).toHaveBeenCalledWith('settle', ['bet123', 'WIN', '100']);
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
});
