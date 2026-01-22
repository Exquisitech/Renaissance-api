import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

/**
 * Centralized transaction management service
 * Provides consistent transaction handling across all services
 */
@Injectable()
export class TransactionManagerService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Execute a function within a transaction
   * Automatically handles commit/rollback and cleanup
   */
  async executeInTransaction<T>(
    operation: (queryRunner: QueryRunner) => Promise<T>,
  ): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await operation(queryRunner);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Create a query runner for manual transaction management
   * Remember to manually connect, start transaction, commit/rollback, and release
   */
  createQueryRunner(): QueryRunner {
    return this.dataSource.createQueryRunner();
  }

  /**
   * Execute multiple operations in a single transaction
   * All operations must succeed or all will be rolled back
   */
  async executeMultipleOperations<T>(
    operations: ((queryRunner: QueryRunner) => Promise<any>)[],
  ): Promise<T[]> {
    return this.executeInTransaction(async (queryRunner) => {
      const results: T[] = [];

      for (const operation of operations) {
        const result = await operation(queryRunner);
        results.push(result);
      }

      return results;
    });
  }

  /**
   * Execute operations with retry logic on deadlock
   */
  async executeWithRetry<T>(
    operation: (queryRunner: QueryRunner) => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 100,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeInTransaction(operation);
      } catch (error) {
        lastError = error;

        // Check if it's a deadlock error (PostgreSQL error code 40P01)
        if (
          error.code === '40P01' ||
          (error.message && error.message.toLowerCase().includes('deadlock'))
        ) {
          if (attempt < maxRetries) {
            // Wait before retry with exponential backoff
            await new Promise((resolve) =>
              setTimeout(resolve, delayMs * Math.pow(2, attempt - 1)),
            );
            continue;
          }
        }

        // Re-throw if not a retryable error or max retries reached
        throw error;
      }
    }

    throw lastError;
  }
}
