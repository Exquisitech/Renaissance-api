import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventBus } from '@nestjs/cqrs';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { Match } from './entities/match.entity';
import { MatchStatus, MatchOutcome } from '../../common/enums/match.enums';
import { CacheInvalidationService } from '../../common/cache/cache-invalidation.service';
import { OddsService } from '../../odds/odds.service';
import { MatchFinishedEvent } from './events/match-finished.event';

describe('MatchesService', () => {
  let service: MatchesService;
  let matchRepository: Repository<Match>;
  let cacheInvalidationService: CacheInvalidationService;
  let eventBus: EventBus;
  let oddsService: OddsService;

  const mockMatchRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockCacheInvalidationService = {
    invalidatePattern: jest.fn(),
  };

  const mockEventBus = {
    publish: jest.fn(),
  };

  const mockOddsService = {
    handleDirectMatchOddsUpdate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesService,
        {
          provide: getRepositoryToken(Match),
          useValue: mockMatchRepository,
        },
        {
          provide: CacheInvalidationService,
          useValue: mockCacheInvalidationService,
        },
        {
          provide: EventBus,
          useValue: mockEventBus,
        },
        {
          provide: OddsService,
          useValue: mockOddsService,
        },
      ],
    }).compile();

    service = module.get<MatchesService>(MatchesService);
    matchRepository = module.get<Repository<Match>>(getRepositoryToken(Match));
    cacheInvalidationService = module.get<CacheInvalidationService>(CacheInvalidationService);
    eventBus = module.get<EventBus>(EventBus);
    oddsService = module.get<OddsService>(OddsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createMatch', () => {
    const createMatchDto = {
      homeTeam: 'Team A',
      awayTeam: 'Team B',
      startTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      league: 'Premier League',
      season: '2024',
      homeOdds: 2.5,
      drawOdds: 3.0,
      awayOdds: 3.5,
    };

    const mockMatch = {
      id: 'match-123',
      ...createMatchDto,
      status: MatchStatus.UPCOMING,
    };

    beforeEach(() => {
      mockMatchRepository.create.mockReturnValue(mockMatch);
      mockMatchRepository.save.mockResolvedValue(mockMatch);
    });

    it('should create a match successfully', async () => {
      const result = await service.createMatch(createMatchDto);

      expect(mockMatchRepository.create).toHaveBeenCalledWith({
        ...createMatchDto,
        status: MatchStatus.UPCOMING,
      });
      expect(mockMatchRepository.save).toHaveBeenCalledWith(mockMatch);
      expect(result).toEqual(mockMatch);
    });

    it('should throw BadRequestException for past start time', async () => {
      const pastMatchDto = {
        ...createMatchDto,
        startTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      };

      await expect(service.createMatch(pastMatchDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for same home and away teams', async () => {
      const sameTeamDto = {
        ...createMatchDto,
        awayTeam: 'Team A',
      };

      await expect(service.createMatch(sameTeamDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getMatchById', () => {
    const matchId = 'match-123';
    const mockMatch = {
      id: matchId,
      homeTeam: 'Team A',
      awayTeam: 'Team B',
      status: MatchStatus.UPCOMING,
    };

    it('should return match if found', async () => {
      mockMatchRepository.findOne.mockResolvedValue(mockMatch);

      const result = await service.getMatchById(matchId);

      expect(mockMatchRepository.findOne).toHaveBeenCalledWith({
        where: { id: matchId },
      });
      expect(result).toEqual(mockMatch);
    });

    it('should throw NotFoundException if match not found', async () => {
      mockMatchRepository.findOne.mockResolvedValue(null);

      await expect(service.getMatchById(matchId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getMatches', () => {
    const page = 1;
    const limit = 10;

    const mockMatches = [
      {
        id: 'match-1',
        homeTeam: 'Team A',
        awayTeam: 'Team B',
        status: MatchStatus.UPCOMING,
      },
      {
        id: 'match-2',
        homeTeam: 'Team C',
        awayTeam: 'Team D',
        status: MatchStatus.UPCOMING,
      },
    ];

    const mockQueryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(2),
      getMany: jest.fn().mockResolvedValue(mockMatches),
    };

    beforeEach(() => {
      mockMatchRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    });

    it('should return paginated matches', async () => {
      const result = await service.getMatches(page, limit);

      expect(mockMatchRepository.createQueryBuilder).toHaveBeenCalledWith('match');
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('match.startTime', 'ASC');
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(limit);
      expect(result).toEqual({
        data: mockMatches,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should apply filters correctly', async () => {
      const filters = {
        status: MatchStatus.UPCOMING,
        league: 'Premier League',
        homeTeam: 'Team A',
      };

      await service.getMatches(page, limit, filters);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('match.status = :status', {
        status: MatchStatus.UPCOMING,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('match.league = :league', {
        league: 'Premier League',
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('match.homeTeam ILIKE :homeTeam', {
        homeTeam: '%Team A%',
      });
    });

    it('should throw BadRequestException for invalid page', async () => {
      await expect(service.getMatches(0, limit)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for invalid limit', async () => {
      await expect(service.getMatches(page, 0)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getMatches(page, 101)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateMatch', () => {
    const matchId = 'match-123';
    const updateDto = {
      homeScore: 2,
      awayScore: 1,
      status: MatchStatus.FINISHED,
    };

    const mockMatch = {
      id: matchId,
      homeTeam: 'Team A',
      awayTeam: 'Team B',
      status: MatchStatus.LIVE,
      homeOdds: 2.5,
      drawOdds: 3.0,
      awayOdds: 3.5,
    };

    const updatedMatch = {
      ...mockMatch,
      ...updateDto,
      outcome: MatchOutcome.HOME_WIN,
    };

    beforeEach(() => {
      mockMatchRepository.findOne.mockResolvedValue(mockMatch);
      mockMatchRepository.save.mockResolvedValue(updatedMatch);
    });

    it('should update match successfully', async () => {
      const result = await service.updateMatch(matchId, updateDto);

      expect(mockMatchRepository.save).toHaveBeenCalled();
      expect(mockCacheInvalidationService.invalidatePattern).toHaveBeenCalledWith('matches*');
      expect(mockOddsService.handleDirectMatchOddsUpdate).toHaveBeenCalled();
      expect(result).toEqual(updatedMatch);
    });

    it('should publish MatchFinishedEvent when match finishes', async () => {
      await service.updateMatch(matchId, updateDto);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.any(MatchFinishedEvent),
      );
    });

    it('should throw BadRequestException for invalid status transition', async () => {
      const invalidUpdate = { status: MatchStatus.UPCOMING };
      const finishedMatch = { ...mockMatch, status: MatchStatus.FINISHED };

      mockMatchRepository.findOne.mockResolvedValue(finishedMatch);

      await expect(service.updateMatch(matchId, invalidUpdate)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException when finishing match without scores', async () => {
      const updateWithoutScores = { status: MatchStatus.FINISHED };

      await expect(service.updateMatch(matchId, updateWithoutScores)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateMatchStatus', () => {
    const matchId = 'match-123';
    const updateStatusDto = {
      status: MatchStatus.FINISHED,
      homeScore: 2,
      awayScore: 1,
    };

    const mockMatch = {
      id: matchId,
      status: MatchStatus.LIVE,
      homeOdds: 2.5,
      drawOdds: 3.0,
      awayOdds: 3.5,
    };

    const updatedMatch = {
      ...mockMatch,
      ...updateStatusDto,
      outcome: MatchOutcome.HOME_WIN,
    };

    beforeEach(() => {
      mockMatchRepository.findOne.mockResolvedValue(mockMatch);
      mockMatchRepository.save.mockResolvedValue(updatedMatch);
    });

    it('should update match status successfully', async () => {
      const result = await service.updateMatchStatus(matchId, updateStatusDto);

      expect(mockMatchRepository.save).toHaveBeenCalled();
      expect(mockCacheInvalidationService.invalidatePattern).toHaveBeenCalledWith('matches*');
      expect(result).toEqual(updatedMatch);
    });

    it('should throw BadRequestException when finishing without scores', async () => {
      const updateWithoutScores = { status: MatchStatus.FINISHED };

      await expect(service.updateMatchStatus(matchId, updateWithoutScores)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('deleteMatch', () => {
    const matchId = 'match-123';

    const mockMatch = {
      id: matchId,
      status: MatchStatus.UPCOMING,
    };

    beforeEach(() => {
      mockMatchRepository.findOne.mockResolvedValue(mockMatch);
      mockMatchRepository.save.mockResolvedValue({ ...mockMatch, status: MatchStatus.CANCELLED });
    });

    it('should cancel match successfully', async () => {
      const result = await service.deleteMatch(matchId);

      expect(mockMatchRepository.save).toHaveBeenCalledWith({
        ...mockMatch,
        status: MatchStatus.CANCELLED,
      });
      expect(mockCacheInvalidationService.invalidatePattern).toHaveBeenCalledWith('matches*');
      expect(result).toEqual({
        message: `Match ${matchId} has been cancelled`,
      });
    });

    it('should throw BadRequestException for live match', async () => {
      const liveMatch = { ...mockMatch, status: MatchStatus.LIVE };
      mockMatchRepository.findOne.mockResolvedValue(liveMatch);

      await expect(service.deleteMatch(matchId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getUpcomingMatches', () => {
    it('should call getMatches with upcoming status filter', async () => {
      const mockResult = {
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      };

      const getMatchesSpy = jest.spyOn(service, 'getMatches').mockResolvedValue(mockResult);

      const result = await service.getUpcomingMatches(1, 10);

      expect(getMatchesSpy).toHaveBeenCalledWith(1, 10, {
        status: MatchStatus.UPCOMING,
        startTimeFrom: expect.any(Date),
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('getLiveMatches', () => {
    it('should return live matches', async () => {
      const mockMatches = [
        { id: 'match-1', status: MatchStatus.LIVE },
        { id: 'match-2', status: MatchStatus.LIVE },
      ];

      const mockResult = {
        data: mockMatches,
        total: 2,
        page: 1,
        limit: 100,
        totalPages: 1,
      };

      const getMatchesSpy = jest.spyOn(service, 'getMatches').mockResolvedValue(mockResult);

      const result = await service.getLiveMatches();

      expect(getMatchesSpy).toHaveBeenCalledWith(1, 100, {
        status: MatchStatus.LIVE,
      });
      expect(result).toEqual(mockMatches);
    });
  });

  describe('getFinishedMatches', () => {
    it('should call getMatches with finished status filter', async () => {
      const mockResult = {
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      };

      const getMatchesSpy = jest.spyOn(service, 'getMatches').mockResolvedValue(mockResult);

      const result = await service.getFinishedMatches(1, 10);

      expect(getMatchesSpy).toHaveBeenCalledWith(1, 10, {
        status: MatchStatus.FINISHED,
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('validateStatusTransition', () => {
    it('should allow valid transitions', () => {
      expect(() => service['validateStatusTransition'](MatchStatus.UPCOMING, MatchStatus.LIVE)).not.toThrow();
      expect(() => service['validateStatusTransition'](MatchStatus.LIVE, MatchStatus.FINISHED)).not.toThrow();
      expect(() => service['validateStatusTransition'](MatchStatus.POSTPONED, MatchStatus.UPCOMING)).not.toThrow();
    });

    it('should throw ConflictException for invalid transitions', () => {
      expect(() => service['validateStatusTransition'](MatchStatus.FINISHED, MatchStatus.LIVE)).toThrow(ConflictException);
      expect(() => service['validateStatusTransition'](MatchStatus.CANCELLED, MatchStatus.UPCOMING)).toThrow(ConflictException);
    });
  });

  describe('calculateOutcome', () => {
    it('should calculate home win correctly', () => {
      const result = service['calculateOutcome'](2, 1);
      expect(result).toBe(MatchOutcome.HOME_WIN);
    });

    it('should calculate away win correctly', () => {
      const result = service['calculateOutcome'](1, 2);
      expect(result).toBe(MatchOutcome.AWAY_WIN);
    });

    it('should calculate draw correctly', () => {
      const result = service['calculateOutcome'](1, 1);
      expect(result).toBe(MatchOutcome.DRAW);
    });
  });
});</content>
<parameter name="filePath">c:\Users\u-adamu\Desktop\wave 2\Renaissance-api\backend\src\matches\matches.service.spec.ts