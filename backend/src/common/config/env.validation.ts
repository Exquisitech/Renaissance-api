import { plainToInstance, Transform } from 'class-transformer';
import {
  IsEnum,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number;

  @IsString()
  DB_HOST: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT: number;

  @IsString()
  DB_USERNAME: string;

  @IsString()
  DB_PASSWORD: string;

  @IsString()
  DB_DATABASE: string;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  JWT_EXPIRES_IN: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  REDIS_PORT?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  CACHE_ENABLED?: boolean;

  @IsOptional()
  @IsInt()
  CACHE_TTL?: number;

  @IsOptional()
  @IsInt()
  CACHE_MAX?: number;

  @IsOptional()
  @IsString()
  CACHE_STORE?: string;

  @IsString()
  @IsOptional()
  STELLAR_NETWORK: string;

  @IsString()
  STELLAR_RPC_URL: string;

  @IsString()
  STELLAR_NETWORK_PASSPHRASE: string;

  @IsString()
  SOROBAN_CONTRACT_ID: string;

  @IsString()
  SOROBAN_ADMIN_SECRET: string;

  @IsOptional()
  @IsString()
  SOROBAN_SETTLEMENT_CONTRACT_ID?: string;

  @IsOptional()
  @IsString()
  SOROBAN_SPIN_REWARDS_CONTRACT_ID?: string;

  @IsOptional()
  @IsString()
  SOROBAN_NFT_CONTRACT_ID?: string;

  @IsOptional()
  @IsString()
  SOROBAN_NFT_TARGET_CONTRACT_ID?: string;

  @IsOptional()
  @IsString()
  SOROBAN_SETTLEMENT_FUNCTION?: string;

  @IsOptional()
  @IsString()
  SOROBAN_REWARD_FUNCTION?: string;

  @IsOptional()
  @IsString()
  SOROBAN_NFT_FUNCTION?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  SOROBAN_TX_TIMEOUT_SECONDS?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(60000)
  SOROBAN_TX_POLL_INTERVAL_MS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  SOROBAN_TX_POLL_ATTEMPTS?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  CONTRACT_EVENTS_ENABLED?: boolean;

  @IsOptional()
  @IsInt()
  @Min(100)
  CONTRACT_EVENTS_POLL_INTERVAL_MS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  CONTRACT_EVENTS_PAGE_LIMIT?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  CONTRACT_EVENTS_PROCESSING_RETRY_ATTEMPTS?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  CONTRACT_EVENTS_RECONNECT_BASE_DELAY_MS?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  CONTRACT_EVENTS_RECONNECT_MAX_DELAY_MS?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  CONTRACT_EVENTS_START_LEDGER?: number;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors
      .map((error) => {
        const constraints = Object.values(error.constraints || {});
        return `  - ${error.property}: ${constraints.join(', ')}`;
      })
      .join('\n');

    throw new Error(
      `
❌ Environment configuration validation failed:

${errorMessages}

Please check your .env file and ensure all required variables are set correctly.
`,
    );
  }

  return validatedConfig;
}
