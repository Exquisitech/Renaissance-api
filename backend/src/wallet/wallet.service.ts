import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
} from '../transactions/entities/transaction.entity';

export interface WalletOperationResult {
  success: boolean;
  newBalance: number;
  transactionId?: string;
  error?: string;
}

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Deposit funds to user wallet
   * Uses transaction to ensure atomicity
   */
  async deposit(
    userId: string,
    amount: number,
    referenceId?: string,
  ): Promise<WalletOperationResult> {
    if (amount <= 0) {
      throw new BadRequestException('Deposit amount must be positive');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get user with lock to prevent race conditions
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Create transaction record
      const transaction = queryRunner.manager.create(Transaction, {
        userId,
        type: TransactionType.WALLET_DEPOSIT,
        amount,
        status: TransactionStatus.PENDING,
        referenceId,
        metadata: {
          operation: 'deposit',
          timestamp: new Date().toISOString(),
        },
      });

      const savedTransaction = await queryRunner.manager.save(transaction);

      // Update user balance
      user.walletBalance = Number(user.walletBalance) + Number(amount);
      await queryRunner.manager.save(user);

      // Mark transaction as completed
      savedTransaction.status = TransactionStatus.COMPLETED;
      await queryRunner.manager.save(savedTransaction);

      await queryRunner.commitTransaction();

      return {
        success: true,
        newBalance: Number(user.walletBalance),
        transactionId: savedTransaction.id,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Withdraw funds from user wallet
   * Uses transaction to ensure atomicity
   */
  async withdraw(
    userId: string,
    amount: number,
    referenceId?: string,
  ): Promise<WalletOperationResult> {
    if (amount <= 0) {
      throw new BadRequestException('Withdrawal amount must be positive');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get user with lock to prevent race conditions
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Check if user has sufficient balance
      if (Number(user.walletBalance) < Number(amount)) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      // Create transaction record
      const transaction = queryRunner.manager.create(Transaction, {
        userId,
        type: TransactionType.WALLET_WITHDRAWAL,
        amount: -amount, // Negative amount for withdrawal
        status: TransactionStatus.PENDING,
        referenceId,
        metadata: {
          operation: 'withdrawal',
          timestamp: new Date().toISOString(),
        },
      });

      const savedTransaction = await queryRunner.manager.save(transaction);

      // Update user balance
      user.walletBalance = Number(user.walletBalance) - Number(amount);
      await queryRunner.manager.save(user);

      // Mark transaction as completed
      savedTransaction.status = TransactionStatus.COMPLETED;
      await queryRunner.manager.save(savedTransaction);

      await queryRunner.commitTransaction();

      return {
        success: true,
        newBalance: Number(user.walletBalance),
        transactionId: savedTransaction.id,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get user wallet balance
   */
  async getBalance(userId: string): Promise<number> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['walletBalance'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return Number(user.walletBalance);
  }

  /**
   * Get user transaction history
   */
  async getTransactionHistory(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: Transaction[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    const [data, total] = await this.transactionRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Internal method to update user balance within a transaction
   * Used by other services (bets, staking) to ensure consistency
   */
  async updateUserBalance(
    userId: string,
    amount: number,
    transactionType: TransactionType,
    relatedEntityId?: string,
    metadata?: Record<string, any>,
  ): Promise<WalletOperationResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get user with lock
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Check if operation would result in negative balance (except for withdrawals which are checked separately)
      const newBalance = Number(user.walletBalance) + Number(amount);
      if (
        newBalance < 0 &&
        transactionType !== TransactionType.WALLET_WITHDRAWAL
      ) {
        throw new BadRequestException(
          'Insufficient wallet balance for this operation',
        );
      }

      // Create transaction record
      const transaction = queryRunner.manager.create(Transaction, {
        userId,
        type: transactionType,
        amount,
        status: TransactionStatus.PENDING,
        relatedEntityId,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
        },
      });

      const savedTransaction = await queryRunner.manager.save(transaction);

      // Update user balance
      user.walletBalance = newBalance;
      await queryRunner.manager.save(user);

      // Mark transaction as completed
      savedTransaction.status = TransactionStatus.COMPLETED;
      await queryRunner.manager.save(savedTransaction);

      await queryRunner.commitTransaction();

      return {
        success: true,
        newBalance: Number(user.walletBalance),
        transactionId: savedTransaction.id,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
