import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException } from '@nestjs/common';

import { Player } from './entities/player.entity';
import { PlayersService } from './players.service';
import { RapidapiFootballService } from './services/rapidapi-football.service';
import { DebounceService } from './services/debounce.service';

describe('PlayersService', () => {
  let service: PlayersService;

  const playerEntity = {
    id: 'player-uuid',
    externalId: '276',
    name: 'Lionel Messi',
    firstName: 'Lionel',
    lastName: 'Messi',
    age: 36,
    nationality: 'Argentina',
    birthDate: new Date('1987-06-24'),
    birth: { date: '1987-06-24', place: 'Rosario', country: 'Argentina' },
    height: '170 cm',
    weight: '72 kg',
    photoUrl: 'https://media.api-sports.io/football/players/276.png',
    isActive: true,
  } as any;

  const apiPlayer = {
    id: 276,
    name: 'Lionel Messi',
    firstname: 'Lionel',
    lastname: 'Messi',
    age: 36,
    nationality: 'Argentina',
    birth: { date: '1987-06-24', place: 'Rosario', country: 'Argentina' },
    height: '170 cm',
    weight: '72 kg',
    injured: false,
    photo: 'https://media.api-sports.io/football/players/276.png',
  };

  const mockRepo = {
    findAndCount: jest.fn().mockResolvedValue([[playerEntity], 1]),
    findOne: jest.fn().mockResolvedValue(playerEntity),
    create: jest.fn().mockImplementation((dto) => ({ ...dto })),
    save: jest.fn().mockResolvedValue(playerEntity),
    remove: jest.fn().mockResolvedValue(undefined),
  };

  const mockRapidapi = {
    isConfigured: jest.fn().mockReturnValue(false),
    createFallbackPlayer: jest.fn().mockImplementation((q) => ({ id: 0, name: q })),
    searchPlayers: jest.fn().mockResolvedValue([apiPlayer]),
    createFallbackStatistics: jest.fn().mockReturnValue({ team: { id: 0, name: 'Unknown', logo: '' }, league: { id: 0, name: 'Unknown', country: 'Unknown', logo: '', flag: '', season: new Date().getFullYear() }, games: { appearences: 0, lineups: 0, minutes: 0, number: 0, position: 'Unknown', rating: '0.0', captain: false }, substitutes: { in: 0, out: 0, bench: 0 }, shots: { total: 0, on: 0 }, goals: { total: 0, conceded: 0, assists: 0, saves: 0 }, passes: { total: 0, key: 0, accuracy: '0%' }, tackles: { total: 0, blocks: 0, interceptions: 0 }, duels: { total: 0, won: 0 }, dribbles: { attempts: 0, success: 0, past: 0 }, fouls: { drawn: 0, committed: 0 }, cards: { yellow: 0, yellowred: 0, red: 0 }, penalty: { won: 0, commited: 0, scored: 0, missed: 0, saved: 0 } }),
    getPlayerStatistics: jest.fn().mockResolvedValue([{ team: { id: 1, name: 'Inter Miami', logo: '' }, league: { id: 253, name: 'MLS', country: 'USA', logo: '', flag: '', season: 2023 }, games: { appearences: 14, lineups: 14, minutes: 1179, number: 10, position: 'A', rating: '7.8', captain: false }, substitutes: { in: 0, out: 0, bench: 0 }, shots: { total: 52, on: 28 }, goals: { total: 11, conceded: 0, assists: 5, saves: 0 }, passes: { total: 826, key: 36, accuracy: '82' }, tackles: { total: 0, blocks: 0, interceptions: 0 }, duels: { total: 0, won: 0 }, dribbles: { attempts: 0, success: 0, past: 0 }, fouls: { drawn: 0, committed: 0 }, cards: { yellow: 0, yellowred: 0, red: 0 }, penalty: { won: 0, commited: 0, scored: 0, missed: 0, saved: 0 } }]),
    getPlayerTeamInfo: jest.fn().mockResolvedValue([{ team: { id: 541, name: 'Inter Miami', logo: '' }, league: 'MLS', season: 2023, position: 'Attacker', number: 10 }]),
    getPlayerById: jest.fn().mockResolvedValue(apiPlayer),
  };

  const mockDebounceService = {
    create: jest.fn().mockImplementation((fn) => fn),
  };

  const mockCache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlayersService,
        { provide: getRepositoryToken(Player), useValue: mockRepo },
        { provide: RapidapiFootballService, useValue: mockRapidapi },
        { provide: DebounceService, useValue: mockDebounceService },
        { provide: CACHE_MANAGER, useValue: mockCache },
      ],
    }).compile();

    service = module.get<PlayersService>(PlayersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should fallback on search when rapidapi not configured', async () => {
    mockRapidapi.isConfigured.mockReturnValue(false);
    const results = await service.searchPlayers({ query: 'messi', limit: 5 });
    expect(results).toEqual([{ id: 0, name: 'messi' }]);
    expect(mockRapidapi.createFallbackPlayer).toHaveBeenCalledWith('messi');
  });

  it('should get player statistics via rapidapi and cache it', async () => {
    mockRapidapi.isConfigured.mockReturnValue(true);
    mockCache.get.mockResolvedValue(null);

    const stats = await service.getPlayerStatistics({ playerId: 276 });
    expect(stats[0].team.name).toBe('Inter Miami');
    expect(mockRapidapi.getPlayerStatistics).toHaveBeenCalledWith(276, undefined, undefined);
    expect(mockCache.set).toHaveBeenCalled();
  });

  it('should return cached player statistics when available', async () => {
    const cached = [{ team: { id: 99, name: 'Cache Team', logo: '' }, league: { id: 99, name: 'Cache', country: 'N/A', logo: '', flag: '', season: 2023 }, games: { appearences: 0, lineups: 0, minutes: 0, number: 0, position: 'Unknown', rating: '0.0', captain: false }, substitutes: { in: 0, out: 0, bench: 0 }, shots: { total: 0, on: 0 }, goals: { total: 0, conceded: 0, assists: 0, saves: 0 }, passes: { total: 0, key: 0, accuracy: '0%' }, tackles: { total: 0, blocks: 0, interceptions: 0 }, duels: { total: 0, won: 0 }, dribbles: { attempts: 0, success: 0, past: 0 }, fouls: { drawn: 0, committed: 0 }, cards: { yellow: 0, yellowred: 0, red: 0 }, penalty: { won: 0, commited: 0, scored: 0, missed: 0, saved: 0 } }];
    mockCache.get.mockResolvedValue(cached);

    const stats = await service.getPlayerStatistics({ playerId: 276 });
    expect(stats).toBe(cached);
    expect(mockRapidapi.getPlayerStatistics).not.toHaveBeenCalled();
  });

  it('should get player age and nationality from rapidapi', async () => {
    mockRapidapi.isConfigured.mockReturnValue(true);
    const result = await service.getPlayerAgeAndNationality(276);
    expect(result).toEqual({ age: 36, nationality: 'Argentina', birthDate: '1987-06-24', birthPlace: 'Rosario' });
  });

  it('should return fallback avatar when no photo', async () => {
    mockRapidapi.getPlayerById.mockResolvedValue({ ...apiPlayer, photo: '' });
    const image = await service.getPlayerImage(276);
    expect(image).toContain('placeholder.com');
  });

  it('should save created player', async () => {
    const created = await service.createPlayer({ name: 'New Player', externalId: '999' } as any);
    expect(created).toEqual(playerEntity);
    expect(mockRepo.create).toHaveBeenCalledWith({ name: 'New Player', externalId: '999' });
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('should return paginated results', async () => {
    const data = await service.findAll(1, 10);
    expect(data.data).toEqual([playerEntity]);
    expect(data.total).toBe(1);
  });

  it('should throw not found for non-existent player', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('should update and remove player', async () => {
    mockRepo.findOne.mockResolvedValue(playerEntity);
    const updated = await service.update('player-uuid', { name: 'Updated' } as any);
    expect(updated).toEqual(playerEntity);

    await service.remove('player-uuid');
    expect(mockRepo.remove).toHaveBeenCalledWith(playerEntity);
  });

  it('should sync player from external API into new record', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    mockRapidapi.getPlayerById.mockResolvedValue(apiPlayer);
    const syncResult = await service.syncPlayerFromApi(276);
    expect(syncResult).toEqual(playerEntity);
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('should return null when syncing non-existing external player', async () => {
    mockRapidapi.getPlayerById.mockResolvedValue(null);
    const syncResult = await service.syncPlayerFromApi(999);
    expect(syncResult).toBeNull();
  });
});
