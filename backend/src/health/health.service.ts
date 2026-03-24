import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import {
  HealthResponseDto,
  HealthCheckResult,
} from './dto/health-response.dto';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Perform comprehensive health checks
   * Returns health status with individual service checks
   */
  async checkHealth(): Promise<HealthResponseDto> {
    const checks = {
      database: await this.checkDatabase(),
      cache: await this.checkCache(),
      blockchain: await this.checkBlockchain(),
    };

    // Overall status is healthy only if all critical services are up
    const isHealthy =
      checks.database.status === 'up' &&
      checks.cache.status === 'up' &&
      checks.blockchain.status === 'up';

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  /**
   * Check database connectivity
   * Performs a simple query to verify database is accessible
   */
  private async checkDatabase(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      // Perform a simple query to check database connectivity
      await this.dataSource.query('SELECT 1');
      const responseTime = Date.now() - startTime;

      return {
        status: 'up',
        message: 'Database connection successful',
        responseTime,
      };
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return {
        status: 'down',
        message: 'Database connection failed',
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Check cache connectivity
   * Verifies cache is accessible by performing a test operation
   */
  private async checkCache(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const testKey = 'health_check_test';
    const testValue = 'test';

    try {
      // Check if cache is enabled
      const cacheEnabled = this.configService.get<boolean>('cache.enabled');
      if (!cacheEnabled) {
        return {
          status: 'up',
          message: 'Cache is disabled (not required)',
          responseTime: Date.now() - startTime,
        };
      }

      // Check if cache manager is available
      if (!this.cacheManager) {
        return {
          status: 'down',
          message: 'Cache manager not initialized',
          responseTime: Date.now() - startTime,
        };
      }

      // Perform test set/get operations
      await this.cacheManager.set(testKey, testValue, 1000); // 1 second TTL
      const retrieved = await this.cacheManager.get<string>(testKey);
      await this.cacheManager.del(testKey); // Clean up

      if (retrieved === testValue) {
        const responseTime = Date.now() - startTime;
        return {
          status: 'up',
          message: 'Cache connection successful',
          responseTime,
        };
      } else {
        return {
          status: 'down',
          message: 'Cache test operation failed',
          responseTime: Date.now() - startTime,
        };
      }
    } catch (error) {
      this.logger.error('Cache health check failed', error);
      return {
        status: 'down',
        message: 'Cache connection failed',
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Check blockchain service availability
   * Verifies Soroban service is properly initialized and accessible
   */
  private async checkBlockchain(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      // Check if blockchain configuration exists
      const rpcUrl = this.configService.get<string>(
        'blockchain.stellar.rpcUrl',
      );
      const contractId = this.configService.get<string>(
        'blockchain.soroban.contractId',
      );
      const adminSecret = this.configService.get<string>(
        'blockchain.soroban.adminSecret',
      );

      if (!rpcUrl || !contractId || !adminSecret) {
        return {
          status: 'down',
          message: 'Blockchain configuration missing',
          responseTime: Date.now() - startTime,
        };
      }

      // Try to verify RPC connectivity by checking if we can access the server
      // We'll use a lightweight check - attempting to get the latest ledger
      // This doesn't require authentication and verifies the RPC endpoint is reachable
      try {
        // Import rpc dynamically to avoid circular dependencies
        const { rpc } = await import('@stellar/stellar-sdk');
        const testServer = new rpc.Server(rpcUrl);

        // Get latest ledger info - this is a lightweight operation
        await testServer.getLatestLedger();

        const responseTime = Date.now() - startTime;
        return {
          status: 'up',
          message: 'Blockchain service available',
          responseTime,
        };
      } catch (rpcError) {
        this.logger.warn('RPC connectivity check failed', rpcError);
        return {
          status: 'down',
          message: 'Blockchain RPC endpoint unreachable',
          responseTime: Date.now() - startTime,
        };
      }
    } catch (error) {
      this.logger.error('Blockchain health check failed', error);
      return {
        status: 'down',
        message: 'Blockchain service unavailable',
        responseTime: Date.now() - startTime,
      };
    }
  }
}
