import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';

export const getTypeOrmConfig = (
  configService: ConfigService,
): DataSourceOptions => {
  const nodeEnv = configService.get<string>('NODE_ENV') || 'development';

  return {
    type: 'postgres',
    host: configService.get<string>('DB_HOST', 'localhost'),
    port: configService.get<number>('DB_PORT', 5432),
    username: configService.get<string>('DB_USERNAME'),
    password: configService.get<string>('DB_PASSWORD'),
    database: configService.get<string>('DB_DATABASE'),
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    // CRITICAL: Always disable synchronize in production to prevent data loss
    // Schema changes MUST go through migrations only
    synchronize: nodeEnv === 'development',
    logging: nodeEnv === 'development',
    // Auto-run migrations on application startup in production
    migrationsRun: nodeEnv === 'production',
  } as DataSourceOptions;
};

// Export function for runtime usage in NestJS
export const AppDataSource = (configService: ConfigService) =>
  new DataSource(getTypeOrmConfig(configService));
