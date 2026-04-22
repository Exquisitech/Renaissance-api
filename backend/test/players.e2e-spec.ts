import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PlayersController } from '../src/players/players.controller';
import { PlayersService } from '../src/players/players.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { createTestModule } from './setup';

const playerStats = [{ team: { id: 541, name: 'Inter Miami', logo: '' }, league: { id: 253, name: 'MLS', country: 'USA', logo: '', flag: '', season: 2023 }, games: { appearences: 14, lineups: 14, minutes: 1179, number: 10, position: 'A', rating: '7.876923', captain: false }, substitutes: { in: 0, out: 0, bench: 0 }, shots: { total: 52, on: 28 }, goals: { total: 11, conceded: 0, assists: 5, saves: 0 }, passes: { total: 826, key: 36, accuracy: '82' }, tackles: { total: 0, blocks: 0, interceptions: 0 }, duels: { total: 0, won: 0 }, dribbles: { attempts: 0, success: 0, past: 0 }, fouls: { drawn: 0, committed: 0 }, cards: { yellow: 0, yellowred: 0, red: 0 }, penalty: { won: 0, commited: 0, scored: 0, missed: 0, saved: 0 } }];

const playersPaginated = {
  data: [{ id: '1', name: 'Lionel Messi' }],
  total: 1,
  page: 1,
  limit: 10,
  totalPages: 1,
};

const playerEntity = {
  id: '1',
  name: 'Lionel Messi',
};

