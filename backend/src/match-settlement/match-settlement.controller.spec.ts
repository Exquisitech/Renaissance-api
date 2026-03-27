import { Test, TestingModule } from '@nestjs/testing';
import { MatchSettlementController } from './match-settlement.controller';
import { MatchSettlementService } from './match-settlement.service';

describe('MatchSettlementController', () => {
  let controller: MatchSettlementController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MatchSettlementController],
      providers: [MatchSettlementService],
    }).compile();

    controller = module.get<MatchSettlementController>(MatchSettlementController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
