import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

/**
 * TypeORM Data Source for CLI operations (migrations, etc.)
 * This is used by the TypeORM CLI for running migrations independently
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'renaissance_api',
  // Entity path patterns for auto-discovery
  entities: [path.join(__dirname, '/../**/*.entity{.ts,.js}')],
  // Migration patterns - matches numbered migration files
  migrations: [path.join(__dirname, '/../migrations/*{.ts,.js}')],
  // CRITICAL: Always false for CLI - migrations handle schema changes
  synchronize: false,
  // Logging for migration debugging
  logging: process.env.NODE_ENV === 'development',
  // Use UUID extension for primary keys
});
