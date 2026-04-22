import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getTypeOrmConfig } from '../src/database/typeorm.config';
import { DataSource } from 'typeorm';

// Global test setup
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
});

// Clean up after each test
afterEach(async () => {
  // Clear all mocks
  jest.clearAllMocks();
});

// Clean up after all tests
afterAll(async () => {
  // Close any open connections
});

// Helper function to create test module with database
export async function createTestModule(
  entities: any[] = [],
  providers: any[] = [],
  controllers: any[] = [],
  imports: any[] = [],
): Promise<TestingModule> {
  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        load: [],
        envFilePath: ['.env.test', '.env'],
      }),
      TypeOrmModule.forRootAsync({
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          ...getTypeOrmConfig(configService),
          type: 'sqlite',
          database: ':memory:',
          entities: entities,
          synchronize: true,
          dropSchema: true,
          logging: false,
        }),
      }),
      TypeOrmModule.forFeature(entities),
      ...imports,
    ],
    controllers,
    providers,
  }).compile();

  // Initialize database
  const dataSource = module.get<DataSource>(DataSource);
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  return module;
}

// Helper function to create mock service
export function createMockService<T>(methods: Partial<T>): T {
  return methods as T;
}

// Helper function to create mock repository
export function createMockRepository<T>() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
      getMany: jest.fn(),
      getOne: jest.fn(),
      execute: jest.fn(),
    })),
  };
}