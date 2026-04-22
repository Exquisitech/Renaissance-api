import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../app/app.module';
import { Match } from './entities/match.entity';
import { MatchStatus, MatchOutcome } from '../../common/enums/match.enums';
import { User, UserRole } from '../users/entities/user.entity';
import { createTestDataSource, createTestDataSourceWithEntities } from '../../test/test-db-setup';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('Matches (e2e)', () => {
  let app: INestApplication;
  let matchRepository: Repository<Match>;
  let userRepository: Repository<User>;
  let jwtService: JwtService;
  let configService: ConfigService;
  let testDataSource;

  let userToken: string;
  let adminToken: string;
  let testUser: User;
  let testAdmin: User;
  let testMatch: Match;

  beforeAll(async () => {
    testDataSource = await createTestDataSourceWithEntities([
      Match,
      User,
    ]);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('DATA_SOURCE')
      .useValue(testDataSource)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());

    matchRepository = moduleFixture.get<Repository<Match>>(getRepositoryToken(Match));
    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    jwtService = moduleFixture.get<JwtService>(JwtService);
    configService = moduleFixture.get<ConfigService>(ConfigService);

    await app.init();

    // Create test users
    testUser = await userRepository.save({
      id: 'test-user-id',
      email: 'user@test.com',
      password: 'hashedpassword',
      role: UserRole.USER,
      balance: 1000,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    testAdmin = await userRepository.save({
      id: 'test-admin-id',
      email: 'admin@test.com',
      password: 'hashedpassword',
      role: UserRole.ADMIN,
      balance: 1000,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create test match
    testMatch = await matchRepository.save({
      id: 'test-match-id',
      homeTeam: 'Team A',
      awayTeam: 'Team B',
      startTime: new Date(Date.now() + 3600000), // 1 hour from now
      status: MatchStatus.UPCOMING,
      league: 'Test League',
      season: '2024',
      homeOdds: 2.5,
      drawOdds: 3.0,
      awayOdds: 3.5,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Generate JWT tokens
    userToken = jwtService.sign({
      userId: testUser.id,
      email: testUser.email,
      role: testUser.role,
    });

    adminToken = jwtService.sign({
      userId: testAdmin.id,
      email: testAdmin.email,
      role: testAdmin.role,
    });
  });

  afterAll(async () => {
    await testDataSource.destroy();
    await app.close();
  });

  afterEach(async () => {
    // Clean up matches after each test (except the initial test match)
    await matchRepository.delete({ id: 'test-match-id' });
  });

  describe('POST /matches', () => {
    const createMatchDto = {
      homeTeam: 'New Team A',
      awayTeam: 'New Team B',
      startTime: new Date(Date.now() + 7200000).toISOString(), // 2 hours from now
      league: 'Test League',
      season: '2024',
      homeOdds: 2.0,
      drawOdds: 3.2,
      awayOdds: 4.0,
    };

    it('should create a match successfully for admin', () => {
      return request(app.getHttpServer())
        .post('/matches')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createMatchDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.homeTeam).toBe(createMatchDto.homeTeam);
          expect(res.body.awayTeam).toBe(createMatchDto.awayTeam);
          expect(res.body.status).toBe(MatchStatus.UPCOMING);
          expect(res.body.league).toBe(createMatchDto.league);
          expect(res.body.homeOdds).toBe(createMatchDto.homeOdds);
        });
    });

    it('should return 403 for non-admin user', () => {
      return request(app.getHttpServer())
        .post('/matches')
        .set('Authorization', `Bearer ${userToken}`)
        .send(createMatchDto)
        .expect(403);
    });

    it('should return 401 without authentication', () => {
      return request(app.getHttpServer())
        .post('/matches')
        .send(createMatchDto)
        .expect(401);
    });

    it('should return 400 for past start time', () => {
      const pastMatchDto = {
        ...createMatchDto,
        startTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      };

      return request(app.getHttpServer())
        .post('/matches')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(pastMatchDto)
        .expect(400);
    });

    it('should return 400 for same home and away teams', () => {
      const sameTeamDto = {
        ...createMatchDto,
        awayTeam: 'New Team A',
      };

      return request(app.getHttpServer())
        .post('/matches')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(sameTeamDto)
        .expect(400);
    });
  });

  describe('GET /matches', () => {
    beforeEach(async () => {
      // Create additional test matches
      await matchRepository.save([
        {
          id: 'match-1',
          homeTeam: 'Team C',
          awayTeam: 'Team D',
          startTime: new Date(Date.now() + 7200000),
          status: MatchStatus.UPCOMING,
          league: 'Test League',
          season: '2024',
          homeOdds: 1.8,
          drawOdds: 3.5,
          awayOdds: 4.5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'match-2',
          homeTeam: 'Team E',
          awayTeam: 'Team F',
          startTime: new Date(Date.now() + 10800000),
          status: MatchStatus.LIVE,
          league: 'Test League',
          season: '2024',
          homeOdds: 2.2,
          drawOdds: 3.1,
          awayOdds: 3.2,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    });

    it('should return paginated matches', () => {
      return request(app.getHttpServer())
        .get('/matches')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('page');
          expect(res.body).toHaveProperty('limit');
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.total).toBeGreaterThanOrEqual(3);
        });
    });

    it('should support pagination parameters', () => {
      return request(app.getHttpServer())
        .get('/matches?page=1&limit=2')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(2);
          expect(res.body.page).toBe(1);
          expect(res.body.limit).toBe(2);
        });
    });

    it('should filter by status', () => {
      return request(app.getHttpServer())
        .get(`/matches?status=${MatchStatus.LIVE}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.every(match => match.status === MatchStatus.LIVE)).toBe(true);
        });
    });

    it('should filter by league', () => {
      return request(app.getHttpServer())
        .get('/matches?league=Test League')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.every(match => match.league === 'Test League')).toBe(true);
        });
    });

    it('should filter by home team', () => {
      return request(app.getHttpServer())
        .get('/matches?homeTeam=Team A')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.every(match => match.homeTeam.includes('Team A'))).toBe(true);
        });
    });
  });

  describe('GET /matches/upcoming', () => {
    it('should return upcoming matches', () => {
      return request(app.getHttpServer())
        .get('/matches/upcoming')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body.data.every(match => match.status === MatchStatus.UPCOMING)).toBe(true);
          expect(res.body.data.every(match => new Date(match.startTime) > new Date())).toBe(true);
        });
    });
  });

  describe('GET /matches/live', () => {
    beforeEach(async () => {
      // Create a live match
      await matchRepository.save({
        id: 'live-match',
        homeTeam: 'Live Team A',
        awayTeam: 'Live Team B',
        startTime: new Date(Date.now() - 1800000), // 30 minutes ago
        status: MatchStatus.LIVE,
        league: 'Test League',
        season: '2024',
        homeOdds: 2.1,
        drawOdds: 3.3,
        awayOdds: 3.4,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('should return live matches', () => {
      return request(app.getHttpServer())
        .get('/matches/live')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.every(match => match.status === MatchStatus.LIVE)).toBe(true);
        });
    });
  });

  describe('GET /matches/finished', () => {
    beforeEach(async () => {
      // Create a finished match
      await matchRepository.save({
        id: 'finished-match',
        homeTeam: 'Finished Team A',
        awayTeam: 'Finished Team B',
        startTime: new Date(Date.now() - 7200000), // 2 hours ago
        status: MatchStatus.FINISHED,
        outcome: MatchOutcome.HOME_WIN,
        homeScore: 2,
        awayScore: 1,
        league: 'Test League',
        season: '2024',
        homeOdds: 2.0,
        drawOdds: 3.0,
        awayOdds: 3.8,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('should return finished matches', () => {
      return request(app.getHttpServer())
        .get('/matches/finished')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body.data.every(match => match.status === MatchStatus.FINISHED)).toBe(true);
        });
    });
  });

  describe('GET /matches/:id', () => {
    it('should return match details', () => {
      return request(app.getHttpServer())
        .get(`/matches/${testMatch.id}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(testMatch.id);
          expect(res.body.homeTeam).toBe(testMatch.homeTeam);
          expect(res.body.awayTeam).toBe(testMatch.awayTeam);
          expect(res.body.status).toBe(testMatch.status);
        });
    });

    it('should return 404 for non-existent match', () => {
      return request(app.getHttpServer())
        .get('/matches/non-existent-match')
        .expect(404);
    });
  });

  describe('PATCH /matches/:id', () => {
    const updateDto = {
      homeScore: 1,
      awayScore: 0,
      status: MatchStatus.FINISHED,
    };

    it('should update match for admin', () => {
      return request(app.getHttpServer())
        .patch(`/matches/${testMatch.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateDto)
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe(MatchStatus.FINISHED);
          expect(res.body.homeScore).toBe(1);
          expect(res.body.awayScore).toBe(0);
          expect(res.body.outcome).toBe(MatchOutcome.HOME_WIN);
        });
    });

    it('should return 403 for non-admin user', () => {
      return request(app.getHttpServer())
        .patch(`/matches/${testMatch.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateDto)
        .expect(403);
    });

    it('should return 404 for non-existent match', () => {
      return request(app.getHttpServer())
        .patch('/matches/non-existent-match')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateDto)
        .expect(404);
    });
  });

  describe('PATCH /matches/:id/status', () => {
    const updateStatusDto = {
      status: MatchStatus.LIVE,
    };

    it('should update match status for admin', () => {
      return request(app.getHttpServer())
        .patch(`/matches/${testMatch.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateStatusDto)
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe(MatchStatus.LIVE);
        });
    });

    it('should return 403 for non-admin user', () => {
      return request(app.getHttpServer())
        .patch(`/matches/${testMatch.id}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateStatusDto)
        .expect(403);
    });
  });

  describe('DELETE /matches/:id', () => {
    it('should cancel match for admin', () => {
      return request(app.getHttpServer())
        .delete(`/matches/${testMatch.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(res.body.message).toContain('cancelled');
        });
    });

    it('should return 403 for non-admin user', () => {
      return request(app.getHttpServer())
        .delete(`/matches/${testMatch.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent match', () => {
      return request(app.getHttpServer())
        .delete('/matches/non-existent-match')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });
});</content>
<parameter name="filePath">c:\Users\u-adamu\Desktop\wave 2\Renaissance-api\backend\test\matches.e2e-spec.ts