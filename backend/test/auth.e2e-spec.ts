import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User, UserRole } from '../src/users/entities/user.entity';
import { createTestDataSource, createTestDataSourceWithEntities } from './test-db-setup';
import { JwtService } from '@nestjs/jwt';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let jwtService: JwtService;
  let testDataSource;

  beforeAll(async () => {
    testDataSource = await createTestDataSourceWithEntities([
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

    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    jwtService = moduleFixture.get<JwtService>(JwtService);

    await app.init();
  });

  afterAll(async () => {
    await testDataSource.destroy();
    await app.close();
  });

  afterEach(async () => {
    // Clean up users after each test
    await userRepository.clear();
  });

  describe('POST /auth/register', () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should register a new user successfully', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('user');
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body.user.email).toBe(registerDto.email);
          expect(res.body.user).not.toHaveProperty('password');
          expect(typeof res.body.accessToken).toBe('string');
        });
    });

    it('should return 400 for invalid email', () => {
      const invalidDto = {
        email: 'invalid-email',
        password: 'password123',
      };

      return request(app.getHttpServer())
        .post('/auth/register')
        .send(invalidDto)
        .expect(400);
    });

    it('should return 400 for short password', () => {
      const invalidDto = {
        email: 'test@example.com',
        password: '123',
      };

      return request(app.getHttpServer())
        .post('/auth/register')
        .send(invalidDto)
        .expect(400);
    });

    it('should return 401 for existing email', async () => {
      // First register a user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);

      // Try to register again with same email
      return request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(401);
    });
  });

  describe('POST /auth/login', () => {
    const registerDto = {
      email: 'login@example.com',
      password: 'password123',
    };

    const loginDto = {
      email: registerDto.email,
      password: registerDto.password,
    };

    beforeEach(async () => {
      // Register a user for login tests
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);
    });

    it('should login user successfully', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('user');
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body.user.email).toBe(loginDto.email);
          expect(res.body.user).not.toHaveProperty('password');
          expect(typeof res.body.accessToken).toBe('string');
        });
    });

    it('should return 401 for invalid email', () => {
      const invalidLoginDto = {
        email: 'nonexistent@example.com',
        password: 'password123',
      };

      return request(app.getHttpServer())
        .post('/auth/login')
        .send(invalidLoginDto)
        .expect(401);
    });

    it('should return 401 for invalid password', () => {
      const invalidLoginDto = {
        email: registerDto.email,
        password: 'wrongpassword',
      };

      return request(app.getHttpServer())
        .post('/auth/login')
        .send(invalidLoginDto)
        .expect(401);
    });
  });

  describe('GET /auth/profile', () => {
    let userToken: string;
    let testUser: User;

    beforeEach(async () => {
      // Create and login a user
      const registerDto = {
        email: 'profile@example.com',
        password: 'password123',
      };

      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);

      userToken = registerResponse.body.accessToken;
      testUser = registerResponse.body.user;
    });

    it('should return user profile for authenticated user', () => {
      return request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.userId).toBe(testUser.id);
          expect(res.body.email).toBe(testUser.email);
          expect(res.body.role).toBe(testUser.role);
        });
    });

    it('should return 401 without authentication', () => {
      return request(app.getHttpServer())
        .get('/auth/profile')
        .expect(401);
    });

    it('should return 401 with invalid token', () => {
      return request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('GET /auth/verify', () => {
    let userToken: string;
    let testUser: User;

    beforeEach(async () => {
      // Create and login a user
      const registerDto = {
        email: 'verify@example.com',
        password: 'password123',
      };

      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);

      userToken = registerResponse.body.accessToken;
      testUser = registerResponse.body.user;
    });

    it('should verify valid token', () => {
      return request(app.getHttpServer())
        .get('/auth/verify')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.valid).toBe(true);
          expect(res.body.user.userId).toBe(testUser.id);
          expect(res.body.user.email).toBe(testUser.email);
          expect(res.body.user.role).toBe(testUser.role);
        });
    });

    it('should return 401 without authentication', () => {
      return request(app.getHttpServer())
        .get('/auth/verify')
        .expect(401);
    });

    it('should return 401 with invalid token', () => {
      return request(app.getHttpServer())
        .get('/auth/verify')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
        .expect(401);
    });

    it('should fail with invalid email', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123',
        })
        .expect(400);
    });

    it('should fail with short password', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test2@example.com',
          password: '123',
        })
        .expect(400);
    });
  });

  describe('/auth/login (POST)', () => {
    it('should login with valid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('user');
          expect(res.body).toHaveProperty('accessToken');
          authToken = res.body.accessToken;
        });
    });

    it('should fail with wrong password', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
        .expect(401);
    });

    it('should fail with non-existent user', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
        .expect(401);
    });
  });

  describe('/auth/profile (GET)', () => {
    it('should get profile with valid token', () => {
      return request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('userId');
          expect(res.body).toHaveProperty('email');
        });
    });

    it('should fail without token', () => {
      return request(app.getHttpServer()).get('/auth/profile').expect(401);
    });

    it('should fail with invalid token', () => {
      return request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);
    });
  });

  describe('/auth/verify (GET)', () => {
    it('should verify valid token', () => {
      return request(app.getHttpServer())
        .get('/auth/verify')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.valid).toBe(true);
          expect(res.body.user).toHaveProperty('userId');
        });
    });

    it('should reject invalid token', () => {
      return request(app.getHttpServer())
        .get('/auth/verify')
        .set('Authorization', 'Bearer invalid.token')
        .expect(401);
    });
  });
});