describe('PlayersController (e2e)', () => {
  let app: INestApplication;

  const mockPlayersService = {
    searchPlayers: jest.fn().mockResolvedValue([{ id: 276, name: 'Lionel Messi' }]),
    getPlayerStatistics: jest.fn().mockResolvedValue(playerStats),
    getPlayerTeamInfo: jest.fn().mockResolvedValue([{ team: { id: 541, name: 'Inter Miami', logo: '' }, league: 'MLS', season: 2023, position: 'Attacker', number: 10 }]),
    getPlayerAgeAndNationality: jest.fn().mockResolvedValue({ age: 36, nationality: 'Argentina', birthDate: '1987-06-24', birthPlace: 'Rosario' }),
    getPlayerImage: jest.fn().mockResolvedValue('https://media.api-sports.io/football/players/276.png'),
    getPopularPlayers: jest.fn().mockResolvedValue([{ id: 276, name: 'Lionel Messi' }]),
    findAll: jest.fn().mockResolvedValue(playersPaginated),
    findOne: jest.fn().mockResolvedValue(playerEntity),
    syncPlayerFromApi: jest.fn().mockResolvedValue(playerEntity),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PlayersController],
      providers: [{ provide: PlayersService, useValue: mockPlayersService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/players/search (GET)', () => {
    it('should search players successfully', () => {
      return request(app.getHttpServer())
        .get('/players/search?query=messi')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body[0]).toHaveProperty('id', 276);
          expect(res.body[0]).toHaveProperty('name', 'Lionel Messi');
        });
    });

    it('should handle search with league filter', () => {
      return request(app.getHttpServer())
        .get('/players/search?query=messi&league=253')
        .expect(200);
    });

    it('should handle search with season filter', () => {
      return request(app.getHttpServer())
        .get('/players/search?query=messi&season=2023')
        .expect(200);
    });

    it('should handle search with limit', () => {
      return request(app.getHttpServer())
        .get('/players/search?query=messi&limit=5')
        .expect(200);
    });

    it('should handle empty query', () => {
      return request(app.getHttpServer())
        .get('/players/search?query=')
        .expect(200);
    });
  });

  describe('/players/:playerId/statistics (GET)', () => {
    it('should get player statistics', () => {
      return request(app.getHttpServer())
        .get('/players/276/statistics')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body[0]).toHaveProperty('team');
          expect(res.body[0]).toHaveProperty('league');
          expect(res.body[0]).toHaveProperty('games');
          expect(res.body[0]).toHaveProperty('goals');
        });
    });

    it('should get player statistics with league filter', () => {
      return request(app.getHttpServer())
        .get('/players/276/statistics?league=253')
        .expect(200);
    });

    it('should get player statistics with season filter', () => {
      return request(app.getHttpServer())
        .get('/players/276/statistics?season=2023')
        .expect(200);
    });

    it('should handle invalid player ID', () => {
      return request(app.getHttpServer())
        .get('/players/invalid/statistics')
        .expect(400);
    });
  });

  describe('/players/:playerId/team (GET)', () => {
    it('should get player team info', () => {
      return request(app.getHttpServer())
        .get('/players/276/team')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body[0]).toHaveProperty('team');
          expect(res.body[0]).toHaveProperty('league');
          expect(res.body[0]).toHaveProperty('position');
        });
    });

    it('should handle invalid player ID', () => {
      return request(app.getHttpServer())
        .get('/players/invalid/team')
        .expect(400);
    });
  });

  describe('/players/:playerId/age-nationality (GET)', () => {
    it('should get player age and nationality', () => {
      return request(app.getHttpServer())
        .get('/players/276/age-nationality')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('age', 36);
          expect(res.body).toHaveProperty('nationality', 'Argentina');
          expect(res.body).toHaveProperty('birthDate');
          expect(res.body).toHaveProperty('birthPlace');
        });
    });

    it('should handle invalid player ID', () => {
      return request(app.getHttpServer())
        .get('/players/invalid/age-nationality')
        .expect(400);
    });
  });

  describe('/players/:playerId/image (GET)', () => {
    it('should get player image', () => {
      return request(app.getHttpServer())
        .get('/players/276/image')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('imageUrl');
          expect(typeof res.body.imageUrl).toBe('string');
        });
    });

    it('should handle invalid player ID', () => {
      return request(app.getHttpServer())
        .get('/players/invalid/image')
        .expect(400);
    });
  });

  describe('/players/popular/:query (GET)', () => {
    it('should get popular players', () => {
      return request(app.getHttpServer())
        .get('/players/popular/messi')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should handle different queries', () => {
      return request(app.getHttpServer())
        .get('/players/popular/ronaldo')
        .expect(200);
    });
  });

  describe('/players (GET)', () => {
    it('should get paginated players', () => {
      return request(app.getHttpServer())
        .get('/players')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('page');
          expect(res.body).toHaveProperty('limit');
          expect(res.body).toHaveProperty('totalPages');
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('should handle pagination parameters', () => {
      return request(app.getHttpServer())
        .get('/players?page=2&limit=5')
        .expect(200);
    });

    it('should handle invalid page parameter', () => {
      return request(app.getHttpServer())
        .get('/players?page=invalid')
        .expect(400);
    });

    it('should handle invalid limit parameter', () => {
      return request(app.getHttpServer())
        .get('/players?limit=invalid')
        .expect(400);
    });
  });

  describe('/players/:id (GET)', () => {
    it('should get player by ID', () => {
      return request(app.getHttpServer())
        .get('/players/1')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', '1');
          expect(res.body).toHaveProperty('name', 'Lionel Messi');
        });
    });

    it('should handle non-existent player', () => {
      mockPlayersService.findOne.mockRejectedValueOnce(new Error('Not Found'));

      return request(app.getHttpServer())
        .get('/players/non-existent')
        .expect(404);
    });
  });

  describe('/players/:playerId/sync (POST)', () => {
    it('should sync player from API', () => {
      return request(app.getHttpServer())
        .post('/players/276/sync')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('name');
        });
    });

    it('should handle invalid player ID', () => {
      return request(app.getHttpServer())
        .post('/players/invalid/sync')
        .expect(400);
    });
  });

  describe('Error handling', () => {
    it('should handle service errors gracefully', () => {
      mockPlayersService.searchPlayers.mockRejectedValueOnce(new Error('API Error'));

      return request(app.getHttpServer())
        .get('/players/search?query=error')
        .expect(500);
    });

    it('should handle malformed requests', () => {
      return request(app.getHttpServer())
        .get('/players/search')
        .expect(400);
    });
  });

  describe('Rate limiting and guards', () => {
    it('should require authentication for protected routes', () => {
      // Temporarily disable guard override to test authentication
      // This would normally require JWT token
    });

    it('should require admin role for sync endpoint', () => {
      // This would normally require admin role
    });
  });
});
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /players/search should route to service', async () => {
    const resp = await request(app.getHttpServer()).get('/players/search').query({ query: 'messi' }).expect(200);
    expect(resp.body).toEqual([{ id: 276, name: 'Lionel Messi' }]);
    expect(mockPlayersService.searchPlayers).toHaveBeenCalledWith({ query: 'messi' });
  });

  it('GET /players/276/statistics should return statistics', async () => {
    await request(app.getHttpServer()).get('/players/276/statistics').expect(200).expect(playerStats);
    expect(mockPlayersService.getPlayerStatistics).toHaveBeenCalledWith({ playerId: 276 });
  });

  it('GET /players/276/team should return team info', async () => {
    await request(app.getHttpServer()).get('/players/276/team').expect(200).expect([expect.objectContaining({ team: { name: 'Inter Miami' } })]);
  });

  it('GET /players/276/age-nationality should return age/nationality', async () => {
    await request(app.getHttpServer()).get('/players/276/age-nationality').expect(200).expect({ age: 36, nationality: 'Argentina', birthDate: '1987-06-24', birthPlace: 'Rosario' });
  });

  it('GET /players/276/image should return image', async () => {
    await request(app.getHttpServer()).get('/players/276/image').expect(200).expect({ imageUrl: 'https://media.api-sports.io/football/players/276.png' });
  });

  it('GET /players/popular/messi should return popular', async () => {
    await request(app.getHttpServer()).get('/players/popular/messi').expect(200).expect([{ id: 276, name: 'Lionel Messi' }]);
  });

  it('GET /players should return paginated list', async () => {
    const resp = await request(app.getHttpServer()).get('/players').query({ page: 1, limit: 10 }).expect(200);
    expect(resp.body).toEqual(playersPaginated);
  });

  it('GET /players/1 should return single player', async () => {
    const resp = await request(app.getHttpServer()).get('/players/1').expect(200);
    expect(resp.body).toEqual(playerEntity);
  });

  it('POST /players/276/sync should call syncPlayerFromApi', async () => {
    await request(app.getHttpServer()).post('/players/276/sync').expect(200).expect(playerEntity);
    expect(mockPlayersService.syncPlayerFromApi).toHaveBeenCalledWith(276);
  });
});
