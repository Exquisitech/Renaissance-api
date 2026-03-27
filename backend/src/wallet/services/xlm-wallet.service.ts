import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Balance } from '../entities/balance.entity';
import {
  BalanceTransaction,
  TransactionType,
  TransactionSource,
} from '../entities/balance-transaction.entity';
import { User } from '../../users/entities/user.entity';

export interface WalletBalance {
  userId: string;
  availableBalance: number;
  lockedBalance: number;
  totalBalance: number;
  lastUpdated: Date;
}

export interface TransactionHistory {
  id: string;
  amount: number;
  type: TransactionType;
  source: TransactionSource;
  referenceId?: string;
  metadata?: Record<string, any>;
  previousBalance: number;
  newBalance: number;
  createdAt: Date;
}

export interface PaginatedTransactions {
  data: TransactionHistory[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface WithdrawalRequest {
  amount: number;
  destinationAddress: string;
  memo?: string;
}

export interface WithdrawalResult {
  transactionId: string;
  status: 'pending' | 'completed' | 'failed';
  amount: number;
  fee: number;
  destinationAddress: string;
  estimatedCompletion: Date;
}

export interface DepositResult {
  transactionId: string;
  amount: number;
  sourceAddress: string;
  status: 'pending' | 'completed';
  confirmations: number;
  requiredConfirmations: number;
}

@Injectable()
export class XlmWalletService {
  private readonly logger = new Logger(XlmWalletService.name);
  private readonly XLM_FEE = 0.00001; // Minimum XLM transaction fee
  private readonly MIN_BALANCE = 0.5; // Minimum XLM balance to maintain
  private readonly WITHDRAWAL_LIMIT = 10000; // Daily withdrawal limit in XLM
  private readonly REQUIRED_CONFIRMATIONS = 3; // Required blockchain confirmations

  constructor(
    @InjectRepository(Balance)
    private balanceRepository: Repository<Balance>,
    @InjectRepository(BalanceTransaction)
    private transactionRepository: Repository<BalanceTransaction>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private dataSource: DataSource,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getWalletBalance(userId: string): Promise<WalletBalance> {
    const cacheKey = `wallet_balance_${userId}`;
    
    try {
      const cached = await this.cacheManager.get<WalletBalance>(cacheKey);
      if (cached) {
        return cached;
      }

      const balance = await this.balanceRepository.findOne({
        where: { userId },
        relations: ['user'],
      });

      if (!balance) {
        throw new NotFoundException('Wallet not found for user');
      }

      const result: WalletBalance = {
        userId: balance.userId,
        availableBalance: balance.availableBalance,
        lockedBalance: balance.lockedBalance,
        totalBalance: balance.availableBalance + balance.lockedBalance,
        lastUpdated: balance.updatedAt,
      };

      await this.cacheManager.set(cacheKey, result, 60);
      return result;
    } catch (error) {
      this.logger.error(`Error getting wallet balance: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getTransactionHistory(
    userId: string,
    page = 1,
    limit = 10,
    type?: TransactionType,
    source?: TransactionSource,
  ): Promise<PaginatedTransactions> {
    const cacheKey = `transactions_${userId}_${page}_${limit}_${type}_${source}`;
    
    try {
      const cached = await this.cacheManager.get<PaginatedTransactions>(cacheKey);
      if (cached) {
        return cached;
      }

      const queryBuilder = this.transactionRepository
        .createQueryBuilder('transaction')
        .innerJoin('transaction.balance', 'balance')
        .where('balance.userId = :userId', { userId });

      if (type) {
        queryBuilder.andWhere('transaction.type = :type', { type });
      }

      if (source) {
        queryBuilder.andWhere('transaction.source = :source', { source });
      }

      queryBuilder.orderBy('transaction.createdAt', 'DESC');

      const [transactions, total] = await queryBuilder
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      const data: TransactionHistory[] = transactions.map(tx => ({
        id: tx.id,
        amount: tx.amount,
        type: tx.type,
        source: tx.source,
        referenceId: tx.referenceId,
        metadata: tx.metadata,
        previousBalance: tx.previousBalance,
        newBalance: tx.newBalance,
        createdAt: tx.createdAt,
      }));

      const result: PaginatedTransactions = {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };

      await this.cacheManager.set(cacheKey, result, 30);
      return result;
    } catch (error) {
      this.logger.error(`Error getting transaction history: ${error.message}`, error.stack);
      throw error;
    }
  }

  async processWithdrawal(
    userId: string,
    withdrawalRequest: WithdrawalRequest,
  ): Promise<WithdrawalResult> {
    const { amount, destinationAddress, memo } = withdrawalRequest;

    try {
      // Validate withdrawal request
      await this.validateWithdrawalRequest(userId, amount, destinationAddress);

      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const balance = await queryRunner.manager.findOne(Balance, {
          where: { userId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!balance) {
          throw new NotFoundException('Wallet not found');
        }

        const totalAmount = amount + this.XLM_FEE;
        
        if (balance.availableBalance < totalAmount) {
          throw new BadRequestException('Insufficient balance');
        }

        // Update balance
        balance.availableBalance -= totalAmount;
        await queryRunner.manager.save(balance);

        // Create transaction record
        const transaction = queryRunner.manager.create(BalanceTransaction, {
          balanceId: balance.id,
          amount: -amount,
          type: TransactionType.DEBIT,
          source: TransactionSource.WITHDRAWAL,
          referenceId: `withdrawal_${Date.now()}`,
          metadata: {
            destinationAddress,
            memo,
            fee: this.XLM_FEE,
            status: 'pending',
          },
          previousBalance: balance.availableBalance + totalAmount,
          newBalance: balance.availableBalance,
        });

        const savedTransaction = await queryRunner.manager.save(transaction);

        // Simulate blockchain processing (in real implementation, integrate with Stellar)
        const withdrawalResult: WithdrawalResult = {
          transactionId: savedTransaction.referenceId,
          status: 'pending',
          amount,
          fee: this.XLM_FEE,
          destinationAddress,
          estimatedCompletion: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        };

        await queryRunner.commitTransaction();

        // Clear cache
        await this.invalidateUserCache(userId);

        this.logger.log(`Withdrawal processed for user ${userId}: ${amount} XLM to ${destinationAddress}`);
        return withdrawalResult;

      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      this.logger.error(`Error processing withdrawal: ${error.message}`, error.stack);
      throw error;
    }
  }

  async trackDeposit(
    userId: string,
    amount: number,
    sourceAddress: string,
    transactionHash: string,
  ): Promise<DepositResult> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        let balance = await queryRunner.manager.findOne(Balance, {
          where: { userId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!balance) {
          balance = queryRunner.manager.create(Balance, {
            userId,
            availableBalance: 0,
            lockedBalance: 0,
          });
        }

        const previousBalance = balance.availableBalance;
        balance.availableBalance += amount;
        
        await queryRunner.manager.save(balance);

        // Create deposit transaction
        const transaction = queryRunner.manager.create(BalanceTransaction, {
          balanceId: balance.id,
          amount,
          type: TransactionType.CREDIT,
          source: TransactionSource.DEPOSIT,
          referenceId: transactionHash,
          metadata: {
            sourceAddress,
            confirmations: 0,
            requiredConfirmations: this.REQUIRED_CONFIRMATIONS,
            status: 'pending',
          },
          previousBalance,
          newBalance: balance.availableBalance,
        });

        await queryRunner.manager.save(transaction);

        await queryRunner.commitTransaction();

        const depositResult: DepositResult = {
          transactionId: transactionHash,
          amount,
          sourceAddress,
          status: 'pending',
          confirmations: 0,
          requiredConfirmations: this.REQUIRED_CONFIRMATIONS,
        };

        // Clear cache
        await this.invalidateUserCache(userId);

        this.logger.log(`Deposit tracked for user ${userId}: ${amount} XLM from ${sourceAddress}`);
        return depositResult;

      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      this.logger.error(`Error tracking deposit: ${error.message}`, error.stack);
      throw error;
    }
  }

  async confirmDeposit(
    transactionHash: string,
    confirmations: number,
  ): Promise<void> {
    try {
      const transaction = await this.transactionRepository.findOne({
        where: { referenceId: transactionHash, source: TransactionSource.DEPOSIT },
      });

      if (!transaction) {
        throw new NotFoundException('Deposit transaction not found');
      }

      const metadata = transaction.metadata || {};
      metadata.confirmations = confirmations;
      metadata.status = confirmations >= this.REQUIRED_CONFIRMATIONS ? 'completed' : 'pending';

      await this.transactionRepository.update(transaction.id, { metadata });

      if (confirmations >= this.REQUIRED_CONFIRMATIONS) {
        const balance = await this.balanceRepository.findOne({
          where: { id: transaction.balanceId },
        });
        
        if (balance) {
          await this.invalidateUserCache(balance.userId);
        }
      }

      this.logger.log(`Deposit confirmation updated: ${transactionHash}, confirmations: ${confirmations}`);
    } catch (error) {
      this.logger.error(`Error confirming deposit: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getDailyWithdrawalLimit(userId: string): Promise<{ used: number; limit: number; remaining: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      const dailyWithdrawals = await this.transactionRepository
        .createQueryBuilder('transaction')
        .innerJoin('transaction.balance', 'balance')
        .where('balance.userId = :userId', { userId })
        .andWhere('transaction.source = :source', { source: TransactionSource.WITHDRAWAL })
        .andWhere('transaction.type = :type', { type: TransactionType.DEBIT })
        .andWhere('transaction.createdAt >= :today', { today })
        .getMany();

      const used = dailyWithdrawals.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

      return {
        used,
        limit: this.WITHDRAWAL_LIMIT,
        remaining: Math.max(0, this.WITHDRAWAL_LIMIT - used),
      };
    } catch (error) {
      this.logger.error(`Error getting daily withdrawal limit: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async validateWithdrawalRequest(
    userId: string,
    amount: number,
    destinationAddress: string,
  ): Promise<void> {
    if (amount <= 0) {
      throw new BadRequestException('Withdrawal amount must be positive');
    }

    if (amount < this.MIN_BALANCE) {
      throw new BadRequestException(`Minimum withdrawal amount is ${this.MIN_BALANCE} XLM`);
    }

    // Validate Stellar address format (basic validation)
    if (!destinationAddress || destinationAddress.length !== 56 || !destinationAddress.startsWith('G')) {
      throw new BadRequestException('Invalid destination address');
    }

    const dailyLimit = await this.getDailyWithdrawalLimit(userId);
    if (dailyLimit.remaining < amount) {
      throw new BadRequestException(`Daily withdrawal limit exceeded. Remaining: ${dailyLimit.remaining} XLM`);
    }
  }

  private async invalidateUserCache(userId: string): Promise<void> {
    const keys = [
      `wallet_balance_${userId}`,
      `transactions_${userId}`,
    ];

    for (const key of keys) {
      try {
        await this.cacheManager.del(key);
      } catch (error) {
        this.logger.warn(`Failed to clear cache key ${key}: ${error.message}`);
      }
    }
  }

  async getWalletStats(userId: string): Promise<{
    totalTransactions: number;
    totalDeposits: number;
    totalWithdrawals: number;
    totalEarned: number;
    averageTransactionSize: number;
  }> {
    try {
      const stats = await this.transactionRepository
        .createQueryBuilder('transaction')
        .innerJoin('transaction.balance', 'balance')
        .select('COUNT(transaction.id)', 'totalTransactions')
        .addSelect('SUM(CASE WHEN transaction.type = :credit THEN transaction.amount ELSE 0 END)', 'totalDeposits')
        .addSelect('SUM(CASE WHEN transaction.type = :debit THEN ABS(transaction.amount) ELSE 0 END)', 'totalWithdrawals')
        .addSelect('AVG(transaction.amount)', 'averageTransactionSize')
        .where('balance.userId = :userId', { userId })
        .setParameter('credit', TransactionType.CREDIT)
        .setParameter('debit', TransactionType.DEBIT)
        .getRawOne();

      const totalEarned = await this.transactionRepository
        .createQueryBuilder('transaction')
        .innerJoin('transaction.balance', 'balance')
        .innerJoin('transaction.balance', 'balance')
        .where('balance.userId = :userId', { userId })
        .andWhere('transaction.source IN (:...sources)', { 
          sources: [TransactionSource.REWARD, TransactionSource.BET] 
        })
        .andWhere('transaction.type = :type', { type: TransactionType.CREDIT })
        .select('SUM(transaction.amount)', 'total')
        .getRawOne();

      return {
        totalTransactions: parseInt(stats.totalTransactions) || 0,
        totalDeposits: parseFloat(stats.totalDeposits) || 0,
        totalWithdrawals: parseFloat(stats.totalWithdrawals) || 0,
        totalEarned: parseFloat(totalEarned.total) || 0,
        averageTransactionSize: parseFloat(stats.averageTransactionSize) || 0,
      };
    } catch (error) {
      this.logger.error(`Error getting wallet stats: ${error.message}`, error.stack);
      throw error;
    }
  }
}
