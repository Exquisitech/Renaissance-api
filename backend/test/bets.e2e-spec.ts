import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../app/app.module';
import { Bet, BetStatus } from './entities/bet.entity';
import { Match, MatchOutcome } from '../matches/entities/match.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { createTestDataSource, createTestDataSourceWithEntities } from '../../test/test-db-setup';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('Bets (e2e)', () => {
  let app: INestApplication;
  let betRepository: Repository<Bet>;
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
      Bet,
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

    betRepository = moduleFixture.get<Repository<Bet>>(getRepositoryToken(Bet));
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
      status: 'scheduled',
      odds: { homeWin: 2.5, draw: 3.0, awayWin: 3.5 },
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
    // Clean up bets after each test
    await betRepository.clear();
  });

  describe('POST /bets', () => {
    it('should place a bet successfully', () => {
      return request(app.getHttpServer())
        .post('/bets')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          matchId: testMatch.id,
          stakeAmount: 100,
          predictedOutcome: MatchOutcome.HOME_WIN,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.userId).toBe(testUser.id);
          expect(res.body.matchId).toBe(testMatch.id);
          expect(res.body.stakeAmount).toBe(100);
          expect(res.body.predictedOutcome).toBe(MatchOutcome.HOME_WIN);
          expect(res.body.odds).toBe(2.5);
          expect(res.body.potentialPayout).toBe(250);
          expect(res.body.status).toBe(BetStatus.PENDING);
        });
    });

    it('should return 400 for invalid stake amount', () => {
      return request(app.getHttpServer())
        .post('/bets')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          matchId: testMatch.id,
          stakeAmount: -100,
          predictedOutcome: MatchOutcome.HOME_WIN,
        })
        .expect(400);
    });

    it('should return 401 without authentication', () => {
      return request(app.getHttpServer())
        .post('/bets')
        .send({
          matchId: testMatch.id,
          stakeAmount: 100,
          predictedOutcome: MatchOutcome.HOME_WIN,
        })
        .expect(401);
    });

    it('should return 404 for non-existent match', () => {
      return request(app.getHttpServer())
        .post('/bets')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          matchId: 'non-existent-match',
          stakeAmount: 100,
          predictedOutcome: MatchOutcome.HOME_WIN,
        })
        .expect(404);
    });
  });

  describe('GET /bets/my-bets', () => {
    beforeEach(async () => {
      // Create test bets
      await betRepository.save([
        {
          id: 'bet-1',
          userId: testUser.id,
          matchId: testMatch.id,
          stakeAmount: 100,
          predictedOutcome: MatchOutcome.HOME_WIN,
          odds: 2.5,
          potentialPayout: 250,
          status: BetStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'bet-2',
          userId: testUser.id,
          matchId: testMatch.id,
          stakeAmount: 50,
          predictedOutcome: MatchOutcome.AWAY_WIN,
          odds: 3.5,
          potentialPayout: 175,
          status: BetStatus.WON,
          settledAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    });

    it('should return user bets with pagination', () => {
      return request(app.getHttpServer())
        .get('/bets/my-bets')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('page');
          expect(res.body).toHaveProperty('limit');
          expect(res.body.data).toHaveLength(2);
          expect(res.body.total).toBe(2);
        });
    });

    it('should support pagination parameters', () => {
      return request(app.getHttpServer())
        .get('/bets/my-bets?page=1&limit=1')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.page).toBe(1);
          expect(res.body.limit).toBe(1);
          expect(res.body.total).toBe(2);
          expect(res.body.totalPages).toBe(2);
        });
    });
  });

  describe('GET /bets/my-stats', () => {
    beforeEach(async () => {
      // Create test bets for statistics
      await betRepository.save([
        {
          id: 'bet-1',
          userId: testUser.id,
          matchId: testMatch.id,
          stakeAmount: 100,
          predictedOutcome: MatchOutcome.HOME_WIN,
          odds: 2.5,
          potentialPayout: 250,
          status: BetStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'bet-2',
          userId: testUser.id,
          matchId: testMatch.id,
          stakeAmount: 50,
          predictedOutcome: MatchOutcome.AWAY_WIN,
          odds: 3.5,
          potentialPayout: 175,
          status: BetStatus.WON,
          settledAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'bet-3',
          userId: testUser.id,
          matchId: testMatch.id,
          stakeAmount: 75,
          predictedOutcome: MatchOutcome.DRAW,
          odds: 3.0,
          potentialPayout: 225,
          status: BetStatus.LOST,
          settledAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    });

    it('should return user betting statistics', () => {
      return request(app.getHttpServer())
        .get('/bets/my-stats')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('totalBets', 3);
          expect(res.body).toHaveProperty('pendingBets', 1);
          expect(res.body).toHaveProperty('wonBets', 1);
          expect(res.body).toHaveProperty('lostBets', 1);
          expect(res.body).toHaveProperty('cancelledBets', 0);
          expect(res.body).toHaveProperty('totalStaked', 225);
          expect(res.body).toHaveProperty('totalWon', 175);
          expect(res.body).toHaveProperty('winRate', 50); // 1 won out of 2 settled
        });
    });
  });

  describe('GET /bets/:betId', () => {
    let testBet: Bet;

    beforeEach(async () => {
      testBet = await betRepository.save({
        id: 'test-bet-id',
        userId: testUser.id,
        matchId: testMatch.id,
        stakeAmount: 100,
        predictedOutcome: MatchOutcome.HOME_WIN,
        odds: 2.5,
        potentialPayout: 250,
        status: BetStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('should return bet details for owner', () => {
      return request(app.getHttpServer())
        .get(`/bets/${testBet.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(testBet.id);
          expect(res.body.userId).toBe(testUser.id);
          expect(res.body.stakeAmount).toBe(100);
          expect(res.body.status).toBe(BetStatus.PENDING);
        });
    });

    it('should return 404 for non-existent bet', () => {
      return request(app.getHttpServer())
        .get('/bets/non-existent-bet')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });

    it('should return 404 for bet owned by different user', () => {
      return request(app.getHttpServer())
        .get(`/bets/${testBet.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('PATCH /bets/:betId/cancel', () => {
    let testBet: Bet;

    beforeEach(async () => {
      testBet = await betRepository.save({
        id: 'cancel-test-bet',
        userId: testUser.id,
        matchId: testMatch.id,
        stakeAmount: 100,
        predictedOutcome: MatchOutcome.HOME_WIN,
        odds: 2.5,
        potentialPayout: 250,
        status: BetStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('should cancel bet successfully', () => {
      return request(app.getHttpServer())
        .patch(`/bets/${testBet.id}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe(BetStatus.CANCELLED);
          expect(res.body.id).toBe(testBet.id);
        });
    });

    it('should return 404 for non-existent bet', () => {
      return request(app.getHttpServer())
        .patch('/bets/non-existent-bet/cancel')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });

    it('should return 403 for bet owned by different user', () => {
      return request(app.getHttpServer())
        .patch(`/bets/${testBet.id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });
  });

  describe('GET /bets/match/:matchId (Admin)', () => {
    beforeEach(async () => {
      // Create test bets for the match
      await betRepository.save([
        {
          id: 'match-bet-1',
          userId: testUser.id,
          matchId: testMatch.id,
          stakeAmount: 100,
          predictedOutcome: MatchOutcome.HOME_WIN,
          odds: 2.5,
          potentialPayout: 250,
          status: BetStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'match-bet-2',
          userId: testAdmin.id,
          matchId: testMatch.id,
          stakeAmount: 200,
          predictedOutcome: MatchOutcome.AWAY_WIN,
          odds: 3.5,
          potentialPayout: 700,
          status: BetStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    });

    it('should return match bets for admin', () => {
      return request(app.getHttpServer())
        .get(`/bets/match/${testMatch.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(2);
          expect(res.body.total).toBe(2);
        });
    });

    it('should return 403 for non-admin user', () => {
      return request(app.getHttpServer())
        .get(`/bets/match/${testMatch.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('PATCH /bets/:betId/status (Admin)', () => {
    let testBet: Bet;

    beforeEach(async () => {
      testBet = await betRepository.save({
        id: 'status-test-bet',
        userId: testUser.id,
        matchId: testMatch.id,
        stakeAmount: 100,
        predictedOutcome: MatchOutcome.HOME_WIN,
        odds: 2.5,
        potentialPayout: 250,
        status: BetStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('should update bet status for admin', () => {
      return request(app.getHttpServer())
        .patch(`/bets/${testBet.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: BetStatus.CANCELLED })
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe(BetStatus.CANCELLED);
        });
    });

    it('should return 403 for non-admin user', () => {
      return request(app.getHttpServer())
        .patch(`/bets/${testBet.id}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: BetStatus.CANCELLED })
        .expect(403);
    });
  });

  describe('POST /bets/settle (Admin)', () => {
    beforeEach(async () => {
      // Update match with outcome
      await matchRepository.update(testMatch.id, {
        outcome: MatchOutcome.HOME_WIN,
        status: 'completed',
      });

      // Create test bets
      await betRepository.save([
        {
          id: 'settle-bet-1',
          userId: testUser.id,
          matchId: testMatch.id,
          stakeAmount: 100,
          predictedOutcome: MatchOutcome.HOME_WIN,
          odds: 2.5,
          potentialPayout: 250,
          status: BetStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'settle-bet-2',
          userId: testAdmin.id,
          matchId: testMatch.id,
          stakeAmount: 50,
          predictedOutcome: MatchOutcome.AWAY_WIN,
          odds: 3.5,
          potentialPayout: 175,
          status: BetStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    });

    it('should settle match bets for admin', () => {
      return request(app.getHttpServer())
        .post('/bets/settle')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ matchId: testMatch.id })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('settled', 2);
          expect(res.body).toHaveProperty('won', 1);
          expect(res.body).toHaveProperty('lost', 1);
          expect(res.body).toHaveProperty('totalPayout', 250);
        });
    });

    it('should return 403 for non-admin user', () => {
      return request(app.getHttpServer())
        .post('/bets/settle')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ matchId: testMatch.id })
        .expect(403);
    });
  });

  describe('GET /bets/user/:userId (Admin)', () => {
    beforeEach(async () => {
      // Create test bets for the user
      await betRepository.save([
        {
          id: 'user-bet-1',
          userId: testUser.id,
          matchId: testMatch.id,
          stakeAmount: 100,
          predictedOutcome: MatchOutcome.HOME_WIN,
          odds: 2.5,
          potentialPayout: 250,
          status: BetStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    });

    it('should return user bets for admin', () => {
      return request(app.getHttpServer())
        .get(`/bets/user/${testUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].userId).toBe(testUser.id);
        });
    });

    it('should return 403 for non-admin user', () => {
      return request(app.getHttpServer())
        .get(`/bets/user/${testUser.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });
});</content>
<parameter name="filePath">c:\Users\u-adamu\Desktop\wave 2\Renaissance-api\backend\test\bets.e2e-spec.ts