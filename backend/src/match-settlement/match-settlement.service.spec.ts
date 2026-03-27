import { Test, TestingModule } from '@nestjs/testing';
import { MatchSettlementService } from './match-settlement.service';

describe('MatchSettlementService', () => {
  let service: MatchSettlementService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MatchSettlementService],
    }).compile();

    service = module.get<MatchSettlementService>(MatchSettlementService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
