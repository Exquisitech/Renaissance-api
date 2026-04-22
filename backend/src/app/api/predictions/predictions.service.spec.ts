import { Test, TestingModule } from '@nestjs/testing';
import { AiPredictionService } from './ai-prediction.service';

describe('AiPredictionService', () => {
  let service: AiPredictionService;

  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiPredictionService,
        {
          provide: 'REDIS_CLIENT', // or RedisService token used in your app
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<AiPredictionService>(AiPredictionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should generate prediction with confidence and reasoning', async () => {
    const result = await service.predictMatch('match123', {
      teams: ['A', 'B'],
    });

    expect(result.matchId).toBe('match123');
    expect(result.outcome).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.reasoning).toBeDefined();
  });

  it('should cache predictions', async () => {
    await service.predictMatch('match123', {
      teams: ['A', 'B'],
    });

    expect(mockRedis.set).toHaveBeenCalledWith(
      'prediction:match123',
      expect.any(String),
      expect.any(Number), // TTL if used
    );
  });
});