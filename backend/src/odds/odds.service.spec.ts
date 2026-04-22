import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { OddsService } from './odds.service';
import { Match, MatchStatus } from '../matches/entities/match.entity';
import { Bet } from '../bets/entities/bet.entity';
import { MatchOddsHistory, OddsUpdateSource } from './entities/match-odds-history.entity';
import { CacheInvalidationService } from '../common/cache/cache-invalidation.service';
import { OddsRealtimeService } from './odds-realtime.service';

describe('OddsService', () => {
  let service: OddsService;
  let matchRepository: any;
  let historyRepository: any;
  let cacheManager: any;
  let realtimeService: any;

  beforeEach(async () => {
    matchRepository = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (entity) => entity),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    historyRepository = {
      create: jest.fn().mockImplementation((entity) => entity),
      save: jest.fn().mockImplementation(async (entity) => entity),
      find: jest.fn().mockResolvedValue([]),
    };
    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };
    realtimeService = {
      broadcast: jest.fn(),
      getWebSocketPath: jest.fn().mockReturnValue('/api/v1/odds/ws'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OddsService,
        {
          provide: getRepositoryToken(Match),
          useValue: matchRepository,
        },
        {
          provide: getRepositoryToken(Bet),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              addSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              groupBy: jest.fn().mockReturnThis(),
              getRawMany: jest.fn().mockResolvedValue([]),
            }),
          },
        },
        {
          provide: getRepositoryToken(MatchOddsHistory),
          useValue: historyRepository,
        },
        {
          provide: CACHE_MANAGER,
          useValue: cacheManager,
        },
        {
          provide: CacheInvalidationService,
          useValue: {
            invalidatePattern: jest.fn(),
          },
        },
        {
          provide: OddsRealtimeService,
          useValue: realtimeService,
        },
      ],
    }).compile();

    service = module.get<OddsService>(OddsService);
  });

  it('should store history, cache, and broadcast on manual odds updates', async () => {
    matchRepository.findOne.mockResolvedValue({
      id: 'match-1',
      homeTeam: 'Team A',
      awayTeam: 'Team B',
      status: MatchStatus.UPCOMING,
      homeOdds: 1.8,
      drawOdds: 3.2,
      awayOdds: 4.1,
      updatedAt: new Date('2026-03-24T10:00:00.000Z'),
    });

    const snapshot = await service.updateOdds(
      'match-1',
      {
        homeOdds: 1.7,
        drawOdds: 3.3,
        awayOdds: 4.4,
        reason: 'manual_adjustment',
      },
      {
        source: OddsUpdateSource.MANUAL,
        changedByUserId: 'admin-1',
        reason: 'manual_adjustment',
      },
    );

    expect(historyRepository.save).toHaveBeenCalled();
    expect(cacheManager.set).toHaveBeenCalled();
    expect(realtimeService.broadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'odds.updated',
        matchId: 'match-1',
      }),
    );
    expect(snapshot).toEqual(
      expect.objectContaining({
        matchId: 'match-1',
        homeOdds: 1.7,
        drawOdds: 3.3,
        awayOdds: 4.4,
      }),
    );
  });
});
