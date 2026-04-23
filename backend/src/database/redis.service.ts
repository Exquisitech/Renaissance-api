import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.initializeClient();
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) {
      return;
    }

    await this.client.quit();
    this.client = null;
  }

  async getCache(key: string): Promise<string | null> {
    const redis = await this.getClient();
    if (!redis) {
      return null;
    }

    return redis.get(key);
  }

  async setCache(
    key: string,
    value: string,
    ttlSeconds?: number,
  ): Promise<void> {
    const redis = await this.getClient();
    if (!redis) {
      return;
    }

    if (ttlSeconds && ttlSeconds > 0) {
      await redis.set(key, value, 'EX', ttlSeconds);
      return;
    }

    await redis.set(key, value);
  }

  async deleteCache(key: string): Promise<void> {
    const redis = await this.getClient();
    if (!redis) {
      return;
    }

    await redis.del(key);
  }

  // Backward-compatible aliases used by existing internal callers.
  async get(key: string): Promise<string | null> {
    return this.getCache(key);
  }

  async set(
    key: string,
    value: string,
    modeOrTtl?: 'EX' | number,
    duration?: number,
  ): Promise<void> {
    if (modeOrTtl === 'EX') {
      await this.setCache(key, value, duration);
      return;
    }

    await this.setCache(
      key,
      value,
      typeof modeOrTtl === 'number' ? modeOrTtl : undefined,
    );
  }

  async del(key: string): Promise<void> {
    await this.deleteCache(key);
  }

  private async getClient(): Promise<Redis | null> {
    if (this.client?.status === 'ready') {
      return this.client;
    }

    return this.initializeClient();
  }

  private async initializeClient(): Promise<Redis | null> {
    if (this.client && this.client.status !== 'end') {
      if (this.client.status !== 'ready') {
        try {
          await this.client.connect();
        } catch (error) {
          this.logger.error('Redis reconnection failed', error as Error);
          return null;
        }
      }

      return this.client;
    }

    const host = this.configService.get<string>('redis.host', 'localhost');
    const port = this.configService.get<number>('redis.port', 6379);

    this.client = new Redis({
      host,
      port,
      lazyConnect: true,
      maxRetriesPerRequest: 2,
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis client error', error);
    });

    try {
      await this.client.connect();
      this.logger.log(`Redis connected at ${host}:${port}`);
      return this.client;
    } catch (error) {
      this.logger.warn('Redis unavailable; cache operations will be skipped.');
      this.logger.error('Redis connection failed', error as Error);
      return null;
    }
  }
}
